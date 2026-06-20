"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "../store";

// Displays screen-center event banners for key boss state changes.
// Banner slides in, holds ~2s, then fades out.
export function EventBanner() {
  const banner = useGameStore((s) => s.eventBanner);
  const clear = useGameStore((s) => s.clearEventBanner);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (banner) {
      const id = window.requestAnimationFrame(() => setVisible(true));
      const t = setTimeout(() => {
        const id2 = window.requestAnimationFrame(() => setVisible(false));
        setTimeout(() => clear(), 300);
        return () => window.cancelAnimationFrame(id2);
      }, 2000);
      return () => {
        window.cancelAnimationFrame(id);
        clearTimeout(t);
      };
    }
  }, [banner, clear]);

  if (!banner) return null;

  return (
    <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
      <div
        className={`rounded-2xl px-6 py-3 border-2 shadow-2xl flex items-center gap-3 transition-all duration-300 ${
          visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 -translate-y-2"
        } ${banner.color}`}
      >
        <span className="text-3xl animate-bounce">{banner.icon}</span>
        <span className="text-lg font-bold text-white drop-shadow-lg">
          {banner.text}
        </span>
      </div>
    </div>
  );
}
