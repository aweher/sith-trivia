import { useState, useEffect } from 'react';

const useSocketConnection = (socket) => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    const onConnect = () => {
      console.log('Socket connected');
      setIsConnected(true);
      setReconnectAttempts(0);
      setLastError(null);
    };

    const onDisconnect = (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      setLastError(reason);
    };

    const onConnectError = (error) => {
      console.error('Socket connection error:', error);
      setLastError(error.message);
      setReconnectAttempts(prev => prev + 1);
    };

    const onReconnect = (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
      setReconnectAttempts(0);
      setLastError(null);
    };

    const onReconnectAttempt = (attemptNumber) => {
      console.log('Socket reconnection attempt:', attemptNumber);
      setReconnectAttempts(attemptNumber);
    };

    const onReconnectError = (error) => {
      console.error('Socket reconnection error:', error);
      setLastError(error.message);
    };

    const onReconnectFailed = () => {
      console.error('Socket reconnection failed');
      setLastError('Failed to reconnect after multiple attempts');
    };

    // Configurar opciones de reconexión
    socket.io.opts.reconnection = true;
    socket.io.opts.reconnectionAttempts = 5;
    socket.io.opts.reconnectionDelay = 1000;
    socket.io.opts.reconnectionDelayMax = 5000;
    socket.io.opts.timeout = 20000;

    // Agregar listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('reconnect', onReconnect);
    socket.on('reconnect_attempt', onReconnectAttempt);
    socket.on('reconnect_error', onReconnectError);
    socket.on('reconnect_failed', onReconnectFailed);

    // Limpiar listeners al desmontar
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('reconnect', onReconnect);
      socket.off('reconnect_attempt', onReconnectAttempt);
      socket.off('reconnect_error', onReconnectError);
      socket.off('reconnect_failed', onReconnectFailed);
    };
  }, [socket]);

  const manualReconnect = () => {
    if (!isConnected) {
      socket.connect();
    }
  };

  return {
    isConnected,
    reconnectAttempts,
    lastError,
    manualReconnect
  };
};

export default useSocketConnection; 