import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './JoinGame.css';

function JoinGame({ socket, setGameId, setPlayerName }) {
  const navigate = useNavigate();
  const [nameInput, setNameInput] = useState('');
  const [gameId, setGameIdState] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('Setting up gameId listener');
    
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
    });

    socket.on('error', ({ message }) => {
      console.error('Server error:', message);
      setError(message);
    });

    return () => {
      console.log('Cleaning up gameId listener');
      socket.off('gameId');
      socket.off('error');
      socket.off('connect');
    };
  }, [socket]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (nameInput && gameId) {
      console.log('Joining game with ID:', gameId);
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
          />
        </div>
        <button type="submit" className="join-button" disabled={!gameId}>
          {gameId ? 'Unirse al Juego' : 'Cargando...'}
        </button>
      </form>
    </div>
  );
}

export default JoinGame; 