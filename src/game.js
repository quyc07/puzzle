export const COLLISION_PENALTY_MS = 2000;

export function timeLimitForMaze(maze) {
  return Math.max(45000, maze.solution.length * 900);
}

export function remainingTime(playState, now = Date.now()) {
  if (!playState.startedAt) {
    return playState.timeLimitMs;
  }

  const endTime = playState.completedAt ?? playState.failedAt ?? playState.abortedAt ?? now;
  const elapsed = endTime - playState.startedAt;
  return Math.max(0, playState.timeLimitMs - elapsed - playState.penaltyMs);
}
