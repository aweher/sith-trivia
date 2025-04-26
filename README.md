# Sith Kahoot

A real-time quiz game application inspired by Kahoot, built with React, Node.js, and Socket.IO.

## Features

- Create custom quiz games with multiple questions
- Real-time multiplayer functionality
- Score tracking and leaderboard
- Timer for each question
- Beautiful and responsive UI

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/sith-kahoot.git
cd sith-kahoot
```

2. Install server dependencies:
```bash
npm install
```

3. Install client dependencies:
```bash
cd client
npm install
cd ..
```

## Running the Application

1. Start the server:
```bash
npm run dev
```

2. In a new terminal, start the client:
```bash
npm run client
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## How to Play

1. Create a Game:
   - Click "Create Game" on the home page
   - Add questions with multiple choice answers
   - Set the correct answer for each question
   - Click "Create Game" to generate a game ID

2. Join a Game:
   - Click "Join Game" on the home page
   - Enter the game ID and your name
   - Click "Join Game" to enter the game room

3. Playing the Game:
   - Wait for all players to join
   - Questions will appear one at a time
   - Select your answer before the timer runs out
   - Points are awarded based on correct answers and speed
   - The player with the most points at the end wins!

## Technologies Used

- Frontend:
  - React
  - React Router
  - Socket.IO Client
  - CSS3

- Backend:
  - Node.js
  - Express
  - Socket.IO
  - CORS

## License

MIT 