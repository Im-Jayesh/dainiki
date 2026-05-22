"use client";

import { motion } from "framer-motion";

export function AiLoading() {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6">
      <div className="relative flex items-center justify-center">
        {/* Elegant glowing ring */}
        <motion.div
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
          }}
          className="h-16 w-16 rounded-full border-t-2 border-r-2 border-zinc-200 dark:border-zinc-800 shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(255,255,255,0.05)]"
        />
        
        {/* Pulsing center dot */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute h-2 w-2 bg-zinc-900 dark:bg-zinc-100 rounded-full"
        />
      </div>
      
      <div className="flex flex-col items-center gap-1">
        <motion.p
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-400"
        >
          Dainiki AI
        </motion.p>
        <p className="text-[8px] text-zinc-300 dark:text-zinc-700 uppercase tracking-widest font-medium">Weaving thoughts</p>
      </div>
    </div>
  );
}
