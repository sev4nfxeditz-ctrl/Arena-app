// EloSystem.ts

/**
 * Calculates the ELO rating for players in a competitive environment.
 * @param playerRating - Current ELO rating of the player.
 * @param opponentRating - ELO rating of the opponent.
 * @param outcome - Outcome of the match (1 for a win, 0.5 for a draw, 0 for a loss).
 * @returns The updated ELO rating of the player.
 */
function calculateEloRating(playerRating: number, opponentRating: number, outcome: number): number {
    const kFactor = 32; // K-factor for rating adjustment
    const expectedOutcome = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    return playerRating + kFactor * (outcome - expectedOutcome);
}

/**
 * Calculates the rank based on the ELO rating.
 * @param eloRating - The ELO rating of the player.
 * @returns The rank category based on the ELO rating.
 */
function getRank(eloRating: number): string {
    if (eloRating < 1200) return 'Bronze';
    if (eloRating < 1600) return 'Silver';
    if (eloRating < 2000) return 'Gold';
    return 'Platinum';
}

// Example usage:
const playerElo = calculateEloRating(1500, 1400, 1);
const playerRank = getRank(playerElo);
console.log(`Updated Elo: ${playerElo}, Rank: ${playerRank}`);
