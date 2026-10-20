'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { pageTransitionVariants } from '@/lib/motion-config';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="w-full min-h-screen flex flex-col"
    >
      {children}
    </motion.div>
  );
}
