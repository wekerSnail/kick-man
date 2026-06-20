"use client";

import { useGameStore } from "../store";

export function PauseMenu({ onShowSettings }: { onShowSettings?: () => void }) {
  const paused = useGameStore((s) => s.paused);
  const setPaused = useGameStore((s) => s.setPaused);
  const soundOn = useGameStore((s) => s.soundOn);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const level = useGameStore((s) => s.level);
  const kicks = useGameStore((s) => s.kicks);
  const target = useGameStore((s) => s.target);
  const minimap = useGameStore((s) => s.minimap);

  if (!paused) return null;

  const timeStr = minimap
    ? `${Math.floor(minimap.levelTime / 60)}:${String(Math.floor(minimap.levelTime % 60)).padStart(2, "0")}`
    : "0:00";

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-md text-white animate-[fadein_0.2s_ease-out]">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-white/15 rounded-3xl p-7 max-w-sm w-full mx-4 shadow-2xl text-center">
        <div className="text-5xl mb-2">⏸️</div>
        <h2 className="text-3xl font-black mb-1">游戏暂停</h2>
        <p className="text-white/50 text-sm mb-5">按 ESC 或点击下方按钮继续</p>

        <div className="grid grid-cols-3 gap-2 mb-5 text-sm">
          <div className="bg-white/5 rounded-lg p-2">
            <div className="text-white/50 text-[10px] uppercase">关卡</div>
            <div className="text-lg font-bold">{level}</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2">
            <div className="text-white/50 text-[10px] uppercase">踹击</div>
            <div className="text-lg font-bold">
              {kicks}<span className="text-white/40 text-xs">/{target}</span>
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-2">
            <div className="text-white/50 text-[10px] uppercase">用时</div>
            <div className="text-lg font-bold tabular-nums">{timeStr}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => setPaused(false)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 text-gray-900 font-bold text-lg hover:scale-[1.02] transition-transform shadow-lg"
          >
            ▶ 继续游戏
          </button>
          <button
            onClick={() => {
              toggleSound();
            }}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {soundOn ? "🔊 音效：开" : "🔇 音效：关"}
            <span className="text-white/40 text-xs">(M 键)</span>
          </button>
          <button
            onClick={() => {
              setPaused(false);
              onShowSettings?.();
            }}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 font-semibold transition-colors flex items-center justify-center gap-2"
          >
            ⚙️ 设置
          </button>
          <button
            onClick={() => {
              setPaused(false);
              useGameStore.getState().setScreen("start");
              // force engine to reset
              setTimeout(() => {
                const e = (window as unknown as { __engine?: { restartGame: () => void } }).__engine;
                if (e) e.restartGame();
                useGameStore.getState().setScreen("start");
              }, 50);
            }}
            className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-semibold transition-colors"
          >
            🏠 返回主菜单
          </button>
        </div>

        <div className="mt-5 pt-4 border-t border-white/10 text-[11px] text-white/40 space-y-0.5">
          <div>🎮 WASD 移动 · 左键 踹/砍 · 右键 投掷</div>
          <div>🔢 1-6 道具 · E 拾取 · ⏸ ESC 暂停 · 🔊 M 音效</div>
        </div>
      </div>
    </div>
  );
}
