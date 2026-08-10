import { generateMaze, mazeToSvg, validateMaze } from "./maze.js";

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

const form = document.querySelector("#maze-form");
const preview = document.querySelector("#maze-preview");
const seedInput = document.querySelector("#seed");
const solutionInput = document.querySelector("#show-solution");
const downloadButton = document.querySelector("#download-svg");
const stats = document.querySelector("#maze-stats");

let maze;

function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff);
}

function selectedValue(name) {
  return form.elements[name].value;
}

function render() {
  const showSolution = solutionInput.checked;
  preview.innerHTML = mazeToSvg(maze, { showSolution });
  const validation = validateMaze(maze);
  stats.textContent = `${shapeNames[maze.shape]} · ${maze.cells.size} 个单元 · 正确路径 ${validation.solutionLength} 步`;
  downloadButton.disabled = false;
}

function generate() {
  const seed = seedInput.value ? Number(seedInput.value) : randomSeed();
  seedInput.value = seed;
  maze = generateMaze({
    shape: selectedValue("shape"),
    size: difficultySizes[selectedValue("difficulty")],
    seed,
  });
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
  } else if (event.target.name === "shape" || event.target.name === "difficulty") {
    generate();
  }
});

document.querySelector("#reuse-seed").addEventListener("click", generate);

downloadButton.addEventListener("click", () => {
  const svg = mazeToSvg(maze, { showSolution: solutionInput.checked });
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `maze-${maze.shape}-${maze.seed}.svg`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
});

generate();
