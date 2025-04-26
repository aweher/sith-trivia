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
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Verificar si este jugador es el anfitrión
    socket.on('gameCreated', ({ gameId }) => {
      if (gameId === urlGameId) {
        setIsHost(true);
      }
    });

    socket.on('playerJoined', ({ players }) => {
      setPlayers(players);
    });

    socket.on('gameStarted', ({ question, timeLimit }) => {
      console.log('Game started with question:', question);
      setCurrentQuestion(question);
      setTimeLeft(timeLimit);
      setGameStarted(true);
      setSelectedAnswer(null);
      setScores({});
      setResponseTimes({});
    });

    socket.on('answerResult', ({ playerId, isCorrect, points, timeTaken }) => {
      setScores(prev => ({
        ...prev,
        [playerId]: (prev[playerId] || 0) + points
      }));
      setResponseTimes(prev => ({
        ...prev,
        [playerId]: (prev[playerId] || 0) + timeTaken
      }));
    });

    socket.on('error', ({ message }) => {
      setError(message);
    });

    return () => {
      socket.off('gameCreated');
      socket.off('playerJoined');
      socket.off('gameStarted');
      socket.off('answerResult');
      socket.off('error');
    };
  }, [socket, urlGameId]);

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

      {gameStarted && currentQuestion && (
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

      {!gameStarted && (
        <div className="waiting-screen">
          <h3>Esperando a que los jugadores se unan...</h3>
          <p>Comparte el ID del juego con tus amigos: {urlGameId}</p>
          {isHost && (
            <button 
              onClick={handleStartGame} 
              className="start-game-button"
              disabled={players.length < 2}
            >
              {players.length < 2 ? 'Esperando más jugadores...' : 'Iniciar Juego'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default GameRoom; 