import assert from "node:assert/strict";
import test from "node:test";

import { COLLISION_PENALTY_MS, remainingTime, timeLimitForMaze, visibleCellsForFog } from "../src/game.js";
import { generateMaze } from "../src/maze.js";

test("time challenge limit scales with maze solution length", () => {
  assert.equal(timeLimitForMaze({ solution: new Array(10) }), 45000);
  assert.equal(timeLimitForMaze({ solution: new Array(100) }), 90000);
});

test("remaining time includes elapsed time and collision penalties", () => {
  const state = {
    startedAt: 1000,
    completedAt: null,
    failedAt: null,
    abortedAt: null,
    timeLimitMs: 60000,
    penaltyMs: COLLISION_PENALTY_MS * 2,
  };

  assert.equal(remainingTime(state, 11000), 46000);
  assert.equal(remainingTime({ ...state, failedAt: 70000 }, 80000), 0);
  assert.equal(remainingTime({ ...state, abortedAt: 6000 }, 50000), 51000);
});

test("fog reveals nearby cells and preserves previously explored areas", () => {
  const maze = generateMaze({ shape: "square", size: 15, seed: 18 });
  const initial = visibleCellsForFog(maze, []);
  const explored = visibleCellsForFog(maze, maze.solution.slice(0, 4));

  assert.ok(initial.has(maze.entrance.key));
  assert.ok(initial.size < maze.cells.size);
  assert.ok([...initial].every((key) => explored.has(key)));
  assert.ok(explored.size > initial.size);
});
