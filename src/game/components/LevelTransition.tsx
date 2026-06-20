"use client";

import { useState } from "react";
import { useGameStore } from "../store";
import { LEVELS } from "../constants";

export function LevelTransition({
  onNext,
  onBonus,
}: {
  onNext: () => void;
  onBonus: () => void;
}) {
  const level = useGameStore((s) => s.level);
  const kicks = useGameStore((s) => s.kicks);
  const lastResult = useGameStore((s) => s.lastLevelResult);
  const stars = useGameStore((s) => s.stars);
  const bestTimes = useGameStore((s) => s.bestTimes);
  const levelEvents = useGameStore((s) => s.levelEvents);
  const [showTimeline, setShowTimeline] = useState(false);
  const isLast = level >= LEVELS.length;

  const earnedStars = lastResult?.stars ?? 1;
  const prevStars = stars[level] || 0;
  const timeStr = lastResult
    ? `${Math.floor(lastResult.time / 60)}:${String(Math.floor(lastResult.time % 60)).padStart(2, "0")}`
    : "--:--";
  const bestStr = bestTimes[level]
    ? `${Math.floor(bestTimes[level] / 60)}:${String(Math.floor(bestTimes[level] % 60)).padStart(2, "0")}`
    : "--:--";

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 backdrop-blur-md text-white animate-[fadein_0.3s_ease-out]">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-amber-400/30 rounded-3xl p-8 max-w-md w-full mx-4 shadow-[0_0_50px_rgba(251,146,60,0.25)] text-center relative overflow-hidden">
        {/* decorative top glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-60 h-40 bg-amber-500/20 blur-3xl rounded-full pointer-events-none" />

        <div className="text-6xl mb-1 animate-bounce relative">🎉</div>
        <h2 className="text-3xl font-black mb-1 bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent relative">
          第 {level} 关完成！
        </h2>
        <p className="text-white/60 mb-4 text-sm relative">
          本关踹击 <b className="text-amber-300">{kicks}</b> 次
        </p>

        {/* Star rating display */}
        <div className="flex items-center justify-center gap-2 mb-5 relative">
          {[1, 2, 3].map((s) => {
            const earned = s <= earnedStars;
            const wasPrev = s <= prevStars && !earned;
            return (
              <div
                key={s}
                className={`text-5xl transition-all duration-500 ${
                  earned
                    ? "scale-100 opacity-100 drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]"
                    : "scale-75 opacity-25 grayscale"
                }`}
                style={{
                  animationDelay: `${s * 0.15}s`,
                  animation: earned ? `popin 0.4s ease-out ${s * 0.15}s both` : undefined,
                }}
              >
                {earned ? "⭐" : "☆"}
              </div>
            );
          })}
        </div>

        {/* Stats grid */}
        {lastResult && (
          <div className="grid grid-cols-3 gap-2 mb-5 text-sm relative">
            <div className="bg-black/40 rounded-xl p-2.5 border border-white/5">
              <div className="text-white/50 text-[10px] uppercase tracking-wide">用时</div>
              <div className="text-lg font-bold tabular-nums text-white">{timeStr}</div>
              <div className="text-[9px] text-amber-300/70">最佳 {bestStr}</div>
            </div>
            <div className="bg-black/40 rounded-xl p-2.5 border border-white/5">
              <div className="text-white/50 text-[10px] uppercase tracking-wide">被发现</div>
              <div className={`text-lg font-bold ${lastResult.detections === 0 ? "text-emerald-300" : "text-red-300"}`}>
                {lastResult.detections}
              </div>
              <div className="text-[9px] text-white/40">次</div>
            </div>
            <div className="bg-black/40 rounded-xl p-2.5 border border-white/5">
              <div className="text-white/50 text-[10px] uppercase tracking-wide">扣血</div>
              <div className={`text-lg font-bold ${lastResult.damage === 0 ? "text-emerald-300" : "text-red-300"}`}>
                {lastResult.damage}
              </div>
              <div className="text-[9px] text-white/40">点</div>
            </div>
          </div>
        )}

        {/* Rating message */}
        <div className="mb-3 text-sm font-semibold relative">
          {earnedStars === 3 && <span className="text-amber-300">🏆 完美通关！零伤害零发现</span>}
          {earnedStars === 2 && <span className="text-emerald-300">👍 不错！再努力一点就完美了</span>}
          {earnedStars === 1 && <span className="text-white/70">✅ 通关！尝试不被发现获取更高评分</span>}
        </div>

        {/* Event timeline (collapsible) */}
        {levelEvents.length > 0 && (
          <div className="mb-4 relative">
            <button
              onClick={() => setShowTimeline((v) => !v)}
              className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-xl px-3 py-2 border border-white/10 transition-colors text-xs"
            >
              <span className="flex items-center gap-2 text-white/80">
                <span>📋</span>
                <span>本关事件回放 ({levelEvents.length})</span>
              </span>
              <span className="text-white/40">{showTimeline ? "▲ 收起" : "▼ 展开"}</span>
            </button>
            {showTimeline && (
              <div className="mt-2 bg-black/40 rounded-xl p-3 border border-white/5 max-h-48 overflow-y-auto">
                <div className="relative">
                  {/* vertical line */}
                  <div className="absolute left-3 top-1 bottom-1 w-px bg-white/15" />
                  <div className="space-y-1.5">
                    {levelEvents.map((ev, i) => {
                      const timeStr = `${Math.floor(ev.time / 60)}:${String(Math.floor(ev.time % 60)).padStart(2, "0")}`;
                      const isDanger = ev.type === "detected" || ev.type === "Attacked" || ev.type === "Patrol";
                      const isWarn = ev.type === "LookingBack" || ev.type === "PhoneFlashing";
                      return (
                        <div key={i} className="flex items-start gap-2 relative">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0 z-10 border-2 ${
                              isDanger
                                ? "bg-red-900/60 border-red-500/50"
                                : isWarn
                                ? "bg-amber-900/60 border-amber-500/50"
                                : "bg-slate-700/60 border-white/20"
                            }`}
                          >
                            {ev.icon}
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-mono tabular-nums text-white/40">
                                {timeStr}
                              </span>
                              <span
                                className={`text-[11px] ${
                                  isDanger ? "text-red-300" : isWarn ? "text-amber-300" : "text-white/80"
                                }`}
                              >
                                {ev.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!isLast ? (
          <>
            <div className="bg-gradient-to-br from-amber-950/40 to-orange-950/40 rounded-xl p-4 mb-5 border border-amber-500/20 relative">
              <div className="text-xs uppercase tracking-wider text-amber-300/70 mb-1">
                下一关
              </div>
              <div className="text-2xl font-bold text-amber-300">
                第 {level + 1} 关
              </div>
              <div className="text-sm text-white/70 mt-1">
                目标：{LEVELS[level].target} 次踹击
              </div>
              {level + 1 >= 3 && (
                <div className="text-[11px] text-orange-300/80 mt-1.5">
                  ⚠️ 难度提升：老板行为更频繁
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 relative">
              <button
                onClick={onNext}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 text-gray-900 font-bold text-lg hover:scale-[1.02] transition-transform shadow-lg shadow-emerald-500/30"
              >
                ▶ 开始下一关
              </button>
              <button
                onClick={onBonus}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-lg hover:scale-[1.02] transition-transform shadow-lg shadow-purple-500/30 relative overflow-hidden group"
              >
                <span className="relative z-10">🎁 奖励神人（FPS 彩蛋）</span>
                <span className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              </button>
            </div>
            <p className="text-white/40 text-xs mt-4 relative">
              💡 FPS 模式可任意痛击老板 30 秒，无胜负压力
            </p>
          </>
        ) : (
          <div className="text-white/60 relative">即将进入通关画面…</div>
        )}
      </div>
    </div>
  );
}
