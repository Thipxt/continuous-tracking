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

  input: {
    defaultSensitivity: 1.0,
    minSensitivity: 0.3,
    maxSensitivity: 2.5
  },

  trial: {
    defaultDurationSec: 30,
    preCountdownSec: 3
  },

  motion: {
    baseSpeedPxPerSec: 170,
    maxSpeedPxPerSec: 230,
    segmentDurationRangeSec: [3.0, 5.5],

    linear: {
      headingJitterDeg: 6
    },

    zigzag: {
      turnIntervalRangeSec: [0.28, 0.5],
      lateralRatio: 1.15
    },

    sinusoidal: {
      amplitudeRange: [55, 110],
      frequencyRange: [0.22, 0.45],
      lateralVelocityScale: 1.0
    },

    jitter: {
      headingChangeIntervalRangeSec: [0.18, 0.32],
      maxHeadingStepDeg: 18,
      driftBlend: 0.82
    }
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