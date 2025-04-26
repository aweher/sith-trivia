import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './JoinGame.css';

function JoinGame({ socket, setGameId, setPlayerName }) {
  const navigate = useNavigate();
  const [nameInput, setNameInput] = useState('');
  const [gameId, setGameIdState] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.log('Setting up socket listeners');
    
    // Verificar si el socket está conectado
    if (socket.connected) {
      console.log('Socket is connected, requesting game ID');
      socket.emit('requestGameId');
    } else {
      console.log('Socket is not connected, waiting for connection');
      socket.on('connect', () => {
        console.log('Socket connected, requesting game ID');
        socket.emit('requestGameId');
      });
    }

    socket.on('gameId', ({ gameId }) => {
      console.log('Received game ID from server:', gameId);
      setGameIdState(gameId);
      setError('');
      setIsLoading(false);
    });

    socket.on('error', ({ message }) => {
      console.error('Server error:', message);
      setError(message);
      setIsLoading(false);
    });

    return () => {
      console.log('Cleaning up socket listeners');
      socket.off('gameId');
      socket.off('error');
      socket.off('connect');
    };
  }, [socket]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (nameInput && gameId) {
      console.log('Joining game with ID:', gameId);
      setIsLoading(true);
      setError('');
      setGameId(gameId);
      setPlayerName(nameInput);
      socket.emit('joinGame', { gameId, playerName: nameInput });
      navigate(`/game/${gameId}`);
    }
  };

  return (
    <div className="join-game-container">
      <h2>Unirse al Juego</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <input
            type="text"
            placeholder="Ingresa tu Nombre"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <button 
          type="submit" 
          className="join-button"
          disabled={!gameId || isLoading}
        >
          {!gameId ? 'Cargando...' : 'Unirse al Juego'}
        </button>
      </form>
    </div>
  );
}

export default JoinGame; 