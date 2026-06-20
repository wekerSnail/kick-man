"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "../store";

// Displays achievement unlock notifications as a queue.
// Each achievement slides in from the right, stays 3.5s, then slides out.
export function AchievementToast() {
  const queue = useGameStore((s) => s.achievementQueue);
  const shift = useGameStore((s) => s.shiftAchievement);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (queue.length > 0) {
      const id = window.requestAnimationFrame(() => setVisible(true));
      const t = setTimeout(() => {
        const id2 = window.requestAnimationFrame(() => setVisible(false));
        // small delay for exit animation, then shift
        setTimeout(() => shift(), 350);
        return () => window.cancelAnimationFrame(id2);
      }, 3500);
      return () => {
        window.cancelAnimationFrame(id);
        clearTimeout(t);
      };
    }
  }, [queue, shift]);

  if (queue.length === 0) return null;
  const current = queue[0];

  return (
    <div className="pointer-events-none absolute top-24 right-3 z-40">
      <div
        className={`bg-gradient-to-br from-amber-500/95 to-orange-600/95 backdrop-blur-md rounded-2xl px-5 py-3 border-2 border-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.5)] flex items-center gap-3 transition-all duration-300 ${
          visible ? "translate-x-0 opacity-100 scale-100" : "translate-x-[120%] opacity-0 scale-90"
        }`}
        style={{ minWidth: 280 }}
      >
        <div className="text-4xl animate-bounce">{current.icon}</div>
        <div className="flex flex-col">
          <div className="text-[10px] uppercase tracking-widest text-amber-100 font-bold">
            🏆 成就解锁
          </div>
          <div className="text-white font-bold text-sm leading-tight">
            {current.name}
          </div>
        </div>
      </div>
    </div>
  );
}
