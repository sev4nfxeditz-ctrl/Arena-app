import React, { useState, useEffect } from 'react';

const TicTacToe = () => {
    const [board, setBoard] = useState(Array(9).fill(null));
    const [isXNext, setIsXNext] = useState(true);
    const winner = calculateWinner(board);

    useEffect(() => {
        if (!winner && !board.includes(null)) {
            // AI move if there is no winner
            const emptyIndices = board.map((val, index) => val === null ? index : null).filter(index => index !== null);
            if (emptyIndices.length > 0) {
                const randomIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
                handleSquareClick(randomIndex);
            }
        }
    }, [board]);

    const handleSquareClick = (index) => {
        if (!board[index] && !winner) {
            const newBoard = board.slice();
            newBoard[index] = isXNext ? 'X' : 'O';
            setBoard(newBoard);
            setIsXNext(!isXNext);
        }
    };

    const calculateWinner = (squares) => {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        for (let i = 0; i < lines.length; i++) {
            const [a, b, c] = lines[i];
            if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
                return squares[a];
            }
        }
        return null;
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