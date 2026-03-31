import React, { useEffect, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

const ChessMatch = () => {
    const [game, setGame] = useState(new Chess());
    const [fen, setFen] = useState(game.fen());

    useEffect(() => {
        const onDrop = (sourceSquare, targetSquare) => {
            const move = game.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: 'q' // always promote to queen for simplicity
            });

            // illegal move
            if (move === null) return;
            setFen(game.fen());
        };

        setGame(game);
    }, [game]);

    return (
        <div>
            <Chessboard
                position={fen}
                onDrop={onDrop}
            />
        </div>
    );
};

export default ChessMatch;