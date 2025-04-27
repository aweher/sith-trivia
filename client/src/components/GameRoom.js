import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './GameRoom.css';
import useMatomoTracking from '../hooks/useMatomoTracking';
import useSocketConnection from '../hooks/useSocketConnection';

function GameRoom({ socket, gameId, playerName }) {
  const { gameId: urlGameId } = useParams();
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [players, setPlayers] = useState([]);
  const [scores, setScores] = useState({});
  const [responseTimes, setResponseTimes] = useState({});
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [hostId, setHostId] = useState(null);
  const [error, setError] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [questionNumber, setQuestionNumber] = useState(0);
  const navigate = useNavigate();
  const { isConnected, reconnectAttempts, lastError, manualReconnect } = useSocketConnection(socket);
  const { trackGameStart, trackGameEnd, trackAnswer, trackPlayerJoin, trackPlayerLeave } = useMatomoTracking();

  useEffect(() => {
    console.log('Setting up socket listeners');
    console.log('Current socket ID:', socket.id);
    
    socket.emit('requestGameId');
    trackPlayerJoin(urlGameId);

    socket.on('playerJoined', (data) => {
      setPlayers(data.players);
      setHostId(data.hostId);
      setIsHost(socket.id === data.hostId);
      setScores(data.scores || {});
      setResponseTimes(data.responseTimes || {});
    });

    socket.on('gameStarted', ({ question, timeLimit }) => {
      console.log('Game started with question:', question);
      setCurrentQuestion(question);
      setTimeLeft(timeLimit);
      setGameStarted(true);
      setGameEnded(false);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setShowCountdown(false);
      trackGameStart(urlGameId);
    });

    socket.on('nextQuestion', ({ question, timeLimit }) => {
      console.log('Next question:', question);
      setCurrentQuestion(question);
      setTimeLeft(timeLimit);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setShowCountdown(false);
    });

    socket.on('scoresUpdated', (data) => {
      setScores(prevScores => ({
        ...prevScores,
        ...data.scores
      }));
      setResponseTimes(prevTimes => ({
        ...prevTimes,
        ...data.responseTimes
      }));
      if (data.players) {
        setPlayers(data.players);
      }
    });

    socket.on('gameState', (data) => {
      if (data.players) setPlayers(data.players);
      if (data.scores) setScores(data.scores);
      if (data.responseTimes) setResponseTimes(data.responseTimes);
      if (data.currentQuestion) setCurrentQuestion(data.currentQuestion);
      if (data.questionNumber !== undefined) setQuestionNumber(data.questionNumber);
      setShowFeedback(false);
    });

    socket.on('answerResult', ({ playerId, isCorrect, points, timeTaken }) => {
      if (playerId === socket.id) {
        setIsCorrect(isCorrect);
        setShowFeedback(true);
        trackAnswer(urlGameId, isCorrect, timeLeft);
        
        let feedbackTimeout;
        let countdownTimeout;
        let countdownInterval;

        feedbackTimeout = setTimeout(() => {
          setShowFeedback(false);
          setShowCountdown(true);
          setCountdown(3);
          
          countdownInterval = setInterval(() => {
            setCountdown(prev => {
              if (prev <= 1) {
                clearInterval(countdownInterval);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);

          countdownTimeout = setTimeout(() => {
            setShowCountdown(false);
          }, 8000);
        }, 2000);

        return () => {
          clearTimeout(feedbackTimeout);
          clearTimeout(countdownTimeout);
          clearInterval(countdownInterval);
        };
      }
    });

    socket.on('gameEnded', ({ scores, responseTimes }) => {
      console.log('Game ended with scores:', scores);
      setGameEnded(true);
      setGameStarted(false);
      setScores(scores);
      setResponseTimes(responseTimes);
      trackGameEnd(urlGameId, scores[socket.id] || 0);
    });

    socket.on('gameReset', () => {
      console.log('Game reset received');
      setPlayers([]);
      setScores({});
      setResponseTimes({});
      setCurrentQuestion(null);
      setGameStarted(false);
      setGameEnded(false);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setShowCountdown(false);
      setCountdown(3);
      navigate('/');
    });

    socket.on('error', ({ message }) => {
      console.error('Server error:', message);
      setError(message);
    });

    return () => {
      console.log('Cleaning up socket listeners');
      trackPlayerLeave(urlGameId);
      socket.off('playerJoined');
      socket.off('gameStarted');
      socket.off('nextQuestion');
      socket.off('scoresUpdated');
      socket.off('answerResult');
      socket.off('gameEnded');
      socket.off('error');
      socket.off('gameReset');
      socket.off('gameState');
    };
  }, [socket, navigate, urlGameId, trackPlayerJoin, trackPlayerLeave, trackGameStart, trackGameEnd, trackAnswer]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => prev - 1000);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft]);

  const handleStartGame = () => {
    console.log('Starting game with ID:', urlGameId);
    console.log('Is host?', isHost);
    setError('');
    socket.emit('startGame', { gameId: urlGameId });
  };

  const handleAnswerSelect = (answerIndex) => {
    if (selectedAnswer === null) {
      setSelectedAnswer(answerIndex);
      socket.emit('submitAnswer', {
        gameId: urlGameId,
        answer: answerIndex,
        timeLeft
      });
    }
  };

  const getPlayerRanking = () => {
    const rankedPlayers = [...players]
      .filter(player => player && player.id)
      .sort((a, b) => {
        const scoreA = scores[a.id] || 0;
        const scoreB = scores[b.id] || 0;
        const timeA = responseTimes[a.id] || 0;
        const timeB = responseTimes[b.id] || 0;
        
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
        return timeA - timeB;
      });
    
    return rankedPlayers;
  };

  const formatTime = (time) => {
    return (time / 1000).toFixed(1);
  };

  // Agregar manejo de reconexión
  useEffect(() => {
    const handleBeforeUnload = () => {
      socket.emit('playerDisconnected', { gameId: urlGameId });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      socket.emit('playerDisconnected', { gameId: urlGameId });
    };
  }, [socket, urlGameId]);

  // Limpiar estado al desmontar
  useEffect(() => {
    return () => {
      setGameStarted(false);
      setGameEnded(false);
      setCurrentQuestion(null);
      setTimeLeft(0);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setShowCountdown(false);
      setCountdown(3);
    };
  }, []);

  return (
    <div className="game-room-container" role="main">
      {/* Connection Status */}
      {!isConnected && (
        <div className="connection-status">
          <div className="connection-error">
            <p>Error de conexión: {lastError}</p>
            <p>Intentos de reconexión: {reconnectAttempts}</p>
            <button 
              onClick={manualReconnect}
              className="reconnect-button"
              disabled={reconnectAttempts >= 5}
            >
              {reconnectAttempts >= 5 ? 'Máximo de intentos alcanzado' : 'Reconectar'}
            </button>
          </div>
        </div>
      )}

      <div className="game-header">
        <h2>Sala de Juego: {urlGameId}</h2>
        <div className="player-list" role="region" aria-label="Ranking de Jugadores">
          <h3>Ranking de Jugadores</h3>
          {getPlayerRanking().map((player, index) => (
            <div 
              key={player.id} 
              className={`player-item ${player.id === socket.id ? 'current-player' : ''}`}
              role="listitem"
            >
              <span className="player-rank" aria-label={`Posición ${index + 1}`}>{index + 1}.</span>
              <span className="player-name">{player.name}</span>
              <span className="player-score" aria-label={`${scores[player.id] || 0} puntos`}>
                {scores[player.id] || 0} pts
              </span>
              <span className="player-time" aria-label={`${formatTime(responseTimes[player.id] || 0)} segundos`}>
                {formatTime(responseTimes[player.id] || 0)}s
              </span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {showFeedback && (
        <div 
          className={`feedback-container ${isCorrect ? 'correct' : 'incorrect'}`}
          role="alert"
          aria-live="polite"
        >
          <img 
            src={`/assets/${isCorrect ? 'kyber_red.png' : 'kyber_green.png'}?t=${Date.now()}`}
            alt={isCorrect ? "Respuesta Correcta" : "Respuesta Incorrecta"} 
            className="feedback-image"
          />
          <p className="feedback-message">
            {isCorrect ? "¡Respuesta Correcta!" : "Respuesta Incorrecta"}
          </p>
        </div>
      )}

      {showCountdown && (
        <div 
          className="countdown-container" 
          role="timer"
          aria-live="polite"
          aria-label={`Siguiente pregunta en ${countdown} segundos`}
        >
          <div className="countdown-number">{countdown}</div>
        </div>
      )}

      {gameStarted && currentQuestion && !showCountdown && (
        <div className="question-container">
          <div 
            className="timer" 
            role="timer"
            aria-live="polite"
            aria-label={`Tiempo restante: ${Math.floor(timeLeft / 1000)} segundos`}
          >
            Tiempo Restante: {Math.floor(timeLeft / 1000)}s
          </div>
          <h3>{currentQuestion.question}</h3>
          {currentQuestion.help && (
            <div className="question-help">
              <p>{currentQuestion.help}</p>
            </div>
          )}
          <div className="answers-grid" role="radiogroup" aria-label="Opciones de respuesta">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                className={`answer-button ${selectedAnswer === index ? 'selected' : ''}`}
                onClick={() => handleAnswerSelect(index)}
                disabled={selectedAnswer !== null}
                role="radio"
                aria-checked={selectedAnswer === index}
                aria-label={`Opción ${index + 1}: ${option}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {gameEnded && (
        <div className="game-end-container" role="region" aria-label="Resultados finales">
          <h3>¡Juego Terminado!</h3>
          <div className="final-scores">
            <h4>Resultados Finales:</h4>
            {getPlayerRanking().map((player, index) => (
              <div 
                key={player.id} 
                className="final-player"
                role="listitem"
              >
                <span className="player-rank" aria-label={`Posición ${index + 1}`}>#{index + 1}</span>
                <span className="player-name">{player.name}</span>
                <span className="player-score" aria-label={`${player.score} puntos`}>
                  {player.score} pts
                </span>
                <span className="player-time" aria-label={`${formatTime(player.responseTime)} segundos`}>
                  {formatTime(player.responseTime)}s
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!gameStarted && !gameEnded && (
        <div className="waiting-screen" role="region" aria-label="Pantalla de espera">
          <h3>Esperando a que los jugadores se unan...</h3>
          <p>Comparte el ID del juego con tus amigos: {urlGameId}</p>
          {isHost ? (
            <div className="admin-controls">
              <p className="admin-message">Eres el administrador. Puedes iniciar el juego cuando todos los jugadores estén listos.</p>
              <button 
                onClick={handleStartGame} 
                className="start-game-button"
                disabled={players.length < 2}
                aria-label={players.length < 2 ? 'Esperando más jugadores...' : 'Iniciar Juego'}
              >
                {players.length < 2 ? 'Esperando más jugadores...' : 'Iniciar Juego'}
              </button>
            </div>
          ) : (
            <div className="player-waiting">
              <p className="waiting-message">Esperando a que el administrador inicie el juego...</p>
              <p className="player-count" aria-live="polite">
                Jugadores en la sala: {players.length}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GameRoom; 