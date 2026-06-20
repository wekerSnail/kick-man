"use client";

import { useGameStore } from "../store";
import {
  WEAPONS,
  CONSUMABLES,
  LEVELS,
} from "../constants";
import { isWeapon } from "../store";
import type { WeaponKind, ConsumableKind } from "../types";

const BOSS_STATE_LABEL: Record<string, { label: string; color: string }> = {
  Normal: { label: "正常办公", color: "bg-emerald-500" },
  PhoneFlashing: { label: "手机响", color: "bg-sky-400" },
  LookingBack: { label: "回头看！", color: "bg-amber-500" },
  Attacked: { label: "被攻击回头", color: "bg-red-500" },
  Meeting: { label: "开会中", color: "bg-purple-500" },
  Patrol: { label: "巡逻中", color: "bg-orange-500" },
  Stunned: { label: "眩晕", color: "bg-yellow-400" },
  Distracted: { label: "被干扰", color: "bg-pink-400" },
};

export function HUD() {
  const level = useGameStore((s) => s.level);
  const kicks = useGameStore((s) => s.kicks);
  const target = useGameStore((s) => s.target);
  const hp = useGameStore((s) => s.hp);
  const bossState = useGameStore((s) => s.bossState);
  const status = useGameStore((s) => s.status);
  const inventory = useGameStore((s) => s.inventory);
  const selectedSlot = useGameStore((s) => s.selectedSlot);
  const throwCharge = useGameStore((s) => s.throwCharge);
  const equippedWeapon = useGameStore((s) => s.equippedWeapon);
  const selectSlot = useGameStore((s) => s.useSlot);

  const bossInfo = BOSS_STATE_LABEL[bossState] ?? {
    label: bossState,
    color: "bg-gray-500",
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-white font-sans">
      {/* ===== Top bar ===== */}
      <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-3 gap-2">
        {/* Level + progress */}
        <div className="pointer-events-auto bg-black/60 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-white/60">
                关卡
              </span>
              <span className="text-2xl font-bold leading-none">
                {level}
                <span className="text-sm text-white/50">/{LEVELS.length}</span>
              </span>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-white/60">
                踹击进度
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold leading-none tabular-nums">
                  {kicks}
                </span>
                <span className="text-sm text-white/50">/ {target}</span>
              </div>
              <div className="mt-1 w-40 h-1.5 bg-white/15 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-lime-400 transition-all"
                  style={{ width: `${Math.min(100, (kicks / target) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* HP */}
        <div className="pointer-events-auto bg-black/60 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10 shadow-lg flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`text-2xl transition-all ${
                i < hp ? "scale-100 opacity-100" : "scale-75 opacity-30 grayscale"
              }`}
            >
              {i < hp ? "❤️" : "🤍"}
            </span>
          ))}
        </div>
      </div>

      {/* ===== Right: status panel (boss state + variant + suspicion + player status) ===== */}
      <div className="absolute top-20 right-3 pointer-events-auto bg-black/65 backdrop-blur-md rounded-xl px-3 py-2.5 border border-white/10 shadow-lg min-w-[200px]">
        {/* Boss state */}
        <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1">
          老板状态
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-2 h-2 rounded-full ${bossInfo.color} animate-pulse`} />
          <span className="text-sm font-semibold">{bossInfo.label}</span>
        </div>

        {/* Boss variant + suspicion (from minimap data) */}
        <BossVariantAndSuspicion />

        {/* Divider */}
        <div className="my-2 h-px bg-white/10" />

        {/* Player status chips */}
        <div className="space-y-1">
          <StatusChip on={status.hidden} label="隐藏中" icon="🌿" />
          <StatusChip on={status.invisible} label="隐身中" icon="🧪" />
          <StatusChip on={status.spedUp} label="加速中" icon="👟" />
          <StatusChip on={status.combo} label="连击中" icon="🥊" />
          <StatusChip on={status.shieldActive} label="键盘盾" icon="⌨️" />
          <StatusChip on={status.patrolWarn} label="巡逻预警" icon="⚠️" danger />
        </div>
      </div>

      {/* ===== Bottom: inventory + throw charge ===== */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-2 p-3">
        {/* Throw charge */}
        {throwCharge > 0 && (
          <div className="pointer-events-none bg-black/60 rounded-full px-3 py-1 border border-white/10 mb-1">
            <div className="text-[10px] uppercase tracking-wider text-white/60 mb-0.5 text-center">
              投掷蓄力
            </div>
            <div className="w-48 h-2.5 bg-white/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500"
                style={{ width: `${throwCharge * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Inventory */}
        <div className="pointer-events-auto flex gap-1.5 bg-black/60 backdrop-blur-md rounded-xl p-2 border border-white/10 shadow-lg">
          {inventory.map((slot, i) => {
            const isSel = selectedSlot === i;
            return (
              <button
                key={i}
                onClick={() => selectSlot(i)}
                className={`relative w-14 h-14 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                  isSel
                    ? "border-amber-400 bg-amber-400/20 scale-105"
                    : slot.kind
                    ? "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10"
                    : "border-white/10 bg-black/30"
                }`}
                title={slot.kind ? nameOf(slot.kind) : "空"}
              >
                <span className="absolute top-0.5 left-1 text-[9px] text-white/40 font-mono">
                  {i + 1}
                </span>
                {slot.kind ? (
                  <>
                    <span className="text-2xl leading-none">{iconOf(slot.kind)}</span>
                    {slot.count > 1 && (
                      <span className="absolute bottom-0.5 right-1 text-[10px] font-bold bg-black/70 px-1 rounded">
                        {slot.count}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-white/20 text-xs">空</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Equipped + controls hint */}
        <div className="pointer-events-none flex flex-wrap items-center gap-2 text-[11px] text-white/50 justify-center max-w-2xl">
          <span className="bg-black/50 px-2 py-0.5 rounded">
            装备: {equippedWeapon ? WEAPONS[equippedWeapon].name : "无（徒手踹）"}
          </span>
          <span className="bg-black/50 px-2 py-0.5 rounded">WASD 移动</span>
          <span className="bg-black/50 px-2 py-0.5 rounded">左键 踹/砍</span>
          <span className="bg-black/50 px-2 py-0.5 rounded">右键蓄力投掷</span>
          <span className="bg-black/50 px-2 py-0.5 rounded">1-6 道具</span>
          <span className="bg-black/50 px-2 py-0.5 rounded">ESC 暂停</span>
          <span className="bg-black/50 px-2 py-0.5 rounded">M 音效</span>
        </div>
      </div>

      {/* ===== Level timer (top center, small) ===== */}
      <LevelTimer />

      {/* ===== Boss dialogue (mirrored from 3D for accessibility) ===== */}
      <BossDialogueMirror />
    </div>
  );
}

function LevelTimer() {
  const minimap = useGameStore((s) => s.minimap);
  const bestTimes = useGameStore((s) => s.bestTimes);
  const level = useGameStore((s) => s.level);
  if (!minimap) return null;
  const t = minimap.levelTime;
  const tStr = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  const best = bestTimes[level];
  const bestStr = best !== undefined ? `${Math.floor(best / 60)}:${String(Math.floor(best % 60)).padStart(2, "0")}` : "--:--";
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none">
      <div className="bg-black/60 backdrop-blur-md rounded-full px-4 py-1 border border-white/10 flex items-center gap-3 text-xs">
        <span className="text-white/50">⏱</span>
        <span className="font-mono font-bold tabular-nums text-white">{tStr}</span>
        <span className="text-white/30">|</span>
        <span className="text-white/50">最佳</span>
        <span className="font-mono tabular-nums text-amber-300">{bestStr}</span>
      </div>
    </div>
  );
}

// Boss variant badge + suspicion meter (reads from minimap data)
function BossVariantAndSuspicion() {
  const minimap = useGameStore((s) => s.minimap);
  if (!minimap) return null;
  const variantInfo: Record<string, { icon: string; label: string; color: string }> = {
    normal: { icon: "👨‍💼", label: "普通", color: "text-emerald-300" },
    glasses: { icon: "🤓", label: "戴眼镜·视野更远", color: "text-sky-300" },
    coffee: { icon: "☕", label: "喝咖啡·更警觉", color: "text-orange-300" },
    headphones: { icon: "🎧", label: "戴耳机·噪音免疫", color: "text-purple-300" },
  };
  const vi = variantInfo[minimap.bossVariant] || variantInfo.normal;
  const susp = minimap.suspicion;
  const suspLevel = susp > 0.7 ? "danger" : susp > 0.4 ? "warn" : "safe";
  const suspColor =
    suspLevel === "danger" ? "bg-red-500" : suspLevel === "warn" ? "bg-amber-400" : "bg-emerald-400";
  const suspLabel = suspLevel === "danger" ? "高度警觉!" : suspLevel === "warn" ? "起疑心" : "放松";
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-lg">{vi.icon}</span>
        <span className={`text-[11px] font-semibold ${vi.color}`}>{vi.label}</span>
      </div>
      <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-white/50 mb-0.5">
        <span>警觉度</span>
        <span
          className={
            suspLevel === "danger"
              ? "text-red-300 font-bold animate-pulse"
              : suspLevel === "warn"
              ? "text-amber-300 font-semibold"
              : "text-emerald-300"
          }
        >
          {suspLabel}
        </span>
      </div>
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full ${suspColor} transition-all duration-200 ${suspLevel === "danger" ? "animate-pulse" : ""}`}
          style={{ width: `${susp * 100}%` }}
        />
      </div>
    </div>
  );
}

function StatusChip({
  on,
  label,
  icon,
  danger,
}: {
  on: boolean;
  label: string;
  icon: string;
  danger?: boolean;
}) {
  if (!on) return null;
  return (
    <div
      className={`flex items-center gap-1.5 text-xs font-medium ${
        danger ? "text-red-300" : "text-emerald-300"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function BossDialogueMirror() {
  const dialogue = useGameStore((s) => s.bossDialogue);
  if (!dialogue) return null;
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
      <div className="bg-white/95 text-gray-900 px-4 py-2 rounded-xl shadow-2xl border-2 border-gray-800 text-sm font-semibold max-w-xs text-center animate-[popin_0.2s_ease-out]">
        💬 {dialogue}
      </div>
    </div>
  );
}

function iconOf(kind: string): string {
  if (isWeapon(kind as WeaponKind)) return WEAPONS[kind as WeaponKind].icon;
  return CONSUMABLES[kind as ConsumableKind].icon;
}
function nameOf(kind: string): string {
  if (isWeapon(kind as WeaponKind)) return WEAPONS[kind as WeaponKind].name;
  return CONSUMABLES[kind as ConsumableKind].name;
}
