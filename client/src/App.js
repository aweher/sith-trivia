import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import io from 'socket.io-client';
import Home from './components/Home';
import ImportGame from './components/ImportGame';
import JoinGame from './components/JoinGame';
import GameRoom from './components/GameRoom';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_API_URL || 'http://localhost:55005';
const socket = io(BACKEND_URL);

function App() {
  const [gameId, setGameId] = useState(null);
  const [playerName, setPlayerName] = useState('');

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/import" element={<ImportGame socket={socket} setGameId={setGameId} />} />
          <Route path="/join" element={<JoinGame socket={socket} setGameId={setGameId} setPlayerName={setPlayerName} />} />
          <Route path="/game/:gameId" element={<GameRoom socket={socket} gameId={gameId} playerName={playerName} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
