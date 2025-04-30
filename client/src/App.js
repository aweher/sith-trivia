import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import io from 'socket.io-client';
import Home from './components/Home';
import ImportGame from './components/ImportGame';
import JoinGame from './components/JoinGame';
import GameRoom from './components/GameRoom';
import Admin from './components/Admin';
import MatomoTracker from './components/MatomoTracker';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_SOCKET_URL || 'https://trivia-backend.sith.app';
const socket = io(BACKEND_URL, {
  withCredentials: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
});

function App() {
  const [gameId, setGameId] = useState(null);
  const [playerName, setPlayerName] = useState('');

  return (
    <Router>
      <MatomoTracker />
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/import" element={<ImportGame socket={socket} setGameId={setGameId} />} />
          <Route path="/join" element={<JoinGame socket={socket} setGameId={setGameId} setPlayerName={setPlayerName} />} />
          <Route path="/game/:gameId" element={<GameRoom socket={socket} gameId={gameId} playerName={playerName} />} />
          <Route path="/admin" element={<Admin socket={socket} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
