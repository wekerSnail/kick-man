"use client";

import { useState } from "react";
import { useGameStore, type UserSettings } from "../store";
import { audio } from "../audio/AudioManager";

export function SettingsMenu({ onClose }: { onClose: () => void }) {
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  const resetAllProgress = useGameStore((s) => s.resetAllProgress);
  const soundOn = useGameStore((s) => s.soundOn);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleVolume = (v: number) => {
    setSettings({ volume: v });
    audio.setVolume(v);
    if (!soundOn && v > 0) {
      // re-enable if user raises volume
      toggleSound();
      audio.setEnabled(true);
    } else if (soundOn && v === 0) {
      toggleSound();
      audio.setEnabled(false);
    }
  };

  const handleToggle = (key: keyof UserSettings, value: boolean) => {
    setSettings({ [key]: value } as Partial<UserSettings>);
  };

  const handleReset = () => {
    resetAllProgress();
    setShowResetConfirm(false);
    setTimeout(() => onClose(), 400);
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md text-white animate-[fadein_0.2s_ease-out]">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/15 rounded-3xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-black flex items-center gap-2">
            <span>⚙️</span>
            <span>设置</span>
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5">
          {/* Volume slider */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <span>🔊</span>
                <span>主音量</span>
              </label>
              <span className="text-xs font-mono tabular-nums text-amber-300">
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.volume}
              onChange={(e) => handleVolume(parseFloat(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-white/40 mt-0.5">
              <span>静音</span>
              <span>默认 35%</span>
              <span>最大</span>
            </div>
          </section>

          {/* Toggle switches */}
          <section className="space-y-2.5">
            <ToggleRow
              icon="👁️"
              label="Boss 视野锥"
              desc="地面显示半透明扇形检测区"
              value={settings.visionCone}
              onChange={(v) => handleToggle("visionCone", v)}
            />
            <ToggleRow
              icon="🗺️"
              label="小地图"
              desc="左上角显示俯视图与位置"
              value={settings.minimap}
              onChange={(v) => handleToggle("minimap", v)}
            />
            <ToggleRow
              icon="➡️"
              label="检测方向指示"
              desc="Boss 警觉时屏幕显示方向箭头"
              value={settings.detectionArrow}
              onChange={(v) => handleToggle("detectionArrow", v)}
            />
            <ToggleRow
              icon="📳"
              label="屏幕震动"
              desc="命中 Boss 时镜头抖动"
              value={settings.screenshake}
              onChange={(v) => handleToggle("screenshake", v)}
            />
          </section>

          {/* Sound on/off quick toggle */}
          <section>
            <button
              onClick={() => {
                toggleSound();
                audio.setEnabled(!soundOn);
              }}
              className={`w-full py-2.5 rounded-xl border transition-colors flex items-center justify-center gap-2 font-semibold ${
                soundOn
                  ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/30"
                  : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
              }`}
            >
              {soundOn ? "🔊 音效已开启" : "🔇 音效已关闭"}
              <span className="text-white/40 text-xs">(M 键切换)</span>
            </button>
          </section>

          {/* Danger zone */}
          <section className="pt-3 border-t border-white/10">
            <div className="text-[10px] uppercase tracking-wider text-red-300/70 mb-2">
              危险区
            </div>
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-full py-2 rounded-xl bg-red-950/50 border border-red-500/30 text-red-300 hover:bg-red-900/40 transition-colors text-sm font-semibold"
              >
                🗑️ 清除所有进度
              </button>
            ) : (
              <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3">
                <div className="text-sm text-red-200 mb-3 text-center">
                  确定清除所有进度？包括：
                  <ul className="text-[11px] text-red-300/80 mt-1.5 space-y-0.5 text-left list-disc list-inside">
                    <li>已获得的星数与最佳时间</li>
                    <li>已解锁的成就</li>
                    <li>累计踹击数与到达关卡</li>
                    <li>已查看的变体教程记录</li>
                    <li>自定义设置（将重置为默认）</li>
                  </ul>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-semibold"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-bold"
                  >
                    确认清除
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-white/40">
          <span>设置自动保存到浏览器</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-400 to-green-500 text-gray-900 text-xs font-bold hover:scale-[1.02] transition-transform"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  desc,
  value,
  onChange,
}: {
  icon: string;
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2 border border-white/5">
      <div className="flex items-center gap-2.5">
        <span className="text-lg">{icon}</span>
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <div className="text-[10px] text-white/40">{desc}</div>
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          value ? "bg-emerald-500" : "bg-white/15"
        }`}
        aria-pressed={value}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}
