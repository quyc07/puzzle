import assert from "node:assert/strict";
import test from "node:test";

import { generateMaze, mazeToSvg, validateMaze } from "../src/maze.js";

test("all supported shapes and difficulties produce valid mazes", () => {
  for (const shape of ["triangle", "square", "circle"]) {
    for (const size of [15, 23, 31]) {
      for (const goalMode of ["center", "through"]) {
        for (const seed of [0, 1, 42, 0xffffffff]) {
          const maze = generateMaze({ shape, size, seed, goalMode });
          const validation = validateMaze(maze);

          assert.equal(validation.connected, true, `${shape}/${size}/${goalMode}/${seed} must be connected`);
          assert.equal(validation.perfect, true, `${shape}/${size}/${goalMode}/${seed} must have one solution`);
          assert.equal(validation.boundaryOpenings, goalMode === "center" ? 1 : 2);
          assert.ok(validation.solutionLength > 1);
          assert.equal(maze.solution[0], maze.entrance);
          assert.equal(maze.solution.at(-1), maze.target);

          if (goalMode === "center") {
            assert.equal(maze.target.row, (size - 1) / 2);
            assert.equal(maze.target.col, (size - 1) / 2);
          } else {
            assert.equal(maze.entrance.row, Math.max(...[...maze.cells.values()].map((cell) => cell.row)));
            assert.equal(maze.target.row, Math.min(...[...maze.cells.values()].map((cell) => cell.row)));
          }
        }
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

test("SVG labels the selected goal mode", () => {
  const centerMaze = generateMaze({ shape: "circle", size: 15, seed: 9, goalMode: "center" });
  const throughMaze = generateMaze({ shape: "circle", size: 15, seed: 9, goalMode: "through" });

  assert.match(mazeToSvg(centerMaze), />终点<\/text>/);
  assert.match(mazeToSvg(throughMaze), />出口<\/text>/);
});

test("SVG embeds visible and machine-readable reproduction data", () => {
  const maze = generateMaze({ shape: "triangle", size: 23, seed: 123456, goalMode: "center" });
  const svg = mazeToSvg(maze);

  assert.match(svg, /随机种子 123456 · 三角形 · 23×23 · 中心终点 · V1/);
  assert.match(svg, />SEED · 123456<\/text>/);
  assert.doesNotMatch(svg, /id="maze-watermark"/);
  assert.match(svg, /width="628\.8" height="656\.4" viewBox="0 0 628\.8 656\.4"/);
  assert.match(svg, /data-maze-seed="123456"/);
  assert.match(svg, /data-maze-shape="triangle"/);
  assert.match(svg, /data-maze-size="23"/);
  assert.match(svg, /data-maze-goal-mode="center"/);
  assert.match(svg, /<metadata id="maze-reproduction">\{"version":1,"seed":123456/);
});

test("invalid size is rejected", () => {
  assert.throws(() => generateMaze({ size: 5 }), /between 7 and 61/);
  assert.throws(() => generateMaze({ goalMode: "unknown" }), /center or through/);
});
