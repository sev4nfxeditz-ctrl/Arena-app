import { useEffect, useState } from 'react';

type Player = 'X' | 'O';
type SquareValue = Player | null;
type BoardState = SquareValue[];

const winningLines: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function calculateWinner(squares: BoardState): Player | null {
  for (const [a, b, c] of winningLines) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }

  return null;
}

const TicTacToe = () => {
  const [board, setBoard] = useState<BoardState>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const winner = calculateWinner(board);

  useEffect(() => {
    if (isXNext || winner || !board.includes(null)) {
      return undefined;
    }

    const emptyIndices = board.reduce<number[]>((indices, value, index) => {
      if (value === null) {
        indices.push(index);
      }

      return indices;
    }, []);

    const timeoutId = window.setTimeout(() => {
      const randomIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];

      setBoard((currentBoard) => {
        if (currentBoard[randomIndex] !== null || calculateWinner(currentBoard)) {
          return currentBoard;
        }

        const nextBoard = [...currentBoard];
        nextBoard[randomIndex] = 'O';
        return nextBoard;
      });
      setIsXNext(true);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [board, isXNext, winner]);

  const handleSquareClick = (index: number) => {
    if (!isXNext || board[index] || winner) {
      return;
    }

    const newBoard = [...board];
    newBoard[index] = 'X';
    setBoard(newBoard);
    setIsXNext(false);
  };

  return (
    <div>
      <h1>Tic Tac Toe</h1>
      <div className="board">
        {board.map((value, index) => (
          <button key={index} onClick={() => handleSquareClick(index)}>
            {value}
          </button>
        ))}
      </div>
      {winner ? <h2>Winner: {winner}</h2> : <h2>Next Player: {isXNext ? 'X' : 'O'}</h2>}
    </div>
  );
};

export default TicTacToe;
