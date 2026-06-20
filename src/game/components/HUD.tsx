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

      {/* ===== Right: status panel ===== */}
      <div className="absolute top-20 right-3 pointer-events-auto bg-black/60 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10 shadow-lg min-w-[160px]">
        <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1">
          老板状态
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-2 h-2 rounded-full ${bossInfo.color} animate-pulse`} />
          <span className="text-sm font-semibold">{bossInfo.label}</span>
        </div>
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
        <div className="pointer-events-none flex items-center gap-2 text-[11px] text-white/50">
          <span className="bg-black/50 px-2 py-0.5 rounded">
            装备: {equippedWeapon ? WEAPONS[equippedWeapon].name : "无（徒手踹）"}
          </span>
          <span className="bg-black/50 px-2 py-0.5 rounded">WASD 移动</span>
          <span className="bg-black/50 px-2 py-0.5 rounded">左键 踹/砍</span>
          <span className="bg-black/50 px-2 py-0.5 rounded">右键蓄力投掷</span>
          <span className="bg-black/50 px-2 py-0.5 rounded">1-6 道具</span>
        </div>
      </div>

      {/* ===== Boss dialogue (mirrored from 3D for accessibility) ===== */}
      <BossDialogueMirror />
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
