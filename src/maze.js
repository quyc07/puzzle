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

export function mazeToSvg(maze, { showSolution = false, cellSize = 24 } = {}) {
  const padding = cellSize * 1.6;
  const extent = maze.size * cellSize;
  const width = extent + padding * 2;
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
  const targetLabel = maze.goalMode === "center" ? "终点" : "出口";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${width}" role="img" aria-label="${maze.shape} maze">
  <rect width="100%" height="100%" fill="#fffdf8" />
  ${showSolution ? `<polyline points="${solutionPoints}" fill="none" stroke="#ef8354" stroke-width="${cellSize * 0.28}" stroke-linecap="round" stroke-linejoin="round" opacity="0.8" />` : ""}
  <g fill="none" stroke="#172326" stroke-width="${lineWidth}" stroke-linecap="square">${wallLines}</g>
  <circle cx="${target.x}" cy="${target.y}" r="${cellSize * 0.3}" fill="#ef8354" />
  <circle cx="${entrance.x}" cy="${entrance.y}" r="${cellSize * 0.18}" fill="#2a7f78" />
  <text x="${target.x}" y="${target.y - cellSize * 0.72}" text-anchor="middle" font-family="sans-serif" font-size="${cellSize * 0.48}" font-weight="700" fill="#b64d2e">${targetLabel}</text>
</svg>`;
}
