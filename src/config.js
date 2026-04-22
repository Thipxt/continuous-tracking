export const CONFIG = {
  canvas: {
    width: 1000,
    height: 640,
    margin: 40
  },

  target: {
    radius: 22,
    visibleRingRadius: 34
  },

  cursor: {
    radius: 6
  },

  trial: {
    defaultDurationSec: 30,
    preCountdownSec: 3
  },

  motion: {
    baseSpeedPxPerSec: 180,
    maxSpeedPxPerSec: 260,
    maxAccelerationPxPerSec2: 420,
    segmentDurationRangeSec: [2.5, 5.0],
    jitterNoiseScale: 26,
    sinusoidAmplitudeRange: [40, 120],
    sinusoidFrequencyRange: [0.25, 0.8],
    zigzagTurnIntervalRange: [0.35, 0.85]
  },

  scoring: {
    onTargetRadiusMultiplier: 1.0
  },

  colors: {
    target: "#22c55e",
    targetRing: "rgba(34, 197, 94, 0.22)",
    cursor: "#f8fafc",
    pathGhost: "rgba(148, 163, 184, 0.18)",
    text: "#e5e7eb",
    danger: "#ef4444"
  }
};