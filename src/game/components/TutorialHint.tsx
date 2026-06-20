"use client";

import { useEffect } from "react";
import { useGameStore } from "../store";
import { audio } from "../audio/AudioManager";

interface VariantInfo {
  icon: string;
  name: string;
  color: string;
  bgGradient: string;
  borderColor: string;
  description: string;
  tip: string;
  weakness: string;
}

const VARIANT_INFO: Record<string, VariantInfo> = {
  glasses: {
    icon: "🤓",
    name: "戴眼镜的神人",
    color: "text-sky-300",
    bgGradient: "from-sky-950 via-slate-900 to-slate-900",
    borderColor: "border-sky-400/40",
    description: "这位神人戴着厚厚的眼镜，视野范围更广（+40%），更远的距离就能发现你。",
    tip: "👉 半圆检测范围 5→7，回头检测 6→8，巡逻 7→8",
    weakness: "💡 烟雾弹、隐身药水、键盘盾都能有效对抗；藏身点依然有效",
  },
  coffee: {
    icon: "☕",
    name: "喝咖啡的神人",
    color: "text-orange-300",
    bgGradient: "from-orange-950 via-amber-950 to-slate-900",
    borderColor: "border-orange-400/40",
    description: "咖啡因让神人格外警觉！所有行为计时器额外加速 ×0.85，更频繁地回头/巡逻/开会。",
    tip: "👉 神人动作更快，留给你的安全窗口更短",
    weakness: "💡 噪音器依然能干扰；加速鞋+隐身药水组合可以快速突袭",
  },
  headphones: {
    icon: "🎧",
    name: "戴耳机的神人",
    color: "text-purple-300",
    bgGradient: "from-purple-950 via-fuchsia-950 to-slate-900",
    borderColor: "border-purple-400/40",
    description: "神人戴着耳机听音乐，完全免疫噪音器的干扰！但视野和正常一样。",
    tip: "👉 噪音器对此变体无效，不要浪费道具",
    weakness: "💡 用烟雾弹挡视线、隐身药水穿检测区；咖啡杯、耳机让他偶尔分心",
  },
  rage: {
    icon: "😡",
    name: "暴怒的神人",
    color: "text-red-300",
    bgGradient: "from-red-950 via-rose-950 to-slate-900",
    borderColor: "border-red-400/50",
    description: "终极形态！每 12 秒进入 4 秒【暴怒状态】，无视距离/方向全图检测！并且需要 4 次踹击才能击倒。",
    tip: "👉 暴怒时地面会出现红色光环，立即躲进藏身点或用隐身药水",
    weakness: "💡 暴怒间隙（8 秒冷静期）是攻击良机；烟雾弹可挡暴怒检测",
  },
};

export function TutorialHint() {
  const tutorial = useGameStore((s) => s.variantTutorial);
  const dismiss = useGameStore((s) => s.dismissVariantTutorial);
  const paused = useGameStore((s) => s.paused);

  // Pause engine while tutorial is open
  useEffect(() => {
    if (tutorial) {
      // Pause the engine via direct ref to avoid changing store.paused (which would show pause menu)
      const e = (window as unknown as { __engine?: { paused: boolean } }).__engine;
      if (e) e.paused = true;
    } else {
      const e = (window as unknown as { __engine?: { paused: boolean; screen: string } }).__engine;
      if (e && e.screen === "playing") e.paused = false;
    }
  }, [tutorial]);

  if (!tutorial || paused) return null;
  const info = VARIANT_INFO[tutorial.variant];
  if (!info) return null;

  const handleClose = () => {
    audio.uiDismiss();
    dismiss();
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm text-white animate-[fadein_0.25s_ease-out]">
      <div
        className={`relative bg-gradient-to-br ${info.bgGradient} border-2 ${info.borderColor} rounded-3xl p-6 max-w-md w-full mx-4 shadow-[0_0_60px_rgba(0,0,0,0.6)] animate-[popin_0.3s_ease-out]`}
      >
        {/* decorative glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-24 bg-white/10 blur-3xl rounded-full pointer-events-none" />

        {/* New variant badge */}
        <div className="flex items-center justify-center gap-2 mb-3 relative">
          <span className="text-[10px] uppercase tracking-widest text-white/60 bg-white/10 px-2 py-0.5 rounded-full border border-white/20">
            新神人形态
          </span>
        </div>

        {/* Icon + name */}
        <div className="text-center mb-4 relative">
          <div className="text-7xl mb-2 animate-bounce drop-shadow-2xl">{info.icon}</div>
          <h2 className={`text-2xl font-black ${info.color}`}>{info.name}</h2>
        </div>

        {/* Description */}
        <div className="bg-black/40 rounded-xl p-3 mb-3 border border-white/10 relative">
          <p className="text-sm text-white/90 leading-relaxed">{info.description}</p>
        </div>

        {/* Mechanic tip */}
        <div className="bg-black/30 rounded-xl p-3 mb-3 border border-white/5 relative">
          <div className="text-[10px] uppercase tracking-wider text-amber-300/70 mb-1">机制</div>
          <p className="text-sm text-white/85 leading-relaxed">{info.tip}</p>
        </div>

        {/* Weakness / strategy */}
        <div className="bg-emerald-950/40 rounded-xl p-3 mb-5 border border-emerald-500/20 relative">
          <div className="text-[10px] uppercase tracking-wider text-emerald-300/80 mb-1">应对策略</div>
          <p className="text-sm text-emerald-100/90 leading-relaxed">{info.weakness}</p>
        </div>

        <button
          onClick={handleClose}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 text-gray-900 font-bold text-lg hover:scale-[1.02] transition-transform shadow-lg shadow-emerald-500/30 relative"
        >
          ✅ 我知道了，开始潜行！
        </button>
        <p className="text-white/40 text-[10px] mt-3 text-center">
          每种变体首次出现时仅显示一次 · 可在图鉴中查看
        </p>
      </div>
    </div>
  );
}
