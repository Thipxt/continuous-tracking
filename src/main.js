import { CONFIG } from "./config.js";
import { GameEngine } from "./game/gameengine.js";
import { HUD } from "./ui/HUD.js";

const canvas = document.getElementById("gameCanvas");
const hudRoot = document.getElementById("hudRoot");
const overlay = document.getElementById("countdownOverlay");

const patternSelect = document.getElementById("patternSelect");
const durationSelect = document.getElementById("durationSelect");
const seedModeSelect = document.getElementById("seedModeSelect");
const seedInputGroup = document.getElementById("seedInputGroup");
const seedInput = document.getElementById("seedInput");
const copySeedBtn = document.getElementById("copySeedBtn");
const copySeedStatus = document.getElementById("copySeedStatus");
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
  metrics: null,
  seedInfo: "-",
  seedMode: "random"
});

engine.setSensitivity(sensitivityInput.value);
sensitivityValue.textContent = Number(sensitivityInput.value).toFixed(1);

function updateSeedModeUI() {
  const isFixed = seedModeSelect.value === "fixed";
  seedInputGroup.style.display = isFixed ? "flex" : "none";
}

function generateRandomSeed() {
  return Math.floor(Math.random() * 2147483647) + 1;
}

function showCopyStatus(message, isError = false) {
  copySeedStatus.textContent = message;
  copySeedStatus.style.color = isError ? "#fca5a5" : "#bbf7d0";

  window.clearTimeout(showCopyStatus._timer);
  showCopyStatus._timer = window.setTimeout(() => {
    copySeedStatus.textContent = "";
  }, 1800);
}

async function copySeedToClipboard() {
  let seedToCopy = null;

  if (seedModeSelect.value === "fixed") {
    seedToCopy = Number(seedInput.value) || 1;
  } else {
    seedToCopy = engine.getCurrentSeed();
  }

  if (!seedToCopy) {
    showCopyStatus("ยังไม่มี seed ให้คัดลอก", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(String(seedToCopy));
    showCopyStatus(`คัดลอก Seed ${seedToCopy} แล้ว`);
  } catch (error) {
    showCopyStatus("คัดลอกไม่สำเร็จ", true);
  }
}

seedModeSelect.addEventListener("change", updateSeedModeUI);

sensitivityInput.addEventListener("input", () => {
  sensitivityValue.textContent = Number(sensitivityInput.value).toFixed(1);
  engine.setSensitivity(sensitivityInput.value);
});

copySeedBtn.addEventListener("click", copySeedToClipboard);

startBtn.addEventListener("click", () => {
  const durationSec = Number(durationSelect.value);
  const pattern = patternSelect.value;
  const seedMode = seedModeSelect.value;

  let seed;
  if (seedMode === "fixed") {
    seed = Number(seedInput.value) || 1;
  } else {
    seed = generateRandomSeed();
  }

  engine.start({
    durationSec,
    seed,
    pattern,
    seedMode
  });

  engine.requestPointerLock();

  if (seedMode === "random") {
    showCopyStatus(`สุ่ม Seed ${seed} แล้ว`);
  }
});

resetBtn.addEventListener("click", () => {
  engine.reset();
  engine.setSensitivity(sensitivityInput.value);
  copySeedStatus.textContent = "";
});

updateSeedModeUI();