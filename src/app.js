import { attemptMove, generateMaze, mazeToSvg, validateMaze } from "./maze.js?v=9";

const shapeNames = {
  triangle: "三角形",
  square: "正方形",
  circle: "圆形",
};

const difficultySizes = {
  easy: 15,
  medium: 23,
  hard: 31,
};

const goalModeNames = {
  center: "中心终点",
  through: "贯穿出口",
};

const form = document.querySelector("#maze-form");
const preview = document.querySelector("#maze-preview");
const seedInput = document.querySelector("#seed");
const solutionInput = document.querySelector("#show-solution");
const downloadButton = document.querySelector("#download-svg");
const stats = document.querySelector("#maze-stats");
const playButton = document.querySelector("#start-play");
const playStatus = document.querySelector("#play-status");
const playHint = document.querySelector("#play-hint");
const timeDisplay = document.querySelector("#play-time");
const moveDisplay = document.querySelector("#play-moves");
const collisionDisplay = document.querySelector("#play-collisions");
const directionButtons = [...document.querySelectorAll("[data-direction]")];

let maze;
let timerId;
let playState;

function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff);
}

function selectedValue(name) {
  return form.elements[name].value;
}

function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function elapsedTime() {
  if (!playState?.startedAt) {
    return 0;
  }
  return playState.completedAt
    ? playState.completedAt - playState.startedAt
    : Date.now() - playState.startedAt;
}

function updatePlayUI() {
  const isActive = Boolean(playState?.active);
  const isCompleted = Boolean(playState?.completedAt);
  playStatus.textContent = isCompleted ? "闯关成功！" : isActive ? "闯关中" : "准备闯关";
  playHint.textContent = isCompleted
    ? `你用了 ${playState.moves} 步到达目标`
    : isActive ? "使用方向键、WASD 或下方按钮移动" : "从入口出发，找到橙色目标";
  timeDisplay.textContent = formatTime(elapsedTime());
  moveDisplay.textContent = String(playState?.moves ?? 0);
  collisionDisplay.textContent = String(playState?.collisions ?? 0);
  playButton.textContent = isCompleted ? "再玩一次" : isActive ? "重新开始" : "开始闯关";
  directionButtons.forEach((button) => {
    button.disabled = !isActive;
  });
}

function stopTimer() {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = undefined;
  }
}

function resetPlay() {
  stopTimer();
  playState = {
    active: false,
    completedAt: null,
    startedAt: null,
    moves: 0,
    collisions: 0,
    path: [],
  };
}

function render() {
  const showSolution = solutionInput.checked;
  preview.innerHTML = mazeToSvg(maze, { showSolution, playerPath: playState.path });
  const validation = validateMaze(maze);
  stats.textContent = `${shapeNames[maze.shape]} · ${goalModeNames[maze.goalMode]} · 正确路径 ${validation.solutionLength} 步`;
  downloadButton.disabled = false;
  updatePlayUI();
}

function generate() {
  const seed = seedInput.value ? Number(seedInput.value) : randomSeed();
  seedInput.value = seed;
  maze = generateMaze({
    shape: selectedValue("shape"),
    size: difficultySizes[selectedValue("difficulty")],
    goalMode: selectedValue("goalMode"),
    seed,
  });
  resetPlay();
  render();
}

function startPlay() {
  resetPlay();
  playState.active = true;
  playState.startedAt = Date.now();
  playState.path = [maze.entrance];
  timerId = window.setInterval(updatePlayUI, 250);
  render();
}

function movePlayer(direction) {
  if (!playState.active) {
    return;
  }

  const current = playState.path.at(-1);
  const result = attemptMove(maze, current, direction);
  if (!result.moved) {
    playState.collisions += 1;
    updatePlayUI();
    return;
  }

  playState.moves += 1;
  playState.path.push(result.cell);
  if (result.cell === maze.target) {
    playState.active = false;
    playState.completedAt = Date.now();
    stopTimer();
  }
  render();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  seedInput.value = randomSeed();
  generate();
});

form.addEventListener("change", (event) => {
  if (event.target === solutionInput) {
    render();
  } else if (["shape", "difficulty", "goalMode"].includes(event.target.name)) {
    generate();
  }
});

document.querySelector("#reuse-seed").addEventListener("click", generate);
playButton.addEventListener("click", startPlay);

directionButtons.forEach((button) => {
  button.addEventListener("click", () => movePlayer(button.dataset.direction));
});

window.addEventListener("keydown", (event) => {
  const directions = {
    ArrowUp: "N",
    ArrowRight: "E",
    ArrowDown: "S",
    ArrowLeft: "W",
    w: "N",
    d: "E",
    s: "S",
    a: "W",
  };
  const direction = directions[event.key] ?? directions[event.key.toLowerCase()];
  if (direction && playState.active) {
    event.preventDefault();
    movePlayer(direction);
  }
});

downloadButton.addEventListener("click", () => {
  const svg = mazeToSvg(maze, { showSolution: solutionInput.checked });
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `maze-${maze.shape}-${maze.seed}-watermarked.svg`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
});

generate();
