import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './CreateGame.css';

function CreateGame({ socket, setGameId }) {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([
    { question: '', options: ['', '', '', ''], correctAnswer: 0 }
  ]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Listen for game creation response
    socket.on('gameCreated', ({ gameId }) => {
      console.log('Game created with ID:', gameId);
      setGameId(gameId);
      navigate(`/game/${gameId}`);
    });

    // Listen for errors from the server
    socket.on('error', ({ message }) => {
      console.error('Server error:', message);
      setError(message);
      setIsLoading(false);
    });

    return () => {
      socket.off('gameCreated');
      socket.off('error');
    };
  }, [socket, navigate, setGameId]);

  const addQuestion = () => {
    setQuestions([...questions, { question: '', options: ['', '', '', ''], correctAnswer: 0 }]);
  };

  const updateQuestion = (index, field, value) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };

  const updateOption = (questionIndex, optionIndex, value) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options[optionIndex] = value;
    setQuestions(newQuestions);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    // Validate that all questions and options are filled
    const isValid = questions.every(q => 
      q.question.trim() !== '' && 
      q.options.every(opt => opt.trim() !== '')
    );

    if (!isValid) {
      setError('Por favor, completa todas las preguntas y opciones');
      setIsLoading(false);
      return;
    }

    // Emit createGame event
    console.log('Emitting createGame event with questions:', questions);
    socket.emit('createGame', { questions });
  };

  return (
    <div className="create-game-container">
      <h2>Crear un Nuevo Juego</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        {questions.map((q, index) => (
          <div key={index} className="question-container">
            <input
              type="text"
              placeholder="Pregunta"
              value={q.question}
              onChange={(e) => updateQuestion(index, 'question', e.target.value)}
              required
            />
            {q.options.map((option, optIndex) => (
              <div key={optIndex} className="option-container">
                <input
                  type="text"
                  placeholder={`Opción ${optIndex + 1}`}
                  value={option}
                  onChange={(e) => updateOption(index, optIndex, e.target.value)}
                  required
                />
                <input
                  type="radio"
                  name={`correct-${index}`}
                  checked={q.correctAnswer === optIndex}
                  onChange={() => updateQuestion(index, 'correctAnswer', optIndex)}
                />
              </div>
            ))}
          </div>
        ))}
        <button type="button" onClick={addQuestion} className="add-question" disabled={isLoading}>
          Añadir Pregunta
        </button>
        <button type="submit" className="create-game" disabled={isLoading}>
          {isLoading ? 'Creando Juego...' : 'Crear Juego'}
        </button>
      </form>
    </div>
  );
}

export default CreateGame; 