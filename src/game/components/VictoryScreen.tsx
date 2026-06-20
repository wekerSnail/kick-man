"use client";

import { useGameStore } from "../store";
import { LEVELS } from "../constants";
import { ACHIEVEMENT_COUNT } from "../achievements";

export function VictoryScreen({
  onRestart,
  onBackToMenu,
}: {
  onRestart: () => void;
  onBackToMenu?: () => void;
}) {
  const stars = useGameStore((s) => s.stars);
  const achievements = useGameStore((s) => s.achievements);
  const totalKicks = useGameStore((s) => s.totalKicks);
  const bestTimes = useGameStore((s) => s.bestTimes);
  const defeatedVariants = useGameStore((s) => s.defeatedVariants);

  const totalStars = Object.values(stars).reduce((a, b) => a + b, 0);
  const maxStars = LEVELS.length * 3;
  const achievementCount = Object.values(achievements).filter(Boolean).length;
  const maxAchievements = ACHIEVEMENT_COUNT;
  const totalBestTime = Object.values(bestTimes).reduce((a, b) => a + b, 0);
  const totalBestStr = `${Math.floor(totalBestTime / 60)}:${String(Math.floor(totalBestTime % 60)).padStart(2, "0")}`;
  const defeatedVariantsCount = Object.values(defeatedVariants).filter(Boolean).length;

  // Compute rating based on stars + achievements
  const ratingPct = (totalStars / maxStars) * 0.6 + (achievementCount / maxAchievements) * 0.4;
  let ratingLabel: string;
  let ratingIcon: string;
  let ratingColor: string;
  if (ratingPct >= 0.95) {
    ratingLabel = "办公室之神";
    ratingIcon = "👑";
    ratingColor = "from-yellow-200 via-amber-300 to-orange-400";
  } else if (ratingPct >= 0.75) {
    ratingLabel = "潜行大师";
    ratingIcon = "🥷";
    ratingColor = "from-purple-200 via-pink-300 to-amber-300";
  } else if (ratingPct >= 0.5) {
    ratingLabel = "踹击高手";
    ratingIcon = "🦵";
    ratingColor = "from-emerald-200 via-amber-300 to-orange-400";
  } else {
    ratingLabel = "新手通关";
    ratingIcon = "🎉";
    ratingColor = "from-sky-200 via-emerald-300 to-amber-300";
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-amber-900 via-orange-900 to-yellow-900 text-white overflow-auto">
      {/* confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute text-2xl"
            style={{
              left: `${(i * 53) % 100}%`,
              top: `-10%`,
              animation: `confetti ${3 + (i % 4)}s linear ${i * 0.15}s infinite`,
            }}
          >
            {["🎉", "🎊", "✨", "🏆", "⭐", "💫"][i % 6]}
          </div>
        ))}
      </div>

      <div className="relative text-center max-w-lg mx-4 my-8">
        <div className="text-8xl mb-4 animate-bounce drop-shadow-2xl">🏆</div>
        <h1 className="text-5xl font-black mb-3 bg-gradient-to-r from-yellow-200 via-amber-300 to-orange-400 bg-clip-text text-transparent drop-shadow-lg">
          通关大吉！
        </h1>
        <p className="text-xl text-white/80 mb-2">
          你成功踹了神人 <b className="text-amber-300">一整百下</b>！
        </p>
        <p className="text-white/60 mb-6">
          从此办公室再无人敢让你加班 — 你是真正的<b className="text-pink-300">办公室之神</b>。
        </p>

        {/* Rating banner */}
        <div className="bg-black/40 rounded-2xl p-5 mb-6 border border-amber-400/30 backdrop-blur-sm">
          <div className="text-xs uppercase tracking-wider text-amber-300/70 mb-2">
            综合评级
          </div>
          <div className="text-6xl mb-2 animate-pulse">{ratingIcon}</div>
          <div
            className={`text-2xl font-black bg-gradient-to-r ${ratingColor} bg-clip-text text-transparent`}
          >
            {ratingLabel}
          </div>
          <div className="text-xs text-white/50 mt-1">
            综合得分 {Math.round(ratingPct * 100)} / 100
          </div>
        </div>

        {/* Run statistics */}
        <div className="bg-black/40 rounded-2xl p-5 mb-6 border border-amber-400/20">
          <div className="text-sm text-white/70 mb-3 font-semibold">
            📊 本局统计
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <StatCard icon="⭐" label="总星数" value={`${totalStars} / ${maxStars}`} highlight={totalStars === maxStars} />
            <StatCard icon="🏆" label="成就解锁" value={`${achievementCount} / ${maxAchievements}`} highlight={achievementCount === maxAchievements} />
            <StatCard icon="🦵" label="累计踹击" value={`${totalKicks}`} />
            <StatCard icon="⏱️" label="总最佳用时" value={totalBestStr} />
            <StatCard icon="🎯" label="击败变体" value={`${defeatedVariantsCount} / 5`} highlight={defeatedVariantsCount === 5} />
            <StatCard icon="📅" label="到达关卡" value={`${LEVELS.length} / ${LEVELS.length}`} highlight />
          </div>
        </div>

        {/* Stars per level */}
        <div className="bg-black/40 rounded-2xl p-5 mb-6 border border-amber-400/20">
          <div className="text-sm text-white/70 mb-3 font-semibold">
            🎯 关卡星数
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {LEVELS.map((l) => {
              const s = stars[l.level] || 0;
              return (
                <div
                  key={l.level}
                  className="bg-white/5 rounded-lg p-1.5 border border-white/5"
                >
                  <div className="text-[9px] text-white/50">L{l.level}</div>
                  <div className="text-sm leading-none mt-0.5">
                    {s > 0 ? "⭐".repeat(s) : <span className="text-white/20">☆☆☆</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onRestart}
            className="px-10 py-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-gray-900 font-bold text-lg hover:scale-105 transition-transform shadow-[0_0_40px_rgba(251,146,60,0.6)]"
          >
            🔄 再玩一次
          </button>
          {onBackToMenu && (
            <button
              onClick={onBackToMenu}
              className="px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 font-semibold transition-colors text-sm"
            >
              🏠 返回主菜单
            </button>
          )}
        </div>
        <p className="text-white/40 text-xs mt-5">
          💡 在主菜单可重玩任意关卡刷三星 · 查看图鉴
        </p>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: string;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-2.5 py-2 border flex items-center justify-between ${
        highlight
          ? "bg-amber-500/15 border-amber-400/40"
          : "bg-white/5 border-white/5"
      }`}
    >
      <span className="text-white/70 flex items-center gap-1.5">
        <span>{icon}</span>
        <span>{label}</span>
      </span>
      <span className={`font-bold tabular-nums ${highlight ? "text-amber-300" : "text-white"}`}>
        {value}
      </span>
    </div>
  );
}
