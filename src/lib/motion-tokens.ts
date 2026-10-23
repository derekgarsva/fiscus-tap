export const motionTokens = {
  duration: {
    instant: 0,
    fast: 0.15,
    standard: 0.25,
    slow: 0.4,
    enter: 0.2,
    exit: 0.15,
  },
  ease: {
    standard: [0.2, 0, 0, 1] as const,
    enter: [0, 0, 0.2, 1] as const,
    exit: [0.4, 0, 1, 1] as const,
  },
  spring: {
    smooth: { type: "spring", stiffness: 350, damping: 30 },
    snappy: { type: "spring", stiffness: 450, damping: 25 },
    morph: { type: "spring", stiffness: 400, damping: 28 },
  },
  blur: {
    soft: 8,
    subtle: 4,
  },
} as const;

export default motionTokens;
