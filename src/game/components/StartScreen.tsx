"use client";

import { useState } from "react";
import { LEVELS, WEAPONS, CONSUMABLES } from "../constants";
import { useGameStore } from "../store";
import { ACHIEVEMENT_COUNT } from "../achievements";

const VARIANT_FOR_LEVEL = (level: number): string => {
  if (level >= 7) return "😡";
  if (level >= 6) return "🎧";
  if (level === 5) return "☕";
  if (level >= 3) return "🤓";
  return "👨‍💼";
};

export function StartScreen({ onStart, onSelectLevel, onShowGallery, onShowSettings, onShowKeyboardHelp }: { onStart: () => void; onSelectLevel?: (level: number) => void; onShowGallery?: () => void; onShowSettings?: () => void; onShowKeyboardHelp?: () => void }) {
  const [showHelp, setShowHelp] = useState(false);
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const stars = useGameStore((s) => s.stars);
  const achievements = useGameStore((s) => s.achievements);
  const totalStars = Object.values(stars).reduce((a, b) => a + b, 0);
  const maxStars = LEVELS.length * 3;
  const achievementCount = Object.values(achievements).filter(Boolean).length;
  const hasProgress = totalStars > 0 || achievementCount > 0;
  // max unlocked level = maxLevelReached (persisted), or derived from stars
  const maxLevelReached = useGameStore((s) => s.maxLevelReached);
  const totalKicks = useGameStore((s) => s.totalKicks);
  const maxUnlocked = Math.max(
    1,
    maxLevelReached,
    ...Object.keys(stars).map(Number).filter(l => stars[l] > 0).map(l => l + 1).concat(1)
  );
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white">
      {/* animated bg shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-10 blur-2xl"
            style={{
              width: `${80 + (i * 37) % 200}px`,
              height: `${80 + (i * 37) % 200}px`,
              left: `${(i * 83) % 100}%`,
              top: `${(i * 61) % 100}%`,
              background: ["#f87171", "#fbbf24", "#34d399", "#60a5fa"][i % 4],
              animation: `floaty ${6 + (i % 5)}s ease-in-out ${i * 0.3}s infinite alternate`,
            }}
          />
        ))}
      </div>

      <div className="relative max-w-2xl w-full mx-4 text-center">
        <div className="inline-block mb-2 text-7xl animate-bounce">🦵</div>
        <h1 className="text-6xl font-black tracking-tight mb-2 bg-gradient-to-r from-amber-300 via-orange-400 to-red-500 bg-clip-text text-transparent drop-shadow-lg">
          踹他一百下
        </h1>
        <p className="text-white/70 text-lg mb-1">
          办公室潜行动作游戏 · 第三人称视角
        </p>
        <p className="text-white/50 text-sm mb-5">
          趁老板不注意，偷偷靠近踹他！躲避视线、利用道具、完成踹击目标过关
        </p>

        {/* Progress summary (only if returning player) */}
        {hasProgress && (
          <div className="flex items-center justify-center gap-3 mb-6 flex-wrap">
            <div className="bg-black/40 backdrop-blur-sm rounded-xl px-4 py-2 border border-amber-400/20 flex items-center gap-2">
              <span className="text-xl">⭐</span>
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-wider text-white/50 leading-none">总星数</div>
                <div className="text-lg font-bold tabular-nums leading-tight">
                  {totalStars}<span className="text-white/40 text-xs">/{maxStars}</span>
                </div>
              </div>
            </div>
            <div className="bg-black/40 backdrop-blur-sm rounded-xl px-4 py-2 border border-purple-400/20 flex items-center gap-2">
              <span className="text-xl">🏆</span>
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-wider text-white/50 leading-none">成就</div>
                <div className="text-lg font-bold tabular-nums leading-tight">
                  {achievementCount}<span className="text-white/40 text-xs">/{ACHIEVEMENT_COUNT}</span>
                </div>
              </div>
            </div>
            <div className="bg-black/40 backdrop-blur-sm rounded-xl px-4 py-2 border border-rose-400/20 flex items-center gap-2">
              <span className="text-xl">🦵</span>
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-wider text-white/50 leading-none">累计踹击</div>
                <div className="text-lg font-bold tabular-nums leading-tight">
                  {totalKicks}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center gap-3 mb-8">
          <button
            onClick={onStart}
            className="group relative px-12 py-4 text-2xl font-bold rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-gray-900 shadow-[0_0_40px_rgba(251,146,60,0.5)] hover:shadow-[0_0_60px_rgba(251,146,60,0.8)] hover:scale-105 transition-all"
          >
            ▶ 开始游戏
            <span className="absolute -top-3 -right-3 text-sm bg-gradient-to-br from-rose-500 to-red-600 text-white px-3 py-1 rounded-full font-bold shadow-lg animate-bounce border-2 border-white/30">
              7 关
            </span>
          </button>
          <button
            onClick={() => setShowHelp((s) => !s)}
            className="text-white/70 hover:text-white text-sm underline underline-offset-4 font-medium"
          >
            {showHelp ? "收起说明" : "查看玩法说明"}
          </button>
          {hasProgress && (
            <button
              onClick={() => setShowLevelSelect((s) => !s)}
              className="text-amber-300/90 hover:text-amber-200 text-sm underline underline-offset-4 font-medium"
            >
              {showLevelSelect ? "收起关卡选择" : "🎯 选择关卡（刷星）"}
            </button>
          )}
          <button
            onClick={() => onShowGallery?.()}
            className="text-sky-300/90 hover:text-sky-200 text-sm underline underline-offset-4 font-medium"
          >
            📖 图鉴（成就+道具）
          </button>
          <button
            onClick={() => onShowSettings?.()}
            className="text-white/60 hover:text-white text-sm underline underline-offset-4 font-medium"
          >
            ⚙️ 设置
          </button>
          <button
            onClick={() => onShowKeyboardHelp?.()}
            className="text-white/60 hover:text-white text-sm underline underline-offset-4 font-medium"
          >
            ⌨️ 快捷键
          </button>
        </div>

        {/* Level select panel */}
        {showLevelSelect && hasProgress && (
          <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-amber-400/20 mb-6 max-w-md mx-auto animate-[popin_0.25s_ease-out]">
            <div className="text-amber-300 font-bold text-sm mb-2 text-center">选择关卡重玩</div>
            <div className="grid grid-cols-4 gap-2">
              {LEVELS.map((l) => {
                const unlocked = l.level <= maxUnlocked;
                const sCount = stars[l.level] || 0;
                return (
                  <button
                    key={l.level}
                    disabled={!unlocked}
                    onClick={() => onSelectLevel?.(l.level)}
                    className={`relative rounded-lg p-2 border-2 transition-all ${
                      unlocked
                        ? "border-amber-400/40 bg-amber-400/10 hover:bg-amber-400/20 hover:scale-105 cursor-pointer"
                        : "border-white/10 bg-black/30 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <div className="text-[9px] text-white/50 uppercase">第{l.level}关</div>
                    <div className="text-lg font-bold">{VARIANT_FOR_LEVEL(l.level)}</div>
                    <div className="text-[9px] text-white/40">{l.target}</div>
                    <div className="text-[10px] leading-none mt-0.5">
                      {sCount > 0 ? "⭐".repeat(sCount) : <span className="text-white/20">☆☆☆</span>}
                    </div>
                    {!unlocked && (
                      <div className="absolute inset-0 flex items-center justify-center text-lg">
                        🔒
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-white/40 text-center mt-2">
              通关解锁下一关 · 重玩可刷新星数
            </div>
          </div>
        )}

        {showHelp && (
          <div className="text-left bg-black/40 backdrop-blur-md rounded-2xl p-5 border border-white/10 space-y-3 animate-[popin_0.25s_ease-out]">
            <div>
              <h3 className="text-amber-300 font-bold mb-1">🎮 操作</h3>
              <ul className="text-sm text-white/80 space-y-0.5">
                <li>• <b>WASD</b> 移动（碰墙会沿墙滑动）</li>
                <li>• <b>鼠标左键</b> 踹击 / 挥砍武器</li>
                <li>• <b>鼠标右键长按</b> 蓄力投掷（仅狼牙棒/棒球棒）</li>
                <li>• <b>数字键 1-6</b> 使用背包道具</li>
                <li>• <b>E</b> 拾取附近道具（也会自动拾取）</li>
              </ul>
            </div>
            <div>
              <h3 className="text-amber-300 font-bold mb-1">🥷 潜行技巧</h3>
              <ul className="text-sm text-white/80 space-y-0.5">
                <li>• 老板<b className="text-red-300">回头/被攻击后/巡逻</b>时会检测你</li>
                <li>• 蹲在<b className="text-emerald-300">盆栽/书架/沙发</b>旁可隐藏</li>
                <li>• 使用<b className="text-sky-300">隐身药水</b>免疫所有检测</li>
                <li>• <b className="text-amber-300">键盘盾</b>被发现时只扣 0.5 血</li>
                <li>• 老板<b className="text-purple-300">开会</b>时攻击会被格挡，武器被消耗！</li>
              </ul>
            </div>
            <div>
              <h3 className="text-amber-300 font-bold mb-1">🏏 武器</h3>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {Object.values(WEAPONS).map((w) => (
                  <div key={w.kind} className="bg-white/5 rounded px-2 py-1 flex items-center gap-1.5">
                    <span className="text-base">{w.icon}</span>
                    <span>{w.name}</span>
                    <span className="text-white/50">·{w.hits}击</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-amber-300 font-bold mb-1">🧪 道具</h3>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {Object.values(CONSUMABLES).map((c) => (
                  <div key={c.kind} className="bg-white/5 rounded px-2 py-1 flex items-center gap-1.5">
                    <span className="text-base">{c.icon}</span>
                    <span>{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-amber-300 font-bold mb-1">🎯 关卡目标</h3>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {LEVELS.map((l) => (
                  <span key={l.level} className="bg-white/5 rounded px-2 py-0.5">
                    第{l.level}关: {l.target}次
                  </span>
                ))}
              </div>
            </div>
            <div className="text-xs text-purple-300/80 pt-1 border-t border-white/10">
              💡 通关每关后可选择进入<b>彩蛋 FPS 模式</b>痛击老板 30 秒！
            </div>
          </div>
        )}

        <p className="text-white/50 text-xs mt-6">
          点击开始即视为同意被老板扣工资 · Powered by Three.js
        </p>
      </div>
    </div>
  );
}
