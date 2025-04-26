import React, { useState } from 'react';
import './Admin.css';

function Admin({ socket }) {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleClearAll = async () => {
    try {
      setIsLoading(true);
      setError('');
      setSuccess('');
      socket.emit('adminClearAll');
    } catch (error) {
      setError('Error al limpiar los datos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReloadGame = async () => {
    try {
      setIsLoading(true);
      setError('');
      setSuccess('');
      socket.emit('adminReloadGame');
    } catch (error) {
      setError('Error al recargar el juego');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartGame = async () => {
    try {
      setIsLoading(true);
      setError('');
      setSuccess('');
      socket.emit('adminStartGame');
    } catch (error) {
      setError('Error al iniciar el juego');
    } finally {
      setIsLoading(false);
    }
  };

  // Escuchar respuestas del servidor
  React.useEffect(() => {
    socket.on('adminSuccess', ({ message }) => {
      setSuccess(message);
      setError('');
    });

    socket.on('adminError', ({ message }) => {
      setError(message);
      setSuccess('');
    });

    return () => {
      socket.off('adminSuccess');
      socket.off('adminError');
    };
  }, [socket]);

  return (
    <div className="admin-container">
      <h2>Panel de Administración</h2>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <div className="admin-actions">
        <button 
          onClick={handleClearAll} 
          className="admin-button"
          disabled={isLoading}
        >
          {isLoading ? 'Procesando...' : 'Borrar todas las salas y datos'}
        </button>
        
        <button 
          onClick={handleReloadGame} 
          className="admin-button"
          disabled={isLoading}
        >
          {isLoading ? 'Procesando...' : 'Recargar datos del juego'}
        </button>
        
        <button 
          onClick={handleStartGame} 
          className="admin-button"
          disabled={isLoading}
        >
          {isLoading ? 'Procesando...' : 'Iniciar juego'}
        </button>
      </div>
    </div>
  );
}

export default Admin; 