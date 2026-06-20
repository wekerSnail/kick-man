"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "../store";
import { audio } from "../audio/AudioManager";

interface Step {
  icon: string;
  title: string;
  body: string;
  highlight?: string;
}

const STEPS: Step[] = [
  {
    icon: "🎮",
    title: "欢迎来到踹他一百下！",
    body: "你的目标是偷偷靠近神人，趁他不注意踹他 — 完成目标踹击数过关。",
    highlight: "注意：被神人发现会扣血，3 次扣血就 game over！",
  },
  {
    icon: "🕹️",
    title: "基础操作",
    body: "WASD 移动（碰墙会沿墙滑动）· 鼠标左键 踹击 · 鼠标右键长按 蓄力投掷武器 · 数字键 1-6 使用背包道具 · E 拾取附近道具",
  },
  {
    icon: "👁️",
    title: "看懂神人状态",
    body: "右上角面板显示神人当前状态。绿色=安全（正常办公/手机响）；黄/橙色=警觉（回头看/被惊动）；红色=危险（巡逻中）。地面也会显示半透明扇形检测区。",
    highlight: "Boss 头顶的警觉度条满了会触发回头看！",
  },
  {
    icon: "🌿",
    title: "学会隐藏",
    body: "蹲在盆栽、书架、沙发旁可隐藏（状态显示「隐藏中」）。被神人回头看时立即躲进藏身点。",
  },
  {
    icon: "🧪",
    title: "善用道具",
    body: "道具会自动掉落。隐身药水免疫所有检测 5 秒；键盘盾被发现时只扣 0.5 血；加速鞋移动速度 x2；烟雾弹挡视线；噪音器吸引神人。",
  },
  {
    icon: "🎯",
    title: "完成踹击目标",
    body: "左下角显示踹击进度（如 0/10）。完成目标过关，可进入 FPS 彩蛋模式痛击神人 30 秒。零伤害零发现 = 3 星完美通关！",
    highlight: "现在去试试看 — 趁神人办公时绕到背后踹他！",
  },
];

export function Level1Tutorial() {
  const show = useGameStore((s) => s.showLevel1Tutorial);
  const dismiss = useGameStore((s) => s.dismissLevel1Tutorial);
  const [step, setStep] = useState(0);

  // Reset step when tutorial opens (deferred to avoid setState-in-effect)
  useEffect(() => {
    if (show) {
      const id = window.requestAnimationFrame(() => setStep(0));
      return () => window.cancelAnimationFrame(id);
    }
  }, [show]);

  // Pause engine while tutorial is open
  useEffect(() => {
    if (show) {
      const e = (window as unknown as { __engine?: { paused: boolean } }).__engine;
      if (e) e.paused = true;
    } else {
      const e = (window as unknown as { __engine?: { paused: boolean; screen: string } }).__engine;
      if (e && e.screen === "playing") e.paused = false;
    }
  }, [show]);

  if (!show) return null;

  const isLast = step === STEPS.length - 1;
  const s = STEPS[step];

  const handleNext = () => {
    if (isLast) {
      audio.uiDismiss();
      dismiss();
    } else {
      audio.uiPopup();
      setStep((x) => x + 1);
    }
  };

  const handleSkip = () => {
    audio.uiDismiss();
    dismiss();
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-sm text-white animate-[fadein_0.25s_ease-out]">
      <div className="relative bg-gradient-to-br from-slate-900 via-emerald-950/40 to-slate-900 border-2 border-emerald-400/40 rounded-3xl p-6 max-w-md w-full mx-4 shadow-[0_0_60px_rgba(16,185,129,0.25)] animate-[popin_0.3s_ease-out]">
        {/* decorative glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-24 bg-emerald-500/15 blur-3xl rounded-full pointer-events-none" />

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-4 relative">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? "w-6 bg-emerald-400"
                  : i < step
                  ? "w-1.5 bg-emerald-400/60"
                  : "w-1.5 bg-white/20"
              }`}
              aria-label={`跳到步骤 ${i + 1}`}
            />
          ))}
        </div>

        {/* Step badge */}
        <div className="flex items-center justify-center gap-2 mb-3 relative">
          <span className="text-[10px] uppercase tracking-widest text-emerald-300/80 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-400/30">
            新手教程 · {step + 1} / {STEPS.length}
          </span>
        </div>

        {/* Icon + title */}
        <div className="text-center mb-4 relative">
          <div className="text-6xl mb-2 animate-bounce drop-shadow-2xl">{s.icon}</div>
          <h2 className="text-xl font-black text-emerald-200">{s.title}</h2>
        </div>

        {/* Body */}
        <div className="bg-black/40 rounded-xl p-3 mb-3 border border-white/10 relative">
          <p className="text-sm text-white/90 leading-relaxed">{s.body}</p>
        </div>

        {/* Highlight callout */}
        {s.highlight && (
          <div className="bg-amber-950/40 rounded-xl p-3 mb-5 border border-amber-500/30 relative animate-[pulse_2s_ease-in-out_infinite]">
            <p className="text-sm text-amber-100/95 leading-relaxed flex items-start gap-2">
              <span className="text-base">💡</span>
              <span>{s.highlight}</span>
            </p>
          </div>
        )}

        {!s.highlight && <div className="mb-5" />}

        {/* Buttons */}
        <div className="flex gap-2 relative">
          {!isLast && (
            <button
              onClick={handleSkip}
              className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 font-semibold transition-colors text-sm"
            >
              跳过
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 text-gray-900 font-bold text-base hover:scale-[1.02] transition-transform shadow-lg shadow-emerald-500/30"
          >
            {isLast ? "🚀 开始潜行！" : "下一步 →"}
          </button>
        </div>
        <p className="text-white/30 text-[10px] mt-3 text-center">
          教程仅显示一次 · 可在主菜单"查看玩法说明"随时复习
        </p>
      </div>
    </div>
  );
}
