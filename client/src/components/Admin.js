import React, { useState, useEffect } from 'react';
import './Admin.css';

function Admin({ socket }) {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleResetGame = () => {
    setIsLoading(true);
    setMessage('');
    socket.emit('adminClearAll');
  };

  const handleStartGame = () => {
    setIsLoading(true);
    setMessage('');
    socket.emit('adminStartGame');
  };

  useEffect(() => {
    socket.on('adminSuccess', ({ message }) => {
      setMessage(message);
      setIsLoading(false);
    });

    socket.on('adminError', ({ message }) => {
      setMessage(message);
      setIsLoading(false);
    });

    return () => {
      socket.off('adminSuccess');
      socket.off('adminError');
    };
  }, [socket]);

  return (
    <div className="admin-container">
      <div className="admin-content">
        <h2>Panel de Administración</h2>
        <div className="admin-controls">
          <button 
            onClick={handleResetGame} 
            disabled={isLoading}
            className="admin-button reset-button"
          >
            {isLoading ? 'Procesando...' : 'Reiniciar Juego'}
          </button>
          <button 
            onClick={handleStartGame} 
            disabled={isLoading}
            className="admin-button start-button"
          >
            {isLoading ? 'Procesando...' : 'Iniciar Juego'}
          </button>
        </div>
        {message && <div className="admin-message">{message}</div>}
      </div>
    </div>
  );
}

export default Admin; 