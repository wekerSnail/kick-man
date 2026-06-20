"use client";

import { useGameStore } from "../store";

export function GameOverScreen({ onRestart }: { onRestart: () => void }) {
  const deathDialogue = useGameStore((s) => s.deathDialogue);
  const level = useGameStore((s) => s.level);
  const kicks = useGameStore((s) => s.kicks);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-red-950/95 to-black/95 backdrop-blur-sm text-white animate-[fadein_0.5s_ease-out]">
      <div className="bg-black/50 border border-red-500/30 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl text-center">
        <div className="text-7xl mb-3">💀</div>
        <h2 className="text-4xl font-black mb-2 text-red-400">游戏结束</h2>
        <p className="text-white/60 mb-5">你被老板逮到了…</p>

        <div className="bg-red-950/50 border border-red-500/20 rounded-xl p-4 mb-6">
          <div className="text-xs uppercase tracking-wider text-red-300/70 mb-1">
            老板说
          </div>
          <div className="text-lg font-semibold text-white">
            💬 {deathDialogue || "今晚留下来加班"}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-white/50 text-xs">到达关卡</div>
            <div className="text-2xl font-bold">第 {level} 关</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-white/50 text-xs">累计踹击</div>
            <div className="text-2xl font-bold">{kicks} 次</div>
          </div>
        </div>

        <button
          onClick={onRestart}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-gray-900 font-bold text-lg hover:scale-[1.02] transition-transform shadow-lg"
        >
          🔄 重新开始
        </button>
        <p className="text-white/30 text-xs mt-4">
          下次记得用隐身药水和键盘盾哦
        </p>
      </div>
    </div>
  );
}
