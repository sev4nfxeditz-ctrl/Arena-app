import { query } from '../config/database';
import { ELO_DEFAULTS } from '../../../shared/constants';
import { getRankForElo } from '../../../shared/constants';

/**
 * Get K-factor based on player's rating and games played.
 * New players have higher K for faster calibration.
 * Masters have lower K for stability.
 */
export function getKFactor(rating: number, gamesPlayed: number): number {
  if (gamesPlayed < ELO_DEFAULTS.NEW_PLAYER_THRESHOLD) return ELO_DEFAULTS.K_FACTOR_NEW;
  if (rating >= ELO_DEFAULTS.MASTER_THRESHOLD) return ELO_DEFAULTS.K_FACTOR_MASTER;
  return ELO_DEFAULTS.K_FACTOR_STANDARD;
}

/** Standard ELO expected score formula */
export function expectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/** Calculate new ratings for both players after a match */
export function calculateNewRatings(
  winnerRating: number, loserRating: number,
  winnerGames: number, loserGames: number,
  isDraw: boolean
): { newWinnerRating: number; newLoserRating: number; winnerChange: number; loserChange: number } {
  const winnerK = getKFactor(winnerRating, winnerGames);
  const loserK = getKFactor(loserRating, loserGames);

  const winnerExpected = expectedScore(winnerRating, loserRating);
  const loserExpected = expectedScore(loserRating, winnerRating);

  const winnerScore = isDraw ? 0.5 : 1;
  const loserScore = isDraw ? 0.5 : 0;

  const winnerChange = Math.round(winnerK * (winnerScore - winnerExpected));
  const loserChange = Math.round(loserK * (loserScore - loserExpected));

  return {
    newWinnerRating: winnerRating + winnerChange,
    newLoserRating: Math.max(100, loserRating + loserChange), // Floor at 100
    winnerChange,
    loserChange,
  };
}

/** Update ratings in database after a match */
export async function updatePlayerRatings(
  player1Id: string, player2Id: string,
  gameType: string, winnerId: string | null // null = draw
): Promise<{ p1Before: number; p1After: number; p2Before: number; p2After: number }> {
  // Get current ratings
  const p1Rating = await query(
    'SELECT elo_rating, total_games, wins, losses, draws, win_streak, best_streak FROM player_ratings WHERE user_id = $1 AND game_type = $2',
    [player1Id, gameType]
  );
  const p2Rating = await query(
    'SELECT elo_rating, total_games, wins, losses, draws, win_streak, best_streak FROM player_ratings WHERE user_id = $1 AND game_type = $2',
    [player2Id, gameType]
  );

  const p1 = p1Rating.rows[0];
  const p2 = p2Rating.rows[0];

  const isDraw = winnerId === null;
  let p1IsWinner = winnerId === player1Id;
  let p2IsWinner = winnerId === player2Id;

  // Calculate new ratings
  let result;
  if (isDraw) {
    result = calculateNewRatings(p1.elo_rating, p2.elo_rating, p1.total_games, p2.total_games, true);
  } else if (p1IsWinner) {
    result = calculateNewRatings(p1.elo_rating, p2.elo_rating, p1.total_games, p2.total_games, false);
  } else {
    // p2 is winner, swap order
    const r = calculateNewRatings(p2.elo_rating, p1.elo_rating, p2.total_games, p1.total_games, false);
    result = {
      newWinnerRating: p1.elo_rating + (-r.loserChange + r.loserChange), // recalculate for p1 as loser
      newLoserRating: 0,
      winnerChange: 0,
      loserChange: 0,
    };
    // Actually, recalculate correctly
    const p1Expected = expectedScore(p1.elo_rating, p2.elo_rating);
    const p2Expected = expectedScore(p2.elo_rating, p1.elo_rating);
    const p1K = getKFactor(p1.elo_rating, p1.total_games);
    const p2K = getKFactor(p2.elo_rating, p2.total_games);

    const p1Change = Math.round(p1K * (0 - p1Expected)); // p1 lost
    const p2Change = Math.round(p2K * (1 - p2Expected)); // p2 won

    result = {
      newWinnerRating: Math.max(100, p1.elo_rating + p1Change),
      newLoserRating: p2.elo_rating + p2Change,
      winnerChange: p1Change,
      loserChange: p2Change,
    };
  }

  // Recalculate cleanly
  const p1Expected = expectedScore(p1.elo_rating, p2.elo_rating);
  const p2Expected = expectedScore(p2.elo_rating, p1.elo_rating);
  const p1K = getKFactor(p1.elo_rating, p1.total_games);
  const p2K = getKFactor(p2.elo_rating, p2.total_games);

  const p1Score = isDraw ? 0.5 : p1IsWinner ? 1 : 0;
  const p2Score = isDraw ? 0.5 : p2IsWinner ? 1 : 0;

  const p1Change = Math.round(p1K * (p1Score - p1Expected));
  const p2Change = Math.round(p2K * (p2Score - p2Expected));

  const p1After = Math.max(100, p1.elo_rating + p1Change);
  const p2After = Math.max(100, p2.elo_rating + p2Change);

  const p1Rank = getRankForElo(p1After).tier;
  const p2Rank = getRankForElo(p2After).tier;

  // Update player 1
  const p1WinStreak = p1IsWinner ? (p1.win_streak + 1) : 0;
  const p1BestStreak = Math.max(p1.best_streak, p1WinStreak);

  await query(
    `UPDATE player_ratings SET 
      elo_rating = $1, peak_rating = GREATEST(peak_rating, $1),
      wins = wins + $2, losses = losses + $3, draws = draws + $4,
      total_games = total_games + 1, win_streak = $5, best_streak = $6,
      rank_tier = $7, updated_at = NOW()
    WHERE user_id = $8 AND game_type = $9`,
    [p1After, p1IsWinner ? 1 : 0, p2IsWinner ? 1 : 0, isDraw ? 1 : 0,
     p1WinStreak, p1BestStreak, p1Rank, player1Id, gameType]
  );

  // Update player 2
  const p2WinStreak = p2IsWinner ? (p2.win_streak + 1) : 0;
  const p2BestStreak = Math.max(p2.best_streak, p2WinStreak);

  await query(
    `UPDATE player_ratings SET 
      elo_rating = $1, peak_rating = GREATEST(peak_rating, $1),
      wins = wins + $2, losses = losses + $3, draws = draws + $4,
      total_games = total_games + 1, win_streak = $5, best_streak = $6,
      rank_tier = $7, updated_at = NOW()
    WHERE user_id = $8 AND game_type = $9`,
    [p2After, p2IsWinner ? 1 : 0, p1IsWinner ? 1 : 0, isDraw ? 1 : 0,
     p2WinStreak, p2BestStreak, p2Rank, player2Id, gameType]
  );

  return {
    p1Before: p1.elo_rating,
    p1After,
    p2Before: p2.elo_rating,
    p2After,
  };
}
