"use client";

import { useGameStore } from "../store";
import { FPS_MODE } from "../constants";

const WEAPON_LABEL: Record<string, { name: string; icon: string; desc: string }> = {
  laser: { name: "激光枪", icon: "🔫", desc: "快速连射" },
  rocket: { name: "火箭炮", icon: "🚀", desc: "爆炸眩晕" },
  grenade: { name: "手榴弹", icon: "💣", desc: "抛物线范围伤" },
};

export function FPSHUD() {
  const weapon = useGameStore((s) => s.fpsWeapon);
  const timeLeft = useGameStore((s) => s.fpsTimeLeft);
  const score = useGameStore((s) => s.fpsScore);
  const dialogue = useGameStore((s) => s.bossDialogue);

  const w = weapon ? WEAPON_LABEL[weapon] : null;
  const def = weapon ? FPS_MODE.weapons[weapon] : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-white font-sans">
      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative w-8 h-8">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/80 -translate-y-1/2" />
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/80 -translate-x-1/2" />
          <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full" />
        </div>
      </div>

      {/* Top center: countdown */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center">
        <div className="text-xs uppercase tracking-widest text-white/60">
          剩余时间
        </div>
        <div
          className={`text-6xl font-black tabular-nums ${
            timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-amber-300"
          }`}
        >
          {Math.ceil(timeLeft)}
        </div>
      </div>

      {/* Top left: score */}
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
        <div className="text-[10px] uppercase tracking-wider text-white/50">
          命中
        </div>
        <div className="text-3xl font-bold tabular-nums text-emerald-300">
          {score}
        </div>
      </div>

      {/* Top right: weapon */}
      {w && def && (
        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10 text-right">
          <div className="text-[10px] uppercase tracking-wider text-white/50">
            当前武器
          </div>
          <div className="text-2xl font-bold flex items-center gap-2 justify-end">
            <span>{w.icon}</span>
            <span>{w.name}</span>
          </div>
          <div className="text-xs text-white/60">{w.desc}</div>
          <div className="text-xs text-amber-300/80 mt-1">
            射速 {def.fireRate}/秒
          </div>
        </div>
      )}

      {/* Boss dialogue */}
      {dialogue && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-white/95 text-gray-900 px-4 py-2 rounded-xl shadow-2xl border-2 border-gray-800 text-sm font-bold animate-[popin_0.15s_ease-out]">
            💬 {dialogue}
          </div>
        </div>
      )}

      {/* Bottom hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center text-white/50 text-xs">
        <p>🖱️ 点击锁定鼠标 · 鼠标移动瞄准 · 左键射击 · ESC 退出锁定</p>
        {weapon === "grenade" && (
          <p className="text-amber-300/80 mt-1">
            💣 鼠标上下调整投掷弧度，瞄准辅助线显示落点
          </p>
        )}
      </div>
    </div>
  );
}
