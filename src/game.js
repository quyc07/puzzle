export const COLLISION_PENALTY_MS = 2000;

export function timeLimitForMaze(maze) {
  return Math.max(120000, maze.solution.length * 2200);
}

export function remainingTime(playState, now = Date.now()) {
  if (!playState.startedAt) {
    return playState.timeLimitMs;
  }

  const endTime = playState.completedAt ?? playState.failedAt ?? playState.abortedAt ?? now;
  const elapsed = endTime - playState.startedAt;
  return Math.max(0, playState.timeLimitMs - elapsed - playState.penaltyMs);
}

export function visibleCellsForFog(maze, path, radius = 1) {
  const visited = path.length > 0 ? path : [maze.entrance];
  const visible = new Set();

  for (const cell of visited) {
    for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
      for (let colOffset = -radius; colOffset <= radius; colOffset += 1) {
        const nearby = maze.cells.get(`${cell.row + rowOffset},${cell.col + colOffset}`);
        if (nearby) {
          visible.add(nearby.key);
        }
      }
    }
  }

  return visible;
}

export function directionFromSwipe(start, end, minimumDistance = 24) {
  const horizontalDistance = end.x - start.x;
  const verticalDistance = end.y - start.y;

  if (Math.max(Math.abs(horizontalDistance), Math.abs(verticalDistance)) < minimumDistance) {
    return null;
  }
  if (Math.abs(horizontalDistance) > Math.abs(verticalDistance)) {
    return horizontalDistance > 0 ? "E" : "W";
  }
  return verticalDistance > 0 ? "S" : "N";
}
