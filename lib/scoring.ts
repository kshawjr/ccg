import { ROWS } from './data';
import type { Color, Responses, Scores } from './types';

export function emptyResponses(): Responses {
  return Array.from({ length: 6 }, () => [null, null, null, null]);
}

/** True if every row is a permutation of [1,2,3,4]. */
export function isComplete(responses: Responses): boolean {
  if (!Array.isArray(responses) || responses.length !== 6) return false;
  for (const row of responses) {
    if (!Array.isArray(row) || row.length !== 4) return false;
    const sorted = [...row].sort();
    if (sorted[0] !== 1 || sorted[1] !== 2 || sorted[2] !== 3 || sorted[3] !== 4) {
      return false;
    }
  }
  return true;
}

/** True if responses has the right shape (6x4) with ints 1..4 or nulls. */
export function isValidShape(responses: unknown): responses is Responses {
  if (!Array.isArray(responses) || responses.length !== 6) return false;
  for (const row of responses) {
    if (!Array.isArray(row) || row.length !== 4) return false;
    for (const cell of row) {
      if (cell === null) continue;
      if (typeof cell !== 'number') return false;
      if (!Number.isInteger(cell)) return false;
      if (cell < 1 || cell > 4) return false;
    }
    // No duplicates among non-null values.
    const seen = new Set<number>();
    for (const cell of row) {
      if (cell === null) continue;
      if (seen.has(cell)) return false;
      seen.add(cell);
    }
  }
  return true;
}

export function calculateScores(responses: Responses): Scores {
  const scores: Scores = { orange: 0, blue: 0, gold: 0, green: 0 };
  for (let r = 0; r < ROWS.length; r++) {
    const row = ROWS[r];
    const ranks = responses[r];
    for (let c = 0; c < 4; c++) {
      const rank = ranks[c];
      if (rank === null) continue;
      scores[row[c].color] += rank;
    }
  }
  return scores;
}

export function primaryColor(scores: Scores): Color {
  const order: Color[] = ['orange', 'blue', 'gold', 'green'];
  let best: Color = 'orange';
  let bestScore = -Infinity;
  for (const c of order) {
    if (scores[c] > bestScore) {
      best = c;
      bestScore = scores[c];
    }
  }
  return best;
}
