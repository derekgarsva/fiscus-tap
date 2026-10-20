import { Transition, Variants, PanInfo } from 'framer-motion';

/**
 * Authoritative Apple/Linear agile spring physics (ORIGINAL_REQUEST R1)
 * Stiffness: 400, Damping: 30, Effective settling duration: 180-220ms (strictly <= 250ms)
 */
export const appleSpring: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
  mass: 1,
};

/**
 * Micro-interaction tactile tap spring (ORIGINAL_REQUEST R3)
 */
export const tactileSpring: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 25,
};

/**
 * Triumphant elastic spring with slight playful bounce (ORIGINAL_REQUEST R4)
 */
export const triumphantSpring: Transition = {
  type: 'spring',
  stiffness: 450,
  damping: 18,
  mass: 1,
};

/**
 * Page route transition variants (ORIGINAL_REQUEST R1, R5)
 * Pure transform & opacity — 60fps GPU accelerated
 */
export const pageTransitionVariants: Variants = {
  initial: {
    opacity: 0,
    y: 10,
    scale: 0.995,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: appleSpring,
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.995,
    transition: {
      duration: 0.16,
      ease: [0.32, 0, 0.67, 0],
    },
  },
};

/**
 * Backdrop fade variants for all modals
 */
export const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.16, ease: 'easeIn' },
  },
};

/**
 * Modern bottom-sheet slide-up and exit variants
 */
export const bottomSheetVariants: Variants = {
  hidden: {
    y: '100%',
    opacity: 0.92,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: appleSpring,
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: {
      duration: 0.18,
      ease: [0.32, 0, 0.67, 0],
    },
  },
};

/**
 * Shared Framer Motion drag props for bottom sheets
 */
export const bottomSheetDragProps = {
  drag: 'y' as const,
  dragConstraints: { top: 0 },
  dragElastic: { top: 0.05, bottom: 0.65 },
  dragSnapToOrigin: true,
};

/**
 * Factory for drag-end handler that dismisses when pulled down beyond threshold
 */
export function createDragEndHandler(onClose: () => void) {
  return (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 300) {
      onClose();
    }
  };
}

/**
 * Digital receipt container staggered reveal
 */
export const receiptCardVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 28,
      delay: 0.2,
      staggerChildren: 0.05,
      delayChildren: 0.3,
    },
  },
};

/**
 * Individual receipt item revealed inside staggered container
 */
export const receiptItemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: appleSpring,
  },
};
