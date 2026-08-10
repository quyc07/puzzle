const DIRECTIONS = [
  { name: "N", dr: -1, dc: 0, opposite: "S" },
  { name: "E", dr: 0, dc: 1, opposite: "W" },
  { name: "S", dr: 1, dc: 0, opposite: "N" },
  { name: "W", dr: 0, dc: -1, opposite: "E" },
];

const keyOf = (row, col) => `${row},${col}`;

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function isInsideShape(shape, row, col, size) {
  if (shape === "square") {
    return true;
  }

  const center = (size - 1) / 2;
  const x = (col - center) / (size / 2);
  const y = (row - center) / (size / 2);

  if (shape === "circle") {
    return x * x + y * y <= 1;
  }

  if (shape === "triangle") {
    const progress = row / (size - 1);
    return Math.abs(col - center) <= progress * size / 2;
  }

  throw new Error(`Unsupported shape: ${shape}`);
}

function createCells(shape, size) {
  const cells = new Map();
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (isInsideShape(shape, row, col, size)) {
        const key = keyOf(row, col);
        cells.set(key, {
          key,
          row,
          col,
          walls: { N: true, E: true, S: true, W: true },
        });
      }
    }
  }
  return cells;
}

function neighborsOf(cell, cells) {
  return DIRECTIONS.flatMap((direction) => {
    const neighbor = cells.get(keyOf(cell.row + direction.dr, cell.col + direction.dc));
    return neighbor ? [{ cell: neighbor, direction }] : [];
  });
}

function closestToCenter(cells, size) {
  const center = (size - 1) / 2;
  return [...cells.values()].reduce((best, cell) => {
    const distance = (cell.row - center) ** 2 + (cell.col - center) ** 2;
    return !best || distance < best.distance ? { cell, distance } : best;
  }, null).cell;
}

function carveMaze(cells, start, random) {
  const visited = new Set([start.key]);
  const stack = [start];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const options = neighborsOf(current, cells)
      .filter(({ cell }) => !visited.has(cell.key));

    if (options.length === 0) {
      stack.pop();
      continue;
    }

    const choice = options[Math.floor(random() * options.length)];
    current.walls[choice.direction.name] = false;
    choice.cell.walls[choice.direction.opposite] = false;
    visited.add(choice.cell.key);
    stack.push(choice.cell);
  }
}

function openNeighbors(cell, cells) {
  return DIRECTIONS.flatMap((direction) => {
    if (cell.walls[direction.name]) {
      return [];
    }
    const neighbor = cells.get(keyOf(cell.row + direction.dr, cell.col + direction.dc));
    return neighbor ? [neighbor] : [];
  });
}

function distancesFrom(start, cells) {
  const distances = new Map([[start.key, 0]]);
  const previous = new Map();
  const queue = [start];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const neighbor of openNeighbors(current, cells)) {
      if (!distances.has(neighbor.key)) {
        distances.set(neighbor.key, distances.get(current.key) + 1);
        previous.set(neighbor.key, current.key);
        queue.push(neighbor);
      }
    }
  }

  return { distances, previous };
}

function outsideDirections(cell, cells) {
  return DIRECTIONS.filter((direction) => (
    !cells.has(keyOf(cell.row + direction.dr, cell.col + direction.dc))
  ));
}

function chooseCenterEntrance(target, cells) {
  const { distances } = distancesFrom(target, cells);
  const boundaryCells = [...cells.values()].filter((cell) => outsideDirections(cell, cells).length > 0);
  const entrance = boundaryCells.reduce((best, cell) => (
    !best || distances.get(cell.key) > distances.get(best.key) ? cell : best
  ), null);
  const opening = outsideDirections(entrance, cells)[0];

  entrance.walls[opening.name] = false;
  return { entrance, entranceDirection: opening.name };
}

function chooseEndpoints(cells) {
  const allCells = [...cells.values()];
  const topRow = Math.min(...allCells.map((cell) => cell.row));
  const bottomRow = Math.max(...allCells.map((cell) => cell.row));
  const exits = allCells.filter((cell) => cell.row === topRow);
  const entrances = allCells.filter((cell) => cell.row === bottomRow);
  let bestPair;

  for (const entrance of entrances) {
    const { distances } = distancesFrom(entrance, cells);
    for (const exit of exits) {
      const distance = distances.get(exit.key);
      if (!bestPair || distance > bestPair.distance) {
        bestPair = { entrance, exit, distance };
      }
    }
  }

  bestPair.entrance.walls.S = false;
  bestPair.exit.walls.N = false;
  return {
    entrance: bestPair.entrance,
    entranceDirection: "S",
    exit: bestPair.exit,
    exitDirection: "N",
  };
}

function solve(entrance, target, cells) {
  const { previous } = distancesFrom(entrance, cells);
  const path = [];
  let currentKey = target.key;

  while (currentKey) {
    path.push(cells.get(currentKey));
    if (currentKey === entrance.key) {
      return path.reverse();
    }
    currentKey = previous.get(currentKey);
  }

  throw new Error("Maze has no solution");
}

export function generateMaze({
  shape = "circle",
  size = 21,
  seed = Date.now(),
  goalMode = "through",
} = {}) {
  if (!Number.isInteger(size) || size < 7 || size > 61) {
    throw new Error("size must be an integer between 7 and 61");
  }
  if (!["center", "through"].includes(goalMode)) {
    throw new Error("goalMode must be center or through");
  }

  const normalizedSeed = Number(seed) >>> 0;
  const cells = createCells(shape, size);
  const start = goalMode === "center" ? closestToCenter(cells, size) : cells.values().next().value;
  carveMaze(cells, start, mulberry32(normalizedSeed));
  const endpoints = goalMode === "center"
    ? { ...chooseCenterEntrance(start, cells), target: start, targetDirection: null }
    : (() => {
      const { entrance, entranceDirection, exit, exitDirection } = chooseEndpoints(cells);
      return { entrance, entranceDirection, target: exit, targetDirection: exitDirection };
    })();
  const solution = solve(endpoints.entrance, endpoints.target, cells);

  return {
    shape,
    size,
    seed: normalizedSeed,
    goalMode,
    cells,
    ...endpoints,
    solution,
  };
}

export function validateMaze(maze) {
  const { distances } = distancesFrom(maze.entrance, maze.cells);
  const passageCount = [...maze.cells.values()].reduce((count, cell) => {
    const eastIsPassage = !cell.walls.E && maze.cells.has(keyOf(cell.row, cell.col + 1));
    const southIsPassage = !cell.walls.S && maze.cells.has(keyOf(cell.row + 1, cell.col));
    return count + (eastIsPassage ? 1 : 0) + (southIsPassage ? 1 : 0);
  }, 0);

  return {
    connected: distances.size === maze.cells.size,
    perfect: passageCount === maze.cells.size - 1,
    boundaryOpenings: [...maze.cells.values()].reduce((count, cell) => (
      count + outsideDirections(cell, maze.cells)
        .filter((direction) => !cell.walls[direction.name]).length
    ), 0),
    solutionLength: maze.solution.length,
  };
}

export function attemptMove(maze, current, directionName) {
  const direction = DIRECTIONS.find((candidate) => candidate.name === directionName);
  if (!direction) {
    throw new Error(`Unsupported direction: ${directionName}`);
  }
  if (current.walls[direction.name]) {
    return { cell: current, moved: false };
  }

  const next = maze.cells.get(keyOf(current.row + direction.dr, current.col + direction.dc));
  return next ? { cell: next, moved: true } : { cell: current, moved: false };
}

export function mazeToSvg(maze, {
  showSolution = false,
  cellSize = 24,
  playerPath = [],
} = {}) {
  const padding = cellSize * 1.6;
  const extent = maze.size * cellSize;
  const width = extent + padding * 2;
  const height = width + cellSize * 1.15;
  const lineWidth = Math.max(2, cellSize * 0.11);
  const segments = new Set();

  const addSegment = (x1, y1, x2, y2) => {
    const first = `${x1},${y1}`;
    const second = `${x2},${y2}`;
    segments.add(first < second ? `${first} ${second}` : `${second} ${first}`);
  };

  for (const cell of maze.cells.values()) {
    const x = padding + cell.col * cellSize;
    const y = padding + cell.row * cellSize;
    if (cell.walls.N) addSegment(x, y, x + cellSize, y);
    if (cell.walls.E) addSegment(x + cellSize, y, x + cellSize, y + cellSize);
    if (cell.walls.S) addSegment(x, y + cellSize, x + cellSize, y + cellSize);
    if (cell.walls.W) addSegment(x, y, x, y + cellSize);
  }

  const wallLines = [...segments].map((segment) => {
    const [first, second] = segment.split(" ");
    const [x1, y1] = first.split(",");
    const [x2, y2] = second.split(",");
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
  }).join("");

  const centerOf = (cell) => ({
    x: padding + (cell.col + 0.5) * cellSize,
    y: padding + (cell.row + 0.5) * cellSize,
  });
  const directionOf = (name) => DIRECTIONS.find((direction) => direction.name === name);
  const extendOutside = (cell, directionName) => {
    const point = centerOf(cell);
    const direction = directionOf(directionName);
    return {
      x: point.x + direction.dc * cellSize,
      y: point.y + direction.dr * cellSize,
    };
  };
  const target = centerOf(maze.target);
  const entrance = centerOf(maze.entrance);
  const entranceOutside = extendOutside(maze.entrance, maze.entranceDirection);
  const solutionPoints = [
    `${entranceOutside.x},${entranceOutside.y}`,
    ...maze.solution
    .map((cell) => {
      const point = centerOf(cell);
      return `${point.x},${point.y}`;
    }),
    ...(maze.targetDirection
      ? [extendOutside(maze.target, maze.targetDirection)]
        .map((point) => `${point.x},${point.y}`)
      : []),
  ].join(" ");
  const playerPoints = playerPath.map((cell) => {
    const point = centerOf(cell);
    return `${point.x},${point.y}`;
  }).join(" ");
  const player = playerPath.length > 0 ? centerOf(playerPath.at(-1)) : null;
  const targetLabel = maze.goalMode === "center" ? "终点" : "出口";
  const shapeLabels = { triangle: "三角形", square: "正方形", circle: "圆形" };
  const goalModeLabels = { center: "中心终点", through: "贯穿出口" };
  const watermark = `随机种子 ${maze.seed} · ${shapeLabels[maze.shape]} · ${maze.size}×${maze.size} · ${goalModeLabels[maze.goalMode]} · V1`;
  const reproduction = JSON.stringify({
    version: 1,
    seed: maze.seed,
    shape: maze.shape,
    size: maze.size,
    goalMode: maze.goalMode,
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${maze.shape} maze" data-maze-version="1" data-maze-seed="${maze.seed}" data-maze-shape="${maze.shape}" data-maze-size="${maze.size}" data-maze-goal-mode="${maze.goalMode}">
  <metadata id="maze-reproduction">${reproduction}</metadata>
  <rect width="100%" height="100%" fill="#fffdf8" />
  <text x="${width / 2}" y="${padding + extent / 2}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-28 ${width / 2} ${padding + extent / 2})" font-family="sans-serif" font-size="${cellSize * 1.25}" font-weight="700" letter-spacing="0.08em" fill="#657172" opacity="0.22">SEED · ${maze.seed}</text>
  ${showSolution ? `<polyline id="maze-solution" points="${solutionPoints}" fill="none" stroke="#ef8354" stroke-width="${cellSize * 0.28}" stroke-linecap="round" stroke-linejoin="round" opacity="0.8" />` : ""}
  ${player ? `<polyline id="player-trail" points="${playerPoints}" fill="none" stroke="#2a7f78" stroke-width="${cellSize * 0.24}" stroke-linecap="round" stroke-linejoin="round" opacity="0.68" />` : ""}
  <g fill="none" stroke="#172326" stroke-width="${lineWidth}" stroke-linecap="square">${wallLines}</g>
  <circle cx="${target.x}" cy="${target.y}" r="${cellSize * 0.3}" fill="#ef8354" />
  <circle cx="${entrance.x}" cy="${entrance.y}" r="${cellSize * 0.18}" fill="#2a7f78" />
  ${player ? `<circle id="maze-player" cx="${player.x}" cy="${player.y}" r="${cellSize * 0.32}" fill="#fffdf8" stroke="#11665f" stroke-width="${cellSize * 0.15}" />` : ""}
  <text x="${target.x}" y="${target.y - cellSize * 0.72}" text-anchor="middle" font-family="sans-serif" font-size="${cellSize * 0.48}" font-weight="700" fill="#b64d2e">${targetLabel}</text>
  <line x1="${padding}" y1="${width + cellSize * 0.12}" x2="${width - padding}" y2="${width + cellSize * 0.12}" stroke="#657172" stroke-width="1" opacity="0.28" />
  <text x="${width / 2}" y="${width + cellSize * 0.72}" text-anchor="middle" font-family="sans-serif" font-size="${cellSize * 0.42}" letter-spacing="0.04em" fill="#657172" opacity="0.78">${watermark}</text>
</svg>`;
}
