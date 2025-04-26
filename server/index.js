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

// Variable global para almacenar el ID del juego y el admin
let currentGameId = null;
let adminSocketId = null;

// Función para normalizar el ID de la sala
const normalizeRoomId = (roomId) => roomId.toLowerCase();

// Función para cargar el juego inicial
async function loadInitialGame() {
  try {
    console.log('Loading initial game...');
    const quizPath = path.join(__dirname, '../trivia-files/starwars_quiz.json');
    console.log('Quiz path:', quizPath);
    
    const quizData = await fs.readFile(quizPath, 'utf8');
    const gameData = JSON.parse(quizData);
    console.log('Game data loaded:', gameData);
    
    // Normalizar el ID de la sala
    const normalizedRoomId = normalizeRoomId(gameData.roomId);
    currentGameId = normalizedRoomId;
    console.log('Normalized room ID:', normalizedRoomId);
    
    // Verificar si el juego ya existe
    const existingGame = await redis.get(`game:${normalizedRoomId}`);
    if (!existingGame) {
      console.log('Creating new game with ID:', normalizedRoomId);
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
      console.log('Initial game loaded successfully with ID:', normalizedRoomId);
    } else {
      console.log('Game already exists with ID:', normalizedRoomId);
    }
  } catch (error) {
    console.error('Error loading initial game:', error);
    throw error;
  }
}

// Función para limpiar todos los datos
async function clearAllData() {
  try {
    console.log('Clearing all game data...');
    const keys = await redis.keys('game:*');
    if (keys.length > 0) {
      await redis.del(keys);
    }
    games.clear();
    console.log('All game data cleared successfully');
    return true;
  } catch (error) {
    console.error('Error clearing game data:', error);
    return false;
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
  }

  // Manejadores de administración
  socket.on('adminClearAll', async () => {
    console.log('Admin requested to clear all data');
    try {
      const success = await clearAllData();
      if (success) {
        adminSocketId = socket.id; // Asignar admin
        socket.emit('adminSuccess', { message: 'Todos los datos han sido borrados' });
      } else {
        socket.emit('adminError', { message: 'Error al borrar los datos' });
      }
    } catch (error) {
      console.error('Error in adminClearAll:', error);
      socket.emit('adminError', { message: 'Error al borrar los datos' });
    }
  });

  socket.on('adminReloadGame', async () => {
    console.log('Admin requested to reload game data');
    try {
      await clearAllData();
      await loadInitialGame();
      adminSocketId = socket.id; // Asignar admin
      socket.emit('adminSuccess', { message: 'Datos del juego recargados correctamente' });
    } catch (error) {
      console.error('Error in adminReloadGame:', error);
      socket.emit('adminError', { message: 'Error al recargar los datos del juego' });
    }
  });

  socket.on('adminStartGame', async () => {
    console.log('Admin requested to start game');
    try {
      if (currentGameId) {
        const gameData = await redis.get(`game:${currentGameId}`);
        if (gameData) {
          const game = JSON.parse(gameData);
          const currentQuestion = game.questions[game.currentQuestion];
          const timeLimit = process.env.GAME_TIMEOUT || 10000;
          
          io.to(currentGameId).emit('gameStarted', {
            question: currentQuestion,
            timeLimit: timeLimit
          });
          
          socket.emit('adminSuccess', { message: 'Juego iniciado correctamente' });
        } else {
          socket.emit('adminError', { message: 'No se encontró el juego actual' });
        }
      } else {
        socket.emit('adminError', { message: 'No hay un juego cargado' });
      }
    } catch (error) {
      console.error('Error in adminStartGame:', error);
      socket.emit('adminError', { message: 'Error al iniciar el juego' });
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
        
        // Solo agregar el jugador, no asignar como anfitrión
        game.players.push({ id: socket.id, name: playerName });
        game.scores[socket.id] = 0;
        game.responseTimes[socket.id] = 0;
        
        // Update game in Redis
        await redis.set(`game:${normalizedRoomId}`, JSON.stringify(game));
        games.set(normalizedRoomId, game);
        
        socket.join(normalizedRoomId);
        
        // Notificar a todos los jugadores sobre el nuevo jugador
        io.to(normalizedRoomId).emit('playerJoined', { 
          players: game.players,
          hostId: adminSocketId // Enviar el ID del admin como anfitrión
        });
        
        console.log(`Player ${playerName} joined game ${normalizedRoomId}`);
      } else {
        console.log('Game not found:', normalizedRoomId);
        socket.emit('error', { message: 'Juego no encontrado' });
      }
    } catch (error) {
      console.error('Error joining game:', error);
      socket.emit('error', { message: 'Error al unirse al juego' });
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

        // Verificar si todos los jugadores han respondido
        const allPlayersAnswered = game.players.every(player => 
          game.scores[player.id] !== undefined
        );

        if (allPlayersAnswered) {
          // Esperar 3 segundos antes de pasar a la siguiente pregunta
          setTimeout(async () => {
            // Avanzar a la siguiente pregunta
            game.currentQuestion++;
            
            // Verificar si hay más preguntas
            if (game.currentQuestion < game.questions.length) {
              const nextQuestion = game.questions[game.currentQuestion];
              const timeLimit = process.env.GAME_TIMEOUT || 10000;
              
              // Resetear las respuestas para la nueva pregunta
              game.scores = {};
              game.responseTimes = {};
              
              // Update game in Redis
              await redis.set(`game:${normalizedRoomId}`, JSON.stringify(game));
              games.set(normalizedRoomId, game);
              
              // Enviar la siguiente pregunta a todos los jugadores
              io.to(normalizedRoomId).emit('gameStarted', {
                question: nextQuestion,
                timeLimit: timeLimit
              });
            } else {
              // El juego ha terminado
              io.to(normalizedRoomId).emit('gameEnded', {
                scores: game.scores,
                responseTimes: game.responseTimes
              });
            }
          }, 3000);
        }

        console.log(`Answer submitted for game ${normalizedRoomId}`);
      } else {
        console.log('Game not found:', normalizedRoomId);
        socket.emit('error', { message: 'Juego no encontrado' });
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      socket.emit('error', { message: 'Error al enviar la respuesta' });
    }
  });

  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.id);
    // Si el admin se desconecta, limpiar su ID
    if (socket.id === adminSocketId) {
      adminSocketId = null;
    }
  });
});

const PORT = process.env.PORT || 55005;
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    // Cargar el juego inicial al iniciar el servidor
    await loadInitialGame();
    console.log('Server started successfully');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}); 