"use client";

import { useGameStore } from "../store";
import { LEVELS } from "../constants";

export function GameOverScreen({
  onRestart,
  onBackToMenu,
}: {
  onRestart: () => void;
  onBackToMenu?: () => void;
}) {
  const deathDialogue = useGameStore((s) => s.deathDialogue);
  const level = useGameStore((s) => s.level);
  const kicks = useGameStore((s) => s.kicks);
  const target = useGameStore((s) => s.target);
  const detectionsThisLevel = useGameStore((s) => s.detectionsThisLevel);
  const damageThisLevel = useGameStore((s) => s.damageThisLevel);
  const comboMax = useGameStore((s) => s.comboMax);
  const totalKicks = useGameStore((s) => s.totalKicks);
  const stars = useGameStore((s) => s.stars);
  const bestTimes = useGameStore((s) => s.bestTimes);
  const minimap = useGameStore((s) => s.minimap);

  const levelTime = minimap?.levelTime ?? 0;
  const timeStr = `${Math.floor(levelTime / 60)}:${String(Math.floor(levelTime % 60)).padStart(2, "0")}`;
  const progressPct = Math.min(100, (kicks / target) * 100);
  const earnedStarsThisLevel = stars[level] || 0;
  const bestStr = bestTimes[level]
    ? `${Math.floor(bestTimes[level] / 60)}:${String(Math.floor(bestTimes[level] % 60)).padStart(2, "0")}`
    : "--:--";

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-red-950/95 to-black/95 backdrop-blur-sm text-white animate-[fadein_0.5s_ease-out] overflow-auto">
      <div className="bg-black/50 border border-red-500/30 rounded-3xl p-7 max-w-lg w-full mx-4 shadow-2xl text-center my-8">
        <div className="text-7xl mb-3 animate-bounce">💀</div>
        <h2 className="text-4xl font-black mb-2 text-red-400 drop-shadow-[0_0_12px_rgba(248,113,113,0.6)]">
          游戏结束
        </h2>
        <p className="text-white/60 mb-5">你被神人逮到了…</p>

        {/* Death dialogue */}
        <div className="bg-red-950/50 border border-red-500/20 rounded-xl p-4 mb-5">
          <div className="text-xs uppercase tracking-wider text-red-300/70 mb-1">
            神人说
          </div>
          <div className="text-lg font-semibold text-white">
            💬 {deathDialogue || "今晚留下来加班"}
          </div>
        </div>

        {/* Detailed run stats */}
        <div className="grid grid-cols-3 gap-2 mb-5 text-sm">
          <div className="bg-white/5 rounded-lg p-2.5 border border-white/5">
            <div className="text-white/50 text-[10px] uppercase tracking-wide">到达关卡</div>
            <div className="text-2xl font-bold text-amber-300">
              {level}<span className="text-white/40 text-xs">/{LEVELS.length}</span>
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-2.5 border border-white/5">
            <div className="text-white/50 text-[10px] uppercase tracking-wide">本关踹击</div>
            <div className="text-2xl font-bold">
              {kicks}<span className="text-white/40 text-xs">/{target}</span>
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-2.5 border border-white/5">
            <div className="text-white/50 text-[10px] uppercase tracking-wide">用时</div>
            <div className="text-lg font-bold tabular-nums">{timeStr}</div>
            <div className="text-[9px] text-amber-300/70">最佳 {bestStr}</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2.5 border border-white/5">
            <div className="text-white/50 text-[10px] uppercase tracking-wide">被发现</div>
            <div className={`text-2xl font-bold ${detectionsThisLevel === 0 ? "text-emerald-300" : "text-red-300"}`}>
              {detectionsThisLevel}
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-2.5 border border-white/5">
            <div className="text-white/50 text-[10px] uppercase tracking-wide">扣血</div>
            <div className={`text-2xl font-bold ${damageThisLevel === 0 ? "text-emerald-300" : "text-red-300"}`}>
              {damageThisLevel}
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-2.5 border border-white/5">
            <div className="text-white/50 text-[10px] uppercase tracking-wide">最高连击</div>
            <div className="text-2xl font-bold text-orange-300">
              {comboMax}<span className="text-white/40 text-xs">🔥</span>
            </div>
          </div>
        </div>

        {/* Progress to target bar */}
        <div className="bg-black/40 rounded-xl p-3 mb-5 border border-white/5">
          <div className="flex justify-between text-[10px] text-white/50 uppercase tracking-wide mb-1.5">
            <span>本关踹击进度</span>
            <span className="text-amber-300 font-bold tabular-nums">{Math.round(progressPct)}%</span>
          </div>
          <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-red-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-[10px] text-white/40 mt-1.5">
            {kicks >= target
              ? "✅ 已达成目标，可惜没活到通关"
              : `还差 ${target - kicks} 次踹击就能过关`}
          </div>
        </div>

        {/* Lifetime stats */}
        <div className="bg-gradient-to-br from-purple-950/30 to-amber-950/30 rounded-xl p-3 mb-5 border border-white/10">
          <div className="text-[10px] uppercase tracking-wider text-amber-300/80 mb-2">
            累计成就
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/5 rounded px-2 py-1.5 flex items-center justify-between">
              <span className="text-white/60">🦵 累计踹击</span>
              <span className="font-bold text-amber-300 tabular-nums">{totalKicks}</span>
            </div>
            <div className="bg-white/5 rounded px-2 py-1.5 flex items-center justify-between">
              <span className="text-white/60">⭐ 本关星数</span>
              <span className="font-bold text-amber-300">
                {"⭐".repeat(earnedStarsThisLevel) || <span className="text-white/30">☆☆☆</span>}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={onRestart}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-gray-900 font-bold text-lg hover:scale-[1.02] transition-transform shadow-lg"
          >
            🔄 重新开始（第 1 关）
          </button>
          {onBackToMenu && (
            <button
              onClick={onBackToMenu}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-semibold transition-colors"
            >
              🏠 返回主菜单
            </button>
          )}
        </div>
        <p className="text-white/30 text-xs mt-4">
          💡 下次记得用隐身药水穿检测区，用键盘盾抵消伤害
        </p>
      </div>
    </div>
  );
}
