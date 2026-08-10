import assert from "node:assert/strict";
import test from "node:test";

import { generateMaze, mazeToSvg, validateMaze } from "../src/maze.js";

test("all supported shapes and difficulties produce valid mazes", () => {
  for (const shape of ["triangle", "square", "circle"]) {
    for (const size of [15, 23, 31]) {
      for (const seed of [0, 1, 42, 0xffffffff]) {
        const maze = generateMaze({ shape, size, seed });
        const validation = validateMaze(maze);

        assert.equal(validation.connected, true, `${shape}/${size}/${seed} must be connected`);
        assert.equal(validation.perfect, true, `${shape}/${size}/${seed} must have one solution`);
        assert.ok(validation.solutionLength > 1);
        assert.equal(maze.solution[0], maze.entrance);
        assert.equal(maze.solution.at(-1), maze.goal);
      }
    }
  }
});

test("the same seed produces the same maze", () => {
  const first = mazeToSvg(generateMaze({ shape: "circle", size: 15, seed: 7 }));
  const second = mazeToSvg(generateMaze({ shape: "circle", size: 15, seed: 7 }));

  assert.equal(first, second);
});

test("SVG can include the solution path", () => {
  const maze = generateMaze({ shape: "square", size: 15, seed: 9 });

  assert.doesNotMatch(mazeToSvg(maze), /<polyline/);
  assert.match(mazeToSvg(maze, { showSolution: true }), /<polyline/);
});

test("invalid size is rejected", () => {
  assert.throws(() => generateMaze({ size: 5 }), /between 7 and 61/);
});
