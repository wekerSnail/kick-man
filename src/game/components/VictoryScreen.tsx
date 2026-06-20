"use client";

export function VictoryScreen({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-amber-900 via-orange-900 to-yellow-900 text-white overflow-hidden">
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

      <div className="relative text-center max-w-lg mx-4">
        <div className="text-8xl mb-4 animate-bounce">🏆</div>
        <h1 className="text-5xl font-black mb-3 bg-gradient-to-r from-yellow-200 via-amber-300 to-orange-400 bg-clip-text text-transparent">
          通关大吉！
        </h1>
        <p className="text-xl text-white/80 mb-2">
          你成功踹了老板 <b className="text-amber-300">一整百下</b>！
        </p>
        <p className="text-white/60 mb-8">
          从此办公室再无人敢让你加班 — 你是真正的<b className="text-pink-300">办公室之神</b>。
        </p>

        <div className="bg-black/40 rounded-2xl p-5 mb-8 border border-amber-400/20">
          <div className="text-sm text-white/70 leading-relaxed">
            <p className="mb-2">🏅 <b>成就解锁：</b></p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/5 rounded px-2 py-1">🥾 踹击大师</div>
              <div className="bg-white/5 rounded px-2 py-1">🥷 潜行达人</div>
              <div className="bg-white/5 rounded px-2 py-1">🧪 道具专家</div>
              <div className="bg-white/5 rounded px-2 py-1">🏏 武器行者</div>
              <div className="bg-white/5 rounded px-2 py-1">🎯 七关通关</div>
              <div className="bg-white/5 rounded px-2 py-1">👑 办公室之神</div>
            </div>
          </div>
        </div>

        <button
          onClick={onRestart}
          className="px-10 py-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-gray-900 font-bold text-lg hover:scale-105 transition-transform shadow-[0_0_40px_rgba(251,146,60,0.6)]"
        >
          🔄 再玩一次
        </button>
      </div>
    </div>
  );
}
