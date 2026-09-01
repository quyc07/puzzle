import assert from "node:assert/strict";
import test from "node:test";

import { attemptMove, findPath, generateMaze, mazeToSvg, validateMaze } from "../src/maze.js";

test("all supported shapes and difficulties produce valid mazes", () => {
  for (const shape of ["triangle", "square", "circle", "heart", "star"]) {
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
          assert.equal(maze.center.row, (size - 1) / 2);
          assert.equal(maze.center.col, (size - 1) / 2);

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

test("star rasterization stays connected at edge-case sizes", () => {
  for (const size of [11, 20, 48, 57]) {
    const maze = generateMaze({ shape: "star", size, seed: 42, goalMode: "through" });
    assert.equal(validateMaze(maze).connected, true, `star/${size} must be connected`);
  }
});

test("SVG can include the solution path", () => {
  const maze = generateMaze({ shape: "square", size: 15, seed: 9 });

  assert.doesNotMatch(mazeToSvg(maze), /<polyline/);
  assert.match(mazeToSvg(maze, { showSolution: true }), /<polyline/);
});

test("player movement respects passages and walls", () => {
  const maze = generateMaze({ shape: "square", size: 15, seed: 9 });
  const [current, next] = maze.solution;
  const dr = next.row - current.row;
  const dc = next.col - current.col;
  const direction = dr === -1 ? "N" : dr === 1 ? "S" : dc === 1 ? "E" : "W";
  const validMove = attemptMove(maze, current, direction);

  assert.equal(validMove.moved, true);
  assert.equal(validMove.cell, next);

  const blockedDirection = Object.entries(current.walls).find(([, hasWall]) => hasWall)?.[0];
  if (blockedDirection) {
    const blockedMove = attemptMove(maze, current, blockedDirection);
    assert.equal(blockedMove.moved, false);
    assert.equal(blockedMove.cell, current);
  }
});

test("SVG renders player position and trail", () => {
  const maze = generateMaze({ shape: "circle", size: 15, seed: 11 });
  const svg = mazeToSvg(maze, { playerPath: maze.solution.slice(0, 3) });

  assert.match(svg, /id="player-trail"/);
  assert.match(svg, /id="maze-player"/);
});

test("SVG fog hides unexplored cells but leaves the player visible", () => {
  const maze = generateMaze({ shape: "square", size: 15, seed: 11 });
  const visible = new Set([maze.entrance.key]);
  const svg = mazeToSvg(maze, { playerPath: [maze.entrance], fogVisibleKeys: visible });
  const revealedSvg = mazeToSvg(maze, { fogVisibleKeys: new Set([maze.target.key]) });
  const fogCellCount = svg.match(/class="fog-cell"/g)?.length ?? 0;
  const firstFogCell = svg.match(/class="fog-cell" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/);

  assert.match(svg, /id="fog-overlay"/);
  assert.match(svg, /id="fog-glass"/);
  assert.match(svg, /id="fog-frost"/);
  assert.match(svg, /<feTurbulence/);
  assert.equal(svg.match(/stop-opacity="1"/g)?.length, 3);
  assert.ok(Number(firstFogCell[1]) < 38.4);
  assert.ok(Number(firstFogCell[3]) > 24);
  assert.equal(fogCellCount, maze.cells.size - 1);
  assert.ok(svg.indexOf('id="fog-overlay"') < svg.indexOf('id="maze-player"'));
  assert.doesNotMatch(svg, /id="maze-target"/);
  assert.doesNotMatch(svg, />出口<\/text>/);
  assert.match(revealedSvg, /id="maze-target"/);
  assert.match(revealedSvg, />出口<\/text>/);
});

test("treasure escape has paths to the center and then the exit", () => {
  const maze = generateMaze({ shape: "circle", size: 15, seed: 27, goalMode: "through" });
  const toTreasure = findPath(maze, maze.entrance, maze.center);
  const toExit = findPath(maze, maze.center, maze.target);
  const svg = mazeToSvg(maze, {
    treasureCell: maze.center,
    targetLocked: true,
    solutionPath: [...toTreasure, ...toExit.slice(1)],
  });

  assert.equal(toTreasure[0], maze.entrance);
  assert.equal(toTreasure.at(-1), maze.center);
  assert.equal(toExit[0], maze.center);
  assert.equal(toExit.at(-1), maze.target);
  assert.match(svg, /id="maze-treasure"/);
  assert.match(svg, />锁定<\/text>/);
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
  assert.throws(() => generateMaze({ shape: "unknown" }), /Unsupported shape/);
});
