"use client";

import { useGameStore } from "../store";
import { WEAPONS, CONSUMABLES } from "../constants";
import {
  ALL_ACHIEVEMENTS,
  ACHIEVEMENT_COUNT,
  BOSS_VARIANTS,
} from "../achievements";

export function Gallery({ onClose }: { onClose: () => void }) {
  const achievements = useGameStore((s) => s.achievements);
  const defeatedVariants = useGameStore((s) => s.defeatedVariants);
  const unlockedCount = Object.values(achievements).filter(Boolean).length;
  const defeatedVariantsCount = Object.values(defeatedVariants).filter(Boolean).length;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur-md text-white animate-[fadein_0.2s_ease-out] overflow-y-auto">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-amber-400/30 rounded-3xl p-6 max-w-2xl w-full mx-4 my-8 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-black bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
              📖 图鉴
            </h2>
            <p className="text-white/50 text-xs mt-0.5">
              成就 {unlockedCount}/{ACHIEVEMENT_COUNT} · 变体 {defeatedVariantsCount}/{BOSS_VARIANTS.length} · 道具 {Object.keys(WEAPONS).length + Object.keys(CONSUMABLES).length} 种
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-lg font-bold transition-colors flex items-center justify-center"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        {/* Boss Variants section (NEW) */}
        <div className="mb-6">
          <h3 className="text-amber-300 font-bold text-sm mb-2 flex items-center gap-2">
            👔 Boss 变体 ({defeatedVariantsCount}/{BOSS_VARIANTS.length})
            <span className="text-[10px] text-white/40 font-normal">· 已击败</span>
          </h3>
          <div className="space-y-2">
            {BOSS_VARIANTS.map((v) => {
              const defeated = !!defeatedVariants[v.id];
              return (
                <div
                  key={v.id}
                  className={`bg-gradient-to-br ${v.bgGradient} rounded-xl p-3 border ${v.borderColor} transition-all ${
                    defeated ? "" : "opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="text-3xl leading-none mt-0.5">{v.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className={`text-sm font-bold ${v.color}`}>{v.name}</span>
                        <span className="text-[9px] uppercase tracking-wider bg-white/10 px-1.5 py-0.5 rounded-full text-white/60">
                          {v.levelRange}
                        </span>
                        {defeated && (
                          <span className="text-[9px] bg-emerald-500/30 border border-emerald-400/40 px-1.5 py-0.5 rounded-full text-emerald-200 font-bold">
                            ✓ 已击败
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-white/70 leading-snug mb-1.5">
                        {v.description}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                        <div className="bg-black/30 rounded px-1.5 py-1">
                          <div className="text-amber-300/70 font-semibold mb-0.5">机制</div>
                          <div className="text-white/70 leading-tight">{v.mechanics}</div>
                        </div>
                        <div className="bg-black/30 rounded px-1.5 py-1">
                          <div className="text-emerald-300/70 font-semibold mb-0.5">应对</div>
                          <div className="text-white/70 leading-tight">{v.weakness}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Achievements section */}
        <div className="mb-6">
          <h3 className="text-amber-300 font-bold text-sm mb-2 flex items-center gap-2">
            🏆 成就 ({unlockedCount}/{ACHIEVEMENT_COUNT})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ALL_ACHIEVEMENTS.map((a) => {
              const unlocked = !!achievements[a.id];
              return (
                <div
                  key={a.id}
                  className={`rounded-xl p-2.5 border transition-all ${
                    unlocked
                      ? "bg-gradient-to-br from-amber-500/20 to-orange-600/10 border-amber-400/40"
                      : "bg-black/40 border-white/5 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-2xl ${unlocked ? "" : "grayscale opacity-40"}`}>
                      {unlocked ? a.icon : "🔒"}
                    </span>
                    <span className={`text-xs font-bold leading-tight ${unlocked ? "text-amber-200" : "text-white/40"}`}>
                      {a.name}
                    </span>
                  </div>
                  <div className="text-[10px] text-white/50 leading-tight">
                    {unlocked ? a.desc : a.hint || "？？？（未解锁）"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weapons section */}
        <div className="mb-6">
          <h3 className="text-amber-300 font-bold text-sm mb-2">🏏 武器 ({Object.keys(WEAPONS).length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.values(WEAPONS).map((w) => (
              <div key={w.kind} className="bg-black/40 rounded-xl p-2.5 border border-white/5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-2xl">{w.icon}</span>
                  <span className="text-xs font-bold text-white/90">{w.name}</span>
                </div>
                <div className="text-[10px] text-white/50 space-y-0.5">
                  <div>命中 <b className="text-amber-300">{w.hits}</b> 击</div>
                  <div>眩晕 <b className="text-sky-300">{w.stun}s</b></div>
                  <div>范围 <b className="text-emerald-300">{w.range}</b></div>
                  <div className={w.throwable ? "text-purple-300" : "text-white/30"}>
                    {w.throwable ? "✓ 可投掷" : "✗ 不可投掷"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Consumables section */}
        <div>
          <h3 className="text-amber-300 font-bold text-sm mb-2">🧪 道具 ({Object.keys(CONSUMABLES).length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.values(CONSUMABLES).map((c) => (
              <div key={c.kind} className="bg-black/40 rounded-xl p-2.5 border border-white/5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-2xl">{c.icon}</span>
                  <span className="text-xs font-bold text-white/90">{c.name}</span>
                </div>
                <div className="text-[10px] text-white/50 leading-tight">{c.desc}</div>
                {c.duration > 0 && (
                  <div className="text-[9px] text-sky-300/70 mt-0.5">持续 {c.duration}s</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center text-white/30 text-[10px] mt-5 pt-4 border-t border-white/10">
          进度自动保存到浏览器 · 刷新不丢失
        </div>
      </div>
    </div>
  );
}
