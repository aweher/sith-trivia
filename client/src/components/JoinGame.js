import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './JoinGame.css';

function JoinGame({ socket }) {
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [gameId, setGameId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('JoinGame component mounted');
    console.log('Socket connected:', socket.connected);
    
    // Solicitar el ID del juego al conectarse
    socket.emit('requestGameId');
    console.log('Requested game ID');

    // Escuchar la respuesta con el ID del juego
    socket.on('gameId', ({ gameId }) => {
      console.log('Received game ID:', gameId);
      setGameId(gameId);
    });

    // Escuchar errores
    socket.on('error', ({ message }) => {
      console.error('Socket error:', message);
      setError(message);
      setIsLoading(false);
    });

    return () => {
      socket.off('gameId');
      socket.off('error');
    };
  }, [socket]);

  const handleJoinGame = (e) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setError('Por favor ingresa tu nombre');
      return;
    }

    if (!gameId) {
      setError('Esperando el ID del juego...');
      return;
    }

    setIsLoading(true);
    setError('');
    console.log('Joining game with ID:', gameId);
    socket.emit('joinGame', { gameId, playerName });
  };

  React.useEffect(() => {
    socket.on('error', ({ message }) => {
      setError(message);
      setIsLoading(false);
    });

    socket.on('playerJoined', () => {
      navigate(`/game/${gameId}`);
    });

    return () => {
      socket.off('error');
      socket.off('playerJoined');
    };
  }, [socket, navigate, gameId]);

  return (
    <div className="join-game-container">
      <div className="join-game-content">
        <img 
          src="/assets/kyber_holograph.png" 
          alt="Kyber Holograph" 
          className="kyber-image"
        />
        <h2>Unirse al Juego</h2>
        <form onSubmit={handleJoinGame} className="join-game-form">
          <input
            type="text"
            placeholder="Tu nombre"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="join-game-input"
            disabled={isLoading}
          />
          <button 
            type="submit" 
            className="join-game-button"
            disabled={isLoading || !gameId}
          >
            {!gameId ? 'Conectando...' : isLoading ? 'Uniéndose...' : 'Unirse al Juego'}
          </button>
        </form>
        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  );
}

export default JoinGame; 