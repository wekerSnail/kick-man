"use client";

import { useGameStore } from "../store";
import { WEAPONS, CONSUMABLES } from "../constants";

// All achievements (id, name, icon, desc)
const ALL_ACHIEVEMENTS: { id: string; name: string; icon: string; desc: string }[] = [
  { id: "first_blood", name: "初次踹击", icon: "🩸", desc: "第一次成功踹中老板" },
  { id: "perfect", name: "完美通关", icon: "🛡️", desc: "零伤害零发现通关任意关卡" },
  { id: "stealth", name: "潜行达人", icon: "🥷", desc: "零发现通关任意关卡" },
  { id: "speedrun", name: "速通达人", icon: "⚡", desc: "第1关 30 秒内通关" },
  { id: "combo5", name: "连击5次", icon: "🔥", desc: "连续命中 5 次" },
  { id: "combo10", name: "连击大师", icon: "💥", desc: "连续命中 10 次" },
  { id: "weapon_master", name: "武器行者", icon: "🏏", desc: "使用武器命中老板" },
  { id: "pacifist_kick", name: "徒手行者", icon: "🦵", desc: "全程只用脚踹通关" },
  { id: "no_items", name: "极简主义者", icon: "🎒", desc: "全程不用道具通关" },
  { id: "surviver", name: "职场幸存者", icon: "💼", desc: "到达第 5 关" },
  { id: "kicker_100", name: "踹击狂人", icon: "💯", desc: "单关 50+ 踹击" },
  { id: "level7", name: "通关大吉", icon: "👑", desc: "完成第 7 关" },
];

export function Gallery({ onClose }: { onClose: () => void }) {
  const achievements = useGameStore((s) => s.achievements);
  const unlockedCount = Object.values(achievements).filter(Boolean).length;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur-md text-white animate-[fadein_0.2s_ease-out] overflow-y-auto">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-amber-400/30 rounded-3xl p-6 max-w-2xl w-full mx-4 my-8 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-black bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
              📖 图鉴
            </h2>
            <p className="text-white/50 text-xs mt-0.5">
              成就 {unlockedCount}/{ALL_ACHIEVEMENTS.length} · 道具 {Object.keys(WEAPONS).length + Object.keys(CONSUMABLES).length} 种
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

        {/* Achievements section */}
        <div className="mb-6">
          <h3 className="text-amber-300 font-bold text-sm mb-2 flex items-center gap-2">
            🏆 成就 ({unlockedCount}/{ALL_ACHIEVEMENTS.length})
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
                      : "bg-black/40 border-white/5 opacity-50"
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
                    {unlocked ? a.desc : "？？？（未解锁）"}
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
