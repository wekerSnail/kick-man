"use client";

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
  const isLast = level >= LEVELS.length;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm text-white animate-[fadein_0.3s_ease-out]">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-amber-400/30 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl text-center">
        <div className="text-6xl mb-2 animate-bounce">🎉</div>
        <h2 className="text-3xl font-black mb-1">
          第 {level} 关完成！
        </h2>
        <p className="text-white/60 mb-6">
          本关踹击 <b className="text-amber-300">{kicks}</b> 次 · 干得漂亮
        </p>

        {!isLast ? (
          <>
            <div className="bg-black/40 rounded-xl p-4 mb-6 border border-white/10">
              <div className="text-xs uppercase tracking-wider text-white/50 mb-1">
                下一关
              </div>
              <div className="text-2xl font-bold text-amber-300">
                第 {level + 1} 关
              </div>
              <div className="text-sm text-white/70 mt-1">
                目标：{LEVELS[level].target} 次踹击
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={onNext}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 text-gray-900 font-bold text-lg hover:scale-[1.02] transition-transform shadow-lg"
              >
                ▶ 开始下一关
              </button>
              <button
                onClick={onBonus}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-lg hover:scale-[1.02] transition-transform shadow-lg relative overflow-hidden group"
              >
                <span className="relative z-10">🎁 奖励神人（FPS 彩蛋）</span>
                <span className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              </button>
            </div>
            <p className="text-white/40 text-xs mt-4">
              💡 FPS 模式可任意痛击老板 30 秒，无胜负压力
            </p>
          </>
        ) : (
          <div className="text-white/60">即将进入通关画面…</div>
        )}
      </div>
    </div>
  );
}
