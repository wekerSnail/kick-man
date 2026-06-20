"use client";

import { useGameStore } from "../store";

// Displays the current combo counter when combo > 1.
// Shows with a growing animation and color shift at higher combos.
export function ComboCounter() {
  const combo = useGameStore((s) => s.currentCombo);

  if (combo < 2) return null;

  const tier =
    combo >= 10 ? "legend" : combo >= 5 ? "epic" : combo >= 3 ? "good" : "normal";
  const colors: Record<string, string> = {
    normal: "from-sky-400 to-blue-500 text-white",
    good: "from-emerald-400 to-green-500 text-gray-900",
    epic: "from-orange-400 to-red-500 text-white",
    legend: "from-amber-300 via-pink-400 to-purple-500 text-white",
  };
  const labels: Record<string, string> = {
    normal: "连击!",
    good: "不错!",
    epic: "厉害!",
    legend: "大师!",
  };

  return (
    <div className="pointer-events-none absolute top-32 left-1/2 -translate-x-1/2 z-20">
      <div
        key={combo}
        className={`bg-gradient-to-r ${colors[tier]} rounded-2xl px-5 py-2 border-2 border-white/40 shadow-2xl flex items-center gap-3 animate-[popin_0.2s_ease-out]`}
      >
        <div className="text-3xl font-black tabular-nums leading-none">{combo}</div>
        <div className="flex flex-col">
          <div className="text-[9px] uppercase tracking-widest opacity-80 font-bold leading-none">
            {labels[tier]}
          </div>
          <div className="text-xs font-semibold leading-none mt-0.5">连击</div>
        </div>
        <div className="text-2xl">{tier === "legend" ? "🔥" : tier === "epic" ? "💥" : "⚡"}</div>
      </div>
    </div>
  );
}
