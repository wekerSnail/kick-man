"use client";

import { useGameStore } from "../store";

const KIND_STYLES: Record<string, string> = {
  info: "bg-sky-500/90 text-white",
  warn: "bg-amber-500/90 text-gray-900",
  danger: "bg-red-600/90 text-white",
  good: "bg-emerald-500/90 text-gray-900",
};

export function Toasts() {
  const toasts = useGameStore((s) => s.toasts);
  return (
    <div className="pointer-events-none absolute bottom-32 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${KIND_STYLES[t.kind] || KIND_STYLES.info} px-4 py-2 rounded-full text-sm font-semibold shadow-lg border border-white/20 animate-[toastin_0.25s_ease-out]`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
