import { attemptMove, findPath, generateMaze, mazeToSvg, validateMaze } from "./maze.js?v=10";

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

const gameModeNames = {
  classic: "经典闯关",
  treasure: "取宝逃生",
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
const gameModeInputs = [...document.querySelectorAll('input[name="gameMode"]')];
const centerGoalInput = form.elements.goalMode[0];
const throughGoalInput = form.elements.goalMode[1];
const treasureLegend = document.querySelector("#treasure-legend");

let maze;
let timerId;
let playState;

function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff);
}

function selectedValue(name) {
  return form.elements[name].value;
}

function selectedGameMode() {
  return gameModeInputs.find((input) => input.checked).value;
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
  const isTreasureMode = playState?.gameMode === "treasure";

  if (isTreasureMode) {
    playStatus.textContent = isCompleted
      ? "成功带宝物逃出！"
      : playState.treasureCollected ? "宝物已到手" : isActive ? "寻找中心宝物" : "准备取宝逃生";
    playHint.textContent = isCompleted
      ? `你用了 ${playState.moves} 步完成取宝逃生`
      : playState.treasureCollected
        ? "出口已经解锁，快离开迷宫"
        : isActive ? "先到中心取得星星，出口才会解锁" : "先取中心宝物，再从外部出口逃出";
  } else {
    playStatus.textContent = isCompleted ? "闯关成功！" : isActive ? "闯关中" : "准备闯关";
    playHint.textContent = isCompleted
      ? `你用了 ${playState.moves} 步到达目标`
      : isActive ? "使用方向键、WASD 或下方按钮移动" : "从入口出发，找到橙色目标";
  }
  timeDisplay.textContent = formatTime(elapsedTime());
  moveDisplay.textContent = String(playState?.moves ?? 0);
  collisionDisplay.textContent = String(playState?.collisions ?? 0);
  playButton.textContent = isCompleted ? "再玩一次" : isActive ? "重新开始" : "开始闯关";
  directionButtons.forEach((button) => {
    button.disabled = !isActive;
  });
  gameModeInputs.forEach((input) => {
    input.disabled = isActive;
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
    gameMode: selectedGameMode(),
    treasureCollected: false,
  };
}

function render() {
  const showSolution = solutionInput.checked;
  const isTreasureMode = playState.gameMode === "treasure";
  const treasureSolution = isTreasureMode
    ? [
      ...findPath(maze, maze.entrance, maze.center),
      ...findPath(maze, maze.center, maze.target).slice(1),
    ]
    : maze.solution;
  preview.innerHTML = mazeToSvg(maze, {
    showSolution,
    playerPath: playState.path,
    solutionPath: treasureSolution,
    treasureCell: isTreasureMode ? maze.center : null,
    treasureCollected: playState.treasureCollected,
    targetLocked: isTreasureMode && !playState.treasureCollected,
  });
  const validation = validateMaze(maze);
  stats.textContent = `${shapeNames[maze.shape]} · ${gameModeNames[playState.gameMode]} · ${goalModeNames[maze.goalMode]} · ${validation.solutionLength} 步`;
  downloadButton.disabled = false;
  treasureLegend.hidden = !isTreasureMode;
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
  if (selectedGameMode() === "treasure" && maze.goalMode !== "through") {
    throughGoalInput.checked = true;
    generate();
  }
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
  if (playState.gameMode === "treasure" && !playState.treasureCollected && result.cell === maze.center) {
    playState.treasureCollected = true;
  }
  const canFinish = playState.gameMode === "classic" || playState.treasureCollected;
  if (result.cell === maze.target && canFinish) {
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

gameModeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    const treasureMode = selectedGameMode() === "treasure";
    centerGoalInput.disabled = treasureMode;
    if (treasureMode && selectedValue("goalMode") !== "through") {
      throughGoalInput.checked = true;
      generate();
      return;
    }
    resetPlay();
    render();
  });
});

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
