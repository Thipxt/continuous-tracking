import { CONFIG } from "./config";
import { GameEngine } from "./game/gameengine";
import { HUD } from "./ui/HUD";
import { CustomPathManager } from "./game/CustomPathManager";
import type { ExportedCustomPath, PathValidationResult, Pattern, SeedMode } from "./types";

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element with id: ${id}`);
  }
  return element as T;
}

const canvas = getElement<HTMLCanvasElement>("gameCanvas");
const hudRoot = getElement<HTMLElement>("hudRoot");
const overlay = getElement<HTMLElement>("countdownOverlay");

const patternSelect = getElement<HTMLSelectElement>("patternSelect");
const durationSelect = getElement<HTMLSelectElement>("durationSelect");
const seedModeSelect = getElement<HTMLSelectElement>("seedModeSelect");
const seedInputGroup = getElement<HTMLElement>("seedInputGroup");
const seedInput = getElement<HTMLInputElement>("seedInput");
const copySeedBtn = getElement<HTMLButtonElement>("copySeedBtn");
const copySeedStatus = getElement<HTMLElement>("copySeedStatus");
const sensitivityInput = getElement<HTMLInputElement>("sensitivityInput");
const sensitivityValue = getElement<HTMLElement>("sensitivityValue");
const startBtn = getElement<HTMLButtonElement>("startBtn");
const resetBtn = getElement<HTMLButtonElement>("resetBtn");

const customPathPanel = getElement<HTMLElement>("customPathPanel");
const drawPathBtn = getElement<HTMLButtonElement>("drawPathBtn");
const finishPathBtn = getElement<HTMLButtonElement>("finishPathBtn");
const clearPathBtn = getElement<HTMLButtonElement>("clearPathBtn");
const copyPathBtn = getElement<HTMLButtonElement>("copyPathBtn");
const loadPathBtn = getElement<HTMLButtonElement>("loadPathBtn");
const pathDataInput = getElement<HTMLTextAreaElement>("pathDataInput");
const customPathStatus = getElement<HTMLElement>("customPathStatus");

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

function getPatternValue(): Pattern {
  return patternSelect.value as Pattern;
}

function getSeedModeValue(): SeedMode {
  return seedModeSelect.value as SeedMode;
}

function updateSeedModeUI(): void {
  const isFixed = getSeedModeValue() === "fixed";
  seedInputGroup.style.display = isFixed ? "flex" : "none";
}

function updateCustomPathUI(): void {
  const isCustom = getPatternValue() === "custom";
  customPathPanel.style.display = isCustom ? "block" : "none";

  const pointCount = customPathManager.points.length;
  const totalLength = customPathManager.getTotalLength().toFixed(1);

  customPathStatus.textContent = customPathManager.hasValidPath()
    ? `Path พร้อมใช้งาน • ${pointCount} points • length ${totalLength}px • ระบบจะปิดเส้นกลับจุดเริ่มให้อัตโนมัติ`
    : customPathManager.isDrawing
      ? `กำลังวาด path... (${pointCount} points)`
      : "ยังไม่มี path";
}

function updatePatternPreview(): void {
  engine.setPreviewPattern(getPatternValue(), customPathManager);
}

function generateRandomSeed(): number {
  return Math.floor(Math.random() * 2147483647) + 1;
}

let copyStatusTimer: number | undefined;

function showCopyStatus(message: string, isError = false): void {
  copySeedStatus.textContent = message;
  copySeedStatus.style.color = isError ? "#fca5a5" : "#bbf7d0";

  window.clearTimeout(copyStatusTimer);
  copyStatusTimer = window.setTimeout(() => {
    copySeedStatus.textContent = "";
  }, 1800);
}

function validatePathText(text: string): PathValidationResult {
  let parsed: Partial<ExportedCustomPath>;

  try {
    parsed = JSON.parse(text) as Partial<ExportedCustomPath>;
  } catch {
    return {
      ok: false,
      message: "รูปแบบ JSON ไม่ถูกต้อง"
    };
  }

  if (!parsed || parsed.type !== "custom_path") {
    return {
      ok: false,
      message: "ข้อมูลนี้ไม่ใช่ custom_path"
    };
  }

  if (!Array.isArray(parsed.points)) {
    return {
      ok: false,
      message: "ไม่พบ points ใน path"
    };
  }

  if (parsed.points.length < 2) {
    return {
      ok: false,
      message: "path ต้องมีอย่างน้อย 2 points"
    };
  }

  const hasInvalidPoint = parsed.points.some((p) => {
    return (
      !p ||
      typeof p.x !== "number" ||
      typeof p.y !== "number" ||
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y)
    );
  });

  if (hasInvalidPoint) {
    return {
      ok: false,
      message: "points ต้องมีค่า x และ y เป็นตัวเลข"
    };
  }

  return {
    ok: true,
    message: "Path ใช้งานได้"
  };
}

async function copySeedToClipboard(): Promise<void> {
  let seedToCopy: number | null = null;

  if (getSeedModeValue() === "fixed") {
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
  engine.resetForPatternChange(getPatternValue(), customPathManager);
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
  pathDataInput.value = "";
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
  customPathStatus.textContent = "ล้าง path แล้ว";
  updateCustomPathUI();
  updatePatternPreview();
});

copyPathBtn.addEventListener("click", async () => {
  if (!customPathManager.hasValidPath()) {
    customPathStatus.textContent = "ยังไม่มี path ที่ copy ได้";
    return;
  }

  const text = customPathManager.exportPath();

  try {
    await navigator.clipboard.writeText(text);
    customPathStatus.textContent = "คัดลอก path แล้ว สามารถนำไปวางในช่อง Load Path Data เพื่อใช้ซ้ำได้";
  } catch {
    customPathStatus.textContent = "คัดลอก path ไม่สำเร็จ";
  }
});

loadPathBtn.addEventListener("click", () => {
  const text = pathDataInput.value.trim();

  if (!text) {
    customPathStatus.textContent = "กรุณาวาง path JSON ลงในช่อง Load Path Data ก่อน";
    return;
  }

  const validation = validatePathText(text);

  if (!validation.ok) {
    customPathStatus.textContent = `โหลด path ไม่สำเร็จ: ${validation.message}`;
    return;
  }

  try {
    engine.resetForPatternChange("custom", customPathManager);
    customPathManager.importPath(text);
    patternSelect.value = "custom";
    customPathManager.stopDrawing();

    updateCustomPathUI();
    updatePatternPreview();

    customPathStatus.textContent = "โหลด path สำเร็จ";
  } catch {
    customPathStatus.textContent = "โหลด path ไม่สำเร็จ หรือข้อมูลไม่ถูกต้อง";
  }
});

canvas.addEventListener("mousedown", (e: MouseEvent) => {
  if (getPatternValue() !== "custom") return;
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

canvas.addEventListener("mousemove", (e: MouseEvent) => {
  if (getPatternValue() !== "custom") return;
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
  const pattern = getPatternValue();
  const seedMode = getSeedModeValue();

  if (pattern === "custom" && !customPathManager.hasValidPath()) {
    customPathStatus.textContent = "กรุณาวาด path หรือโหลด path ก่อนเริ่ม";
    return;
  }

  let seed: number;
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