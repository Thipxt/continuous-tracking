import { CONFIG } from "./config.js";
import { GameEngine } from "./game/gameengine.js";
import { HUD } from "./ui/HUD.js";

const canvas = document.getElementById("gameCanvas");
const hudRoot = document.getElementById("hudRoot");
const overlay = document.getElementById("countdownOverlay");

const patternSelect = document.getElementById("patternSelect");
const durationSelect = document.getElementById("durationSelect");
const seedInput = document.getElementById("seedInput");
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
});