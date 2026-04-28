import { CONFIG } from "./config.js";
import { GameEngine } from "./game/gameengine.js";
import { HUD } from "./ui/HUD.js";
import { CustomPathManager } from "./game/CustomPathManager.js";

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

const customPathPanel = document.getElementById("customPathPanel");
const drawPathBtn = document.getElementById("drawPathBtn");
const finishPathBtn = document.getElementById("finishPathBtn");
const clearPathBtn = document.getElementById("clearPathBtn");
const copyPathBtn = document.getElementById("copyPathBtn");
const loadPathBtn = document.getElementById("loadPathBtn");
const pathDataInput = document.getElementById("pathDataInput");
const customPathStatus = document.getElementById("customPathStatus");

canvas.width = CONFIG.canvas.width;
canvas.height = CONFIG.canvas.height;

const hud = new HUD(hudRoot);
const engine = new GameEngine(canvas, hud, overlay);
const customPathManager = new CustomPathManager(
  CONFIG.canvas.width,
  CONFIG.canvas.height
);

let isMouseDownForPath = false;

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

function updatePathDataText() {
  if (customPathManager.hasValidPath()) {
    pathDataInput.value = customPathManager.exportPath();
  } else if (!customPathManager.isDrawing) {
    pathDataInput.value = "";
  }
}

function updateCustomPathUI() {
  const isCustom = patternSelect.value === "custom";
  customPathPanel.style.display = isCustom ? "block" : "none";

  const pointCount = customPathManager.points.length;
  const totalLength = customPathManager.getTotalLength().toFixed(1);

  customPathStatus.textContent = customPathManager.hasValidPath()
    ? `Path พร้อมใช้งาน • ${pointCount} points • length ${totalLength}px • ระบบจะปิดเส้นกลับจุดเริ่มให้อัตโนมัติ`
    : customPathManager.isDrawing
      ? `กำลังวาด path... (${pointCount} points)`
      : "ยังไม่มี path";

  updatePathDataText();
}

function updatePatternPreview() {
  engine.setPreviewPattern(patternSelect.value, customPathManager);
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
  } catch {
    showCopyStatus("คัดลอกไม่สำเร็จ", true);
  }
}

seedModeSelect.addEventListener("change", updateSeedModeUI);

patternSelect.addEventListener("change", () => {
  // เวลาเปลี่ยนโหมด ให้หยุดเกมที่กำลังรันอยู่ และ reset เป้ากลับตำแหน่งเริ่มต้น
  engine.resetForPatternChange(patternSelect.value, customPathManager);

  updateCustomPathUI();
  updatePatternPreview();
});

sensitivityInput.addEventListener("input", () => {
  sensitivityValue.textContent = Number(sensitivityInput.value).toFixed(1);
  engine.setSensitivity(sensitivityInput.value);
});

copySeedBtn.addEventListener("click", copySeedToClipboard);

drawPathBtn.addEventListener("click", () => {
  engine.resetForPatternChange("custom", customPathManager);
  customPathManager.startDrawing();
  patternSelect.value = "custom";
  updateCustomPathUI();
  updatePatternPreview();
});

finishPathBtn.addEventListener("click", () => {
  customPathManager.stopDrawing();
  updateCustomPathUI();
  updatePatternPreview();
});

clearPathBtn.addEventListener("click", () => {
  engine.resetForPatternChange("custom", customPathManager);
  customPathManager.clear();
  isMouseDownForPath = false;
  pathDataInput.value = "";
  updateCustomPathUI();
  updatePatternPreview();
});

copyPathBtn.addEventListener("click", async () => {
  if (!customPathManager.hasValidPath()) {
    customPathStatus.textContent = "ยังไม่มี path ที่ copy ได้";
    return;
  }

  const text = customPathManager.exportPath();
  pathDataInput.value = text;

  try {
    await navigator.clipboard.writeText(text);
    customPathStatus.textContent = "คัดลอก path แล้ว";
  } catch {
    customPathStatus.textContent = "คัดลอก path ไม่สำเร็จ";
  }
});

loadPathBtn.addEventListener("click", async () => {
  const text = pathDataInput.value.trim();

  if (!text) {
    customPathStatus.textContent = "กรุณาวาง path JSON ลงในช่อง Path Data ก่อน";
    return;
  }

  try {
    engine.resetForPatternChange("custom", customPathManager);
    customPathManager.importPath(text);
    patternSelect.value = "custom";
    updateCustomPathUI();
    updatePatternPreview();
    customPathStatus.textContent = "โหลด path สำเร็จ";
  } catch {
    customPathStatus.textContent = "โหลด path ไม่สำเร็จ หรือข้อมูลไม่ถูกต้อง";
  }
});

canvas.addEventListener("mousedown", (e) => {
  if (patternSelect.value !== "custom") return;
  if (!customPathManager.isDrawing) return;

  isMouseDownForPath = true;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  customPathManager.addPoint(x, y);
  updateCustomPathUI();
  updatePatternPreview();
});

canvas.addEventListener("mousemove", (e) => {
  if (patternSelect.value !== "custom") return;
  if (!customPathManager.isDrawing || !isMouseDownForPath) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  customPathManager.addPoint(x, y);
  updateCustomPathUI();
  updatePatternPreview();
});

window.addEventListener("mouseup", () => {
  isMouseDownForPath = false;
});

startBtn.addEventListener("click", () => {
  const durationSec = Number(durationSelect.value);
  const pattern = patternSelect.value;
  const seedMode = seedModeSelect.value;

  if (pattern === "custom" && !customPathManager.hasValidPath()) {
    customPathStatus.textContent = "กรุณาวาด path ก่อนเริ่ม";
    return;
  }

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
    seedMode,
    customPathManager
  });

  // ล็อกเมาส์ทุกโหมด รวมถึง custom
  engine.requestPointerLock();

  if (seedMode === "random") {
    showCopyStatus(`สุ่ม Seed ${seed} แล้ว`);
  }
});

resetBtn.addEventListener("click", () => {
  engine.reset();
  engine.setSensitivity(sensitivityInput.value);
  copySeedStatus.textContent = "";
  updateCustomPathUI();
  updatePatternPreview();
});

updateSeedModeUI();
updateCustomPathUI();
updatePatternPreview();