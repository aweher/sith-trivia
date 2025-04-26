import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './JoinGame.css';

function JoinGame({ socket, setGameId, setPlayerName }) {
  const navigate = useNavigate();
  const [nameInput, setNameInput] = useState('');
  const [gameId, setGameIdState] = useState('');

  useEffect(() => {
    console.log('Setting up gameId listener');
    socket.on('gameId', ({ gameId }) => {
      console.log('Received game ID from server:', gameId);
      setGameIdState(gameId);
    });

    // Solicitar el ID del juego al servidor
    console.log('Requesting game ID from server');
    socket.emit('requestGameId');

    return () => {
      console.log('Cleaning up gameId listener');
      socket.off('gameId');
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