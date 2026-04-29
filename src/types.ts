import type { SeededRNG } from "./utils/rng";

export type Point = { x: number; y: number };
export type Velocity = Point;

export type Pattern = "mixed" | "linear" | "zigzag" | "sinusoidal" | "jitter" | "custom";
export type SeedMode = "random" | "fixed";
export type TrialStateValue = "idle" | "countdown" | "running" | "finished";

export type Bounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type PointerState = Point & {
  inside: boolean;
  sensitivity: number;
  rawLastX: number | null;
  rawLastY: number | null;
};

export type TargetState = Point & { vx: number; vy: number };

export type MotionTypeValue = "linear" | "zigzag" | "sinusoidal" | "jitter";

export type MotionSegment = {
  type: MotionTypeValue;
  duration: number;
  speed: number;
  directionAngle: number;
  amplitude: number;
  frequency: number;
  zigzagTurnInterval: number;
  zigzagLateralRatio: number;
  jitterHeadingInterval: number;
  jitterMaxHeadingStepDeg: number;
  jitterDriftBlend: number;
  rng: SeededRNG;
  jitterHeadingAngle: number;
  jitterHeadingTimer: number;
};

export type MotionSegmentInput = {
  type: MotionTypeValue;
  duration: number;
  speed: number;
  directionAngle: number;
  amplitude?: number;
  frequency?: number;
  zigzagTurnInterval?: number;
  zigzagLateralRatio?: number;
  jitterHeadingInterval?: number;
  jitterMaxHeadingStepDeg?: number;
  jitterDriftBlend?: number;
  rng: SeededRNG;
};

export type ScoreResults = {
  totalTime: number;
  onTargetTime: number;
  timeOnTargetPct: number;
  meanError: number;
  rmse: number;
  maxError: number;
  samples: number;
};

export type HUDRenderArgs = {
  state: TrialStateValue;
  timeLeft: number;
  metrics: ScoreResults | null;
  seedInfo?: string | number;
  seedMode?: SeedMode;
};

export type ExportedCustomPath = {
  version: number;
  type: "custom_path";
  canvasWidth: number;
  canvasHeight: number;
  loop: boolean;
  autoClose: boolean;
  speed: number;
  points: Point[];
};

export type PathValidationResult = {
  ok: boolean;
  message: string;
};