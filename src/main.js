import { CONFIG } from "./config.js";
import { GameEngine } from "./game/gameengine.js";
import { HUD } from "./ui/HUD.js";

const canvas = document.getElementById("gameCanvas");
const hudRoot = document.getElementById("hudRoot");
const overlay = document.getElementById("countdownOverlay");

const patternSelect = document.getElementById("patternSelect");
const durationSelect = document.getElementById("durationSelect");
const seedInput = document.getElementById("seedInput");
const sensitivityInput = document.getElementById("sensitivityInput");
const sensitivityValue = document.getElementById("sensitivityValue");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");

canvas.width = CONFIG.canvas.width;
canvas.height = CONFIG.canvas.height;

const hud = new HUD(hudRoot);
const engine = new GameEngine(canvas, hud, overlay);

hud.render({
  state: "idle",
  timeLeft: 0,
  metrics: null
});

engine.setSensitivity(sensitivityInput.value);
sensitivityValue.textContent = Number(sensitivityInput.value).toFixed(1);

sensitivityInput.addEventListener("input", () => {
  engine.setSensitivity(sensitivityInput.value);
  sensitivityValue.textContent = Number(sensitivityInput.value).toFixed(1);
});

startBtn.addEventListener("click", () => {
  const durationSec = Number(durationSelect.value);
  const seed = Number(seedInput.value);
  const pattern = patternSelect.value;

  engine.start({
    durationSec,
    seed,
    pattern
  });
});

resetBtn.addEventListener("click", () => {
  engine.reset();
  engine.setSensitivity(sensitivityInput.value);
});