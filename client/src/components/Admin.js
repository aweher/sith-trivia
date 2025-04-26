import React, { useState, useEffect } from 'react';
import YouTube from 'react-youtube';
import './Admin.css';

function Admin({ socket }) {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [player, setPlayer] = useState(null);

  const onReady = (event) => {
    setPlayer(event.target);
    // Reproducir el video automáticamente
    event.target.playVideo();
    // Establecer el volumen al 50%
    event.target.setVolume(50);
  };

  const opts = {
    height: '0',
    width: '0',
    playerVars: {
      autoplay: 1,
      loop: 1,
      controls: 0,
      disablekb: 1,
      enablejsapi: 1,
      modestbranding: 1,
      playsinline: 1,
      rel: 0,
      showinfo: 0,
    },
  };

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
      <div className="youtube-container">
        <YouTube
          videoId="PMry1WgSpaU"
          opts={opts}
          onReady={onReady}
          className="youtube-player"
        />
      </div>
    </div>
  );
}

export default Admin; 