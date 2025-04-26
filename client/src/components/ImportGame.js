import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ImportGame.css';

function ImportGame({ socket, setGameId }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const gameData = JSON.parse(e.target.result);
        validateGameData(gameData);
        createGame(gameData);
      } catch (error) {
        setError(error.message);
      }
    };
    reader.readAsText(file);
  };

  const validateGameData = (gameData) => {
    if (!gameData.questions || !Array.isArray(gameData.questions)) {
      throw new Error('El archivo debe contener un array de preguntas');
    }

    // Validar el ID de la sala si está presente
    if (gameData.roomId) {
      if (typeof gameData.roomId !== 'string' || gameData.roomId.length < 4) {
        throw new Error('El ID de la sala debe ser una cadena de al menos 4 caracteres');
      }
    }

    gameData.questions.forEach((question, index) => {
      if (!question.question || typeof question.question !== 'string') {
        throw new Error(`La pregunta ${index + 1} debe tener un texto`);
      }
      if (!question.options || !Array.isArray(question.options) || question.options.length !== 4) {
        throw new Error(`La pregunta ${index + 1} debe tener exactamente 4 opciones`);
      }
      if (typeof question.correctAnswer !== 'number' || question.correctAnswer < 0 || question.correctAnswer > 3) {
        throw new Error(`La pregunta ${index + 1} debe tener una respuesta correcta válida (0-3)`);
      }
      // Validar que help sea string si está presente
      if (question.help !== undefined && typeof question.help !== 'string') {
        throw new Error(`La ayuda de la pregunta ${index + 1} debe ser un texto`);
      }
    });
  };

  const createGame = (gameData) => {
    setIsLoading(true);
    setError('');
    
    socket.emit('createGame', gameData);
  };

  return (
    <div className="import-game-container">
      <h2>Importar Juego</h2>
      {error && <div className="error-message">{error}</div>}
      <div className="file-upload-container">
        <input
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="file-input"
          disabled={isLoading}
        />
        <p className="file-format-info">
          Formato del archivo JSON:
          <pre>
{`{
  "roomId": "SITH123", // Opcional: ID personalizado para la sala
  "questions": [
    {
      "question": "Pregunta 1",
      "help": "Subtítulo o ayuda opcional para la pregunta 1", // Opcional
      "options": ["Opción 1", "Opción 2", "Opción 3", "Opción 4"],
      "correctAnswer": 0
    },
    {
      "question": "Pregunta 2",
      "help": "Pista: Piensa en el lado oscuro de la fuerza", // Opcional
      "options": ["Opción 1", "Opción 2", "Opción 3", "Opción 4"],
      "correctAnswer": 1
    }
  ]
}`}
          </pre>
        </p>
      </div>
      {isLoading && <div className="loading-message">Creando juego...</div>}
    </div>
  );
}

export default ImportGame; 