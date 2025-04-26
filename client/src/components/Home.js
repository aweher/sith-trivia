import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

function Home() {
  return (
    <div className="home-container">
      <h1>¡Bienvenido a Sith Trivia!</h1>
      <div className="button-container">
        <Link to="/join" className="home-button join">
          Unirse a Juego
        </Link>
      </div>
    </div>
  );
}

export default Home; 