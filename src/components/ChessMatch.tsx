import { useMemo, useState } from 'react';
import { Chess, Square as ChessSquare } from 'chess.js';
import { Chessboard } from 'react-chessboard';

const ChessMatch = () => {
  const game = useMemo(() => new Chess(), []);
  const [fen, setFen] = useState(game.fen());

  const handlePieceDrop = (sourceSquare: ChessSquare, targetSquare: ChessSquare) => {
    const move = game.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    });

    if (move === null) {
      return false;
    }

    setFen(game.fen());
    return true;
  };

  return (
    <div>
      <Chessboard position={fen} onPieceDrop={handlePieceDrop} />
    </div>
  );
};

export default ChessMatch;