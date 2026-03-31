import React, { useState } from 'react';
import TicTacToe from './components/TicTacToe';
import ChessMatch from './components/ChessMatch';
import WorldChat from './components/WorldChat';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="arena-app">
      <header>
        <h1>⚡ BOT ARENA PRO ⚡</h1>
        <nav>
          <button onClick={() => setActiveTab('dashboard')}>Dashboard</button>
          <button onClick={() => setActiveTab('tictactoe')}>Tic Tac Toe</button>
          <button onClick={() => setActiveTab('chess')}>Chess</button>
          <button onClick={() => setActiveTab('chat')}>World Chat</button>
        </nav>
      </header>

      <main>
        {activeTab === 'dashboard' && <div><h2>Welcome to Arena Pro</h2></div>}
        {activeTab === 'tictactoe' && <TicTacToe />}
        {activeTab === 'chess' && <ChessMatch />}
        {activeTab === 'chat' && <WorldChat />}
      </main>
    </div>
  );
}

export default App;