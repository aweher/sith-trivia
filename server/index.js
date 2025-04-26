const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const Redis = require('ioredis');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

app.use(cors());
app.use(express.json());

// Store active games
const games = new Map();

// Variable global para almacenar el ID del juego
let currentGameId = null;

// Función para normalizar el ID de la sala
const normalizeRoomId = (roomId) => roomId.toLowerCase();

// Función para cargar el juego inicial
async function loadInitialGame() {
  try {
    const quizPath = path.join(__dirname, '../trivia-files/starwars_quiz.json');
    const quizData = await fs.readFile(quizPath, 'utf8');
    const gameData = JSON.parse(quizData);
    
    // Normalizar el ID de la sala
    const normalizedRoomId = normalizeRoomId(gameData.roomId);
    currentGameId = normalizedRoomId;
    
    // Verificar si el juego ya existe
    const existingGame = await redis.get(`game:${normalizedRoomId}`);
    if (!existingGame) {
      const game = {
        ...gameData,
        roomId: normalizedRoomId,
        players: [],
        currentQuestion: 0,
        scores: {},
        responseTimes: {},
        host: null
      };
      
      // Store game in Redis
      await redis.set(`game:${normalizedRoomId}`, JSON.stringify(game));
      games.set(normalizedRoomId, game);
      console.log('Initial game loaded with ID:', normalizedRoomId);
    }
  } catch (error) {
    console.error('Error loading initial game:', error);
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected with ID:', socket.id);
  console.log('Current game ID:', currentGameId);

  // Enviar el ID del juego al cliente cuando se conecta
  if (currentGameId) {
    console.log('Sending game ID to client:', currentGameId);
    socket.emit('gameId', { gameId: currentGameId });
  } else {
    console.log('No game ID available to send to client');
  }

  // Manejador para cuando el cliente solicita el ID del juego
  socket.on('requestGameId', () => {
    console.log('Client requested game ID');
    if (currentGameId) {
      console.log('Sending game ID to client:', currentGameId);
      socket.emit('gameId', { gameId: currentGameId });
    } else {
      console.log('No game ID available to send to client');
    }
  });

  socket.on('createGame', async (gameData) => {
    console.log('Received createGame event with data:', gameData);
    try {
      // Usar el ID de sala personalizado si existe, o generar uno aleatorio
      const roomId = gameData.roomId ? normalizeRoomId(gameData.roomId) : Math.random().toString(36).substring(2, 8);
      
      // Verificar si el ID de sala ya existe
      const existingGame = await redis.get(`game:${roomId}`);
      if (existingGame) {
        socket.emit('error', { message: 'El ID de sala ya está en uso' });
        return;
      }

      const game = {
        ...gameData,
        roomId,
        players: [],
        currentQuestion: 0,
        scores: {},
        responseTimes: {},
        host: socket.id
      };
      
      // Store game in Redis
      await redis.set(`game:${roomId}`, JSON.stringify(game));
      games.set(roomId, game);
      
      socket.join(roomId);
      console.log('Game created successfully with ID:', roomId);
      
      // Emit the gameCreated event to the specific socket
      socket.emit('gameCreated', { gameId: roomId });
    } catch (error) {
      console.error('Error creating game:', error);
      socket.emit('error', { message: 'Error creating game' });
    }
  });

  socket.on('joinGame', async ({ gameId, playerName }) => {
    console.log('Received joinGame event for game:', gameId, 'player:', playerName);
    try {
      const normalizedRoomId = normalizeRoomId(gameId);
      const gameData = await redis.get(`game:${normalizedRoomId}`);
      if (gameData) {
        const game = JSON.parse(gameData);
        game.players.push({ id: socket.id, name: playerName });
        game.scores[socket.id] = 0;
        
        // Update game in Redis
        await redis.set(`game:${normalizedRoomId}`, JSON.stringify(game));
        games.set(normalizedRoomId, game);
        
        socket.join(normalizedRoomId);
        io.to(normalizedRoomId).emit('playerJoined', { players: game.players });
        console.log(`Player ${playerName} joined game ${normalizedRoomId}`);
      } else {
        console.log('Game not found:', normalizedRoomId);
        socket.emit('error', { message: 'Game not found' });
      }
    } catch (error) {
      console.error('Error joining game:', error);
      socket.emit('error', { message: 'Error joining game' });
    }
  });

  socket.on('startGame', async ({ gameId }) => {
    console.log('Received startGame event for game:', gameId);
    try {
      const normalizedRoomId = normalizeRoomId(gameId);
      const gameData = await redis.get(`game:${normalizedRoomId}`);
      if (gameData) {
        const game = JSON.parse(gameData);
        if (game.host === socket.id) {
          // Reiniciar el estado del juego
          game.currentQuestion = 0;
          game.scores = {};
          game.responseTimes = {};
          
          // Obtener la primera pregunta
          const currentQuestion = game.questions[game.currentQuestion];
          const timeLimit = process.env.GAME_TIMEOUT || 10000;
          
          // Actualizar el juego en Redis
          await redis.set(`game:${normalizedRoomId}`, JSON.stringify(game));
          games.set(normalizedRoomId, game);
          
          // Notificar a todos los jugadores que el juego ha comenzado
          io.to(normalizedRoomId).emit('gameStarted', {
            question: currentQuestion,
            timeLimit: timeLimit
          });
          
          console.log(`Game ${normalizedRoomId} started with question:`, currentQuestion.question);
        } else {
          console.log('Unauthorized start game attempt');
          socket.emit('error', { message: 'Solo el anfitrión puede iniciar el juego' });
        }
      } else {
        console.log('Game not found:', normalizedRoomId);
        socket.emit('error', { message: 'Juego no encontrado' });
      }
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', { message: 'Error al iniciar el juego' });
    }
  });

  socket.on('submitAnswer', async ({ gameId, answer, timeLeft }) => {
    console.log('Received submitAnswer event for game:', gameId);
    try {
      const normalizedRoomId = normalizeRoomId(gameId);
      const gameData = await redis.get(`game:${normalizedRoomId}`);
      if (gameData) {
        const game = JSON.parse(gameData);
        const currentQuestion = game.questions[game.currentQuestion];
        const isCorrect = answer === currentQuestion.correctAnswer;
        
        // Calcular puntos basados en el tiempo restante
        const timeTaken = process.env.GAME_TIMEOUT - timeLeft;
        const points = isCorrect ? Math.floor(timeLeft / 1000) * 100 : 0;
        
        // Actualizar puntuación y tiempo de respuesta
        game.scores[socket.id] = (game.scores[socket.id] || 0) + points;
        game.responseTimes[socket.id] = (game.responseTimes[socket.id] || 0) + timeTaken;
        
        // Update game in Redis
        await redis.set(`game:${normalizedRoomId}`, JSON.stringify(game));
        games.set(normalizedRoomId, game);
        
        io.to(normalizedRoomId).emit('answerResult', {
          playerId: socket.id,
          isCorrect,
          points,
          timeTaken
        });
        console.log(`Answer submitted for game ${normalizedRoomId}`);
      } else {
        console.log('Game not found:', normalizedRoomId);
        socket.emit('error', { message: 'Game not found' });
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      socket.emit('error', { message: 'Error submitting answer' });
    }
  });

  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.id);
    // Clean up games where this socket was the host
    for (const [gameId, game] of games.entries()) {
      if (game.host === socket.id) {
        await redis.del(`game:${gameId}`);
        games.delete(gameId);
        console.log(`Game ${gameId} cleaned up after host disconnect`);
      }
    }
  });
});

const PORT = process.env.PORT || 55005;
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  // Cargar el juego inicial al iniciar el servidor
  await loadInitialGame();
}); 