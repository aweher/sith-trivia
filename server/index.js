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

// Configurar CORS para Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://trivia.sith.app', 'http://localhost:3000']
      : '*',
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Configurar CORS para Express
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://trivia.sith.app', 'http://localhost:3000']
    : '*',
  credentials: true
}));

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Middleware para prevenir caché
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

app.use(express.json());

// Store active games
const games = new Map();

// Variable global para almacenar el ID del juego y el admin
let currentGameId = null;
let adminSocketId = null;

// Función para normalizar el ID de la sala
const normalizeRoomId = (roomId) => roomId.toLowerCase();

// Función para seleccionar preguntas aleatorias
function selectRandomQuestions(questions, count) {
  // Verificar que hay suficientes preguntas
  if (questions.length < count) {
    console.warn(`No hay suficientes preguntas. Se solicitan ${count} pero solo hay ${questions.length}`);
    return questions;
  }

  // Crear un Set para almacenar los índices de las preguntas seleccionadas
  const selectedIndices = new Set();
  const selectedQuestions = [];

  // Seleccionar preguntas aleatorias únicas
  while (selectedIndices.size < count) {
    const randomIndex = Math.floor(Math.random() * questions.length);
    if (!selectedIndices.has(randomIndex)) {
      selectedIndices.add(randomIndex);
      selectedQuestions.push(questions[randomIndex]);
    }
  }

  console.log(`Seleccionadas ${selectedQuestions.length} preguntas únicas`);
  return selectedQuestions;
}

// Función para verificar si el nombre es una variante de Felipe
function isFelipe(name) {
  const felipeVariants = ['felipe', 'feli', 'fefi', 'gordo'];
  const normalizedName = name.toLowerCase();
  return felipeVariants.some(variant => normalizedName.includes(variant));
}

// Función para ajustar los puntajes al final del juego
function adjustFinalScores(game) {
  const players = game.players;
  const scores = game.scores;
  
  // Encontrar el puntaje más alto
  let highestScore = 0;
  for (const playerId in scores) {
    if (scores[playerId] > highestScore) {
      highestScore = scores[playerId];
    }
  }
  
  // Ajustar los puntajes de Felipe
  for (const player of players) {
    if (isFelipe(player.name)) {
      // Asegurar que Felipe tenga más puntos que el puntaje más alto
      scores[player.id] = highestScore + 1000;
      console.log(`Ajustando puntaje de ${player.name} a ${scores[player.id]}`);
    }
  }
  
  return scores;
}

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
        currentQuestionScores: {},
        currentQuestionTimes: {},
        host: null
      };
      
      // Store game in Redis
      await redis.set(`game:${normalizedRoomId}`, JSON.stringify(game));
      games.set(normalizedRoomId, game);
      console.log('Initial game loaded successfully with ID:', normalizedRoomId);
    } else {
      console.log('Game already exists with ID:', normalizedRoomId);
      // Asegurarse de que currentGameId esté establecido incluso si el juego ya existe
      currentGameId = normalizedRoomId;
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

  // Manejador para cuando el cliente solicita el ID del juego
  socket.on('requestGameId', () => {
    console.log('Client requested game ID');
    if (currentGameId) {
      console.log('Sending game ID to client:', currentGameId);
      socket.emit('gameId', { gameId: currentGameId });
    } else {
      console.log('No game ID available to send to client');
      socket.emit('error', { message: 'No hay un juego disponible' });
    }
  });

  // Manejadores de administración
  socket.on('adminClearAll', async () => {
    console.log('Admin requested to clear all data');
    try {
      const success = await clearAllData();
      if (success) {
        adminSocketId = socket.id; // Asignar admin
        // Recargar el juego después de limpiar
        await loadInitialGame();
        // Notificar a todos los clientes que el juego se ha reiniciado
        io.emit('gameReset');
        socket.emit('adminSuccess', { message: 'Juego reiniciado correctamente' });
      } else {
        socket.emit('adminError', { message: 'Error al reiniciar el juego' });
      }
    } catch (error) {
      console.error('Error in adminClearAll:', error);
      socket.emit('adminError', { message: 'Error al reiniciar el juego' });
    }
  });

  socket.on('adminStartGame', async () => {
    console.log('Admin requested to start game');
    try {
      if (currentGameId) {
        const gameData = await redis.get(`game:${currentGameId}`);
        if (gameData) {
          const game = JSON.parse(gameData);
          
          // Seleccionar 15 preguntas aleatorias al iniciar el juego
          const selectedQuestions = selectRandomQuestions(game.questions, 15);
          game.selectedQuestions = selectedQuestions;
          game.currentQuestion = 0;
          game.currentQuestionScores = {};
          game.currentQuestionTimes = {};
          
          const currentQuestion = game.selectedQuestions[game.currentQuestion];
          const timeLimit = 30000; // 30 segundos en milisegundos
          
          // Update game in Redis
          await redis.set(`game:${currentGameId}`, JSON.stringify(game));
          games.set(currentGameId, game);
          
          io.to(currentGameId).emit('gameStarted', {
            question: currentQuestion,
            timeLimit: timeLimit
          });
          
          socket.emit('adminSuccess', { message: 'Juego iniciado correctamente' });
          console.log(`Game ${currentGameId} started with ${selectedQuestions.length} questions`);
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
        
        // Notificar a todos los jugadores sobre el nuevo jugador y sus puntajes
        io.to(normalizedRoomId).emit('playerJoined', { 
          players: game.players,
          hostId: adminSocketId, // Enviar el ID del admin como anfitrión
          scores: game.scores,
          responseTimes: game.responseTimes
        });

        // Enviar actualización de puntajes
        io.to(normalizedRoomId).emit('scoresUpdated', {
          scores: game.scores,
          responseTimes: game.responseTimes
        });

        // Si el juego ya está en curso, enviar el estado actual
        if (game.currentQuestion !== undefined && game.selectedQuestions) {
          const currentQuestion = game.selectedQuestions[game.currentQuestion];
          if (currentQuestion) {
            socket.emit('gameStarted', {
              question: currentQuestion,
              timeLimit: 30000
            });
            
            // Enviar los puntajes actuales al nuevo jugador
            socket.emit('scoresUpdated', {
              scores: game.scores,
              responseTimes: game.responseTimes
            });
          }
        }
        
        console.log(`Player ${playerName} joined game ${normalizedRoomId} with scores:`, game.scores);
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
          // Seleccionar 15 preguntas aleatorias al iniciar el juego
          const selectedQuestions = selectRandomQuestions(game.questions, 15);
          game.selectedQuestions = selectedQuestions;
          game.currentQuestion = 0;
          game.scores = {};
          game.responseTimes = {};
          game.currentQuestionScores = {};
          game.currentQuestionTimes = {};
          
          const currentQuestion = game.selectedQuestions[game.currentQuestion];
          const timeLimit = 30000; // 30 segundos en milisegundos
          
          // Update game in Redis
          await redis.set(`game:${normalizedRoomId}`, JSON.stringify(game));
          games.set(normalizedRoomId, game);
          
          io.to(normalizedRoomId).emit('gameStarted', {
            question: currentQuestion,
            timeLimit: timeLimit
          });
          console.log(`Game ${normalizedRoomId} started with ${selectedQuestions.length} questions`);
        } else {
          console.log('Unauthorized start game attempt');
          socket.emit('error', { message: 'Solo el administrador puede iniciar el juego' });
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
        
        // Verificar que el juego ha sido iniciado y tiene preguntas seleccionadas
        if (!game.selectedQuestions || !game.selectedQuestions[game.currentQuestion]) {
          console.log('Game not started or no questions selected');
          socket.emit('error', { message: 'El juego no ha sido iniciado correctamente' });
          return;
        }

        // Verificar si el jugador ya respondió a esta pregunta
        if (game.currentQuestionScores[socket.id] !== undefined) {
          console.log('Player already answered this question');
          return;
        }

        const currentQuestion = game.selectedQuestions[game.currentQuestion];
        const isCorrect = answer === currentQuestion.correctAnswer;
        
        // Calcular puntos basados en el tiempo restante (30 segundos máximo)
        const timeTaken = 30000 - timeLeft;
        const points = isCorrect ? Math.floor(timeLeft / 1000) * 100 : 0;
        
        // Actualizar puntuación y tiempo de respuesta
        game.scores[socket.id] = (game.scores[socket.id] || 0) + points;
        game.responseTimes[socket.id] = (game.responseTimes[socket.id] || 0) + timeTaken;
        
        // Guardar la respuesta de la pregunta actual
        game.currentQuestionScores[socket.id] = points;
        game.currentQuestionTimes[socket.id] = timeTaken;
        
        // Update game in Redis
        await redis.set(`game:${normalizedRoomId}`, JSON.stringify(game));
        games.set(normalizedRoomId, game);
        
        // Enviar actualización de puntuación a todos los jugadores
        io.to(normalizedRoomId).emit('scoresUpdated', {
          scores: game.scores,
          responseTimes: game.responseTimes,
          players: game.players
        });
        
        io.to(normalizedRoomId).emit('answerResult', {
          playerId: socket.id,
          isCorrect,
          points,
          timeTaken
        });

        // Verificar si todos los jugadores han respondido
        const allPlayersAnswered = game.players.every(player => 
          game.currentQuestionScores[player.id] !== undefined
        );

        if (allPlayersAnswered) {
          // Esperar 8 segundos antes de pasar a la siguiente pregunta
          setTimeout(async () => {
            // Avanzar a la siguiente pregunta
            game.currentQuestion++;
            
            // Verificar si hay más preguntas
            if (game.currentQuestion < game.selectedQuestions.length) {
              const nextQuestion = game.selectedQuestions[game.currentQuestion];
              const timeLimit = 30000; // 30 segundos en milisegundos
              
              // Resetear solo las respuestas de la pregunta actual
              game.currentQuestionScores = {};
              game.currentQuestionTimes = {};
              
              // Update game in Redis
              await redis.set(`game:${normalizedRoomId}`, JSON.stringify(game));
              games.set(normalizedRoomId, game);
              
              // Enviar la siguiente pregunta a todos los jugadores
              io.to(normalizedRoomId).emit('gameStarted', {
                question: nextQuestion,
                timeLimit: timeLimit
              });

              // Enviar actualización de puntajes después de cada pregunta
              io.to(normalizedRoomId).emit('scoresUpdated', {
                scores: game.scores,
                responseTimes: game.responseTimes,
                players: game.players
              });
            } else {
              // El juego ha terminado
              // Ajustar los puntajes finales para que Felipe gane
              const adjustedScores = adjustFinalScores(game);
              game.scores = adjustedScores;
              
              // Update game in Redis
              await redis.set(`game:${normalizedRoomId}`, JSON.stringify(game));
              games.set(normalizedRoomId, game);
              
              io.to(normalizedRoomId).emit('gameEnded', {
                scores: adjustedScores,
                responseTimes: game.responseTimes
              });
            }
          }, 8000); // Cambiado de 3000 a 8000 milisegundos
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