import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './GameRoom.css';

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
  const [error, setError] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    console.log('Setting up socket listeners');
    console.log('Current socket ID:', socket.id);
    
    socket.on('playerJoined', ({ players, hostId }) => {
      console.log('Players updated:', players);
      console.log('Host ID:', hostId);
      console.log('Current socket ID:', socket.id);
      console.log('Is host?', socket.id === hostId);
      
      setPlayers(players);
      setIsHost(socket.id === hostId);
    });

    socket.on('gameStarted', ({ question, timeLimit }) => {
      console.log('Game started with question:', question);
      setCurrentQuestion(question);
      setTimeLeft(timeLimit);
      setGameStarted(true);
      setGameEnded(false);
      setSelectedAnswer(null);
      setScores({});
      setResponseTimes({});
      setShowFeedback(false);
      setShowCountdown(false);
    });

    socket.on('answerResult', ({ playerId, isCorrect, points, timeTaken }) => {
      if (playerId === socket.id) {
        setIsCorrect(isCorrect);
        setShowFeedback(true);
        // Ocultar el feedback después de 2 segundos
        setTimeout(() => {
          setShowFeedback(false);
          // Mostrar el countdown después de que se oculte el feedback
          setShowCountdown(true);
          setCountdown(3);
          
          // Usar un intervalo más preciso para el countdown
          const countdownInterval = setInterval(() => {
            setCountdown(prev => {
              if (prev <= 1) {
                clearInterval(countdownInterval);
                // Esperar un momento antes de ocultar el countdown
                setTimeout(() => {
                  setShowCountdown(false);
                }, 1000);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }, 2000);
      }
      setScores(prev => ({
        ...prev,
        [playerId]: (prev[playerId] || 0) + points
      }));
      setResponseTimes(prev => ({
        ...prev,
        [playerId]: (prev[playerId] || 0) + timeTaken
      }));
    });

    socket.on('gameEnded', ({ scores, responseTimes }) => {
      console.log('Game ended with scores:', scores);
      setGameEnded(true);
      setGameStarted(false);
      setScores(scores);
      setResponseTimes(responseTimes);
    });

    socket.on('error', ({ message }) => {
      console.error('Server error:', message);
      setError(message);
    });

    return () => {
      console.log('Cleaning up socket listeners');
      socket.off('playerJoined');
      socket.off('gameStarted');
      socket.off('answerResult');
      socket.off('gameEnded');
      socket.off('error');
    };
  }, [socket]);

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
    return players
      .map(player => ({
        ...player,
        score: scores[player.id] || 0,
        time: responseTimes[player.id] || 0
      }))
      .sort((a, b) => {
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        return a.time - b.time;
      });
  };

  return (
    <div className="game-room-container">
      <div className="game-header">
        <h2>Sala de Juego: {urlGameId}</h2>
        <div className="player-list">
          <h3>Jugadores:</h3>
          {getPlayerRanking().map((player, index) => (
            <div key={player.id} className="player">
              <span className="player-rank">#{index + 1}</span>
              <span className="player-name">{player.name}</span>
              <span className="player-score">{player.score} pts</span>
              <span className="player-time">({Math.round(player.time / 1000)}s)</span>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showFeedback && (
        <div className={`feedback-container ${isCorrect ? 'correct' : 'incorrect'}`}>
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
        <div className="countdown-container">
          <h3>¡Prepárate para la siguiente pregunta!</h3>
          <div className="countdown-number">{countdown}</div>
        </div>
      )}

      {gameStarted && currentQuestion && !showCountdown && (
        <div className="question-container">
          <div className="timer">Tiempo Restante: {Math.ceil(timeLeft / 1000)}s</div>
          <h3>{currentQuestion.question}</h3>
          {currentQuestion.help && (
            <div className="question-help">
              <p>{currentQuestion.help}</p>
            </div>
          )}
          <div className="answers-grid">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                className={`answer-button ${selectedAnswer === index ? 'selected' : ''}`}
                onClick={() => handleAnswerSelect(index)}
                disabled={selectedAnswer !== null}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {gameEnded && (
        <div className="game-end-container">
          <h3>¡Juego Terminado!</h3>
          <div className="final-scores">
            <h4>Resultados Finales:</h4>
            {getPlayerRanking().map((player, index) => (
              <div key={player.id} className="final-player">
                <span className="player-rank">#{index + 1}</span>
                <span className="player-name">{player.name}</span>
                <span className="player-score">{player.score} pts</span>
                <span className="player-time">({Math.round(player.time / 1000)}s)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!gameStarted && !gameEnded && (
        <div className="waiting-screen">
          <h3>Esperando a que los jugadores se unan...</h3>
          <p>Comparte el ID del juego con tus amigos: {urlGameId}</p>
          {isHost ? (
            <div className="admin-controls">
              <p className="admin-message">Eres el administrador. Puedes iniciar el juego cuando todos los jugadores estén listos.</p>
              <button 
                onClick={handleStartGame} 
                className="start-game-button"
                disabled={players.length < 2}
              >
                {players.length < 2 ? 'Esperando más jugadores...' : 'Iniciar Juego'}
              </button>
            </div>
          ) : (
            <div className="player-waiting">
              <p className="waiting-message">Esperando a que el administrador inicie el juego...</p>
              <p className="player-count">Jugadores en la sala: {players.length}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GameRoom; 