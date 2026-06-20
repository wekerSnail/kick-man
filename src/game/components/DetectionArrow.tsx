"use client";

import { useGameStore } from "../store";

/**
 * DetectionArrow — when boss is alert (suspicion rising or actively looking for player),
 * show a directional arrow at screen edge pointing toward the boss.
 * Color escalates with threat level.
 */
export function DetectionArrow() {
  const minimap = useGameStore((s) => s.minimap);
  const settings = useGameStore((s) => s.settings);

  if (!minimap || !settings.detectionArrow) return null;

  const { px, pz, bx, bz, bossState, suspicion, bossEnraged } = minimap;

  // Show arrow only when boss is actively searching for player
  const isAlert =
    bossEnraged ||
    suspicion > 0.25 ||
    bossState === "LookingBack" ||
    bossState === "Attacked" ||
    bossState === "Patrol";
  if (!isAlert) return null;

  // Direction from player to boss in world space
  const dx = bx - px;
  const dz = bz - pz;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.3) return null;

  // World angle: 0 = +Z (south on minimap), π/2 = +X (east), -π/2 = -X (west), π = -Z (north)
  // We want to convert to screen angle: in our iso view, +X = right, +Z = down-ish
  // For simplicity, map world angle to screen angle:
  // atan2(dx, dz) gives angle from +Z axis (when looking from above with +X right, +Z down)
  const worldAngle = Math.atan2(dx, dz); // 0 = boss is south, π/2 = boss is east, -π/2 = boss is west, π = boss is north

  // Threat level determines color + size
  let threatLevel: "warn" | "danger" | "critical";
  if (bossEnraged) threatLevel = "critical";
  else if (suspicion > 0.6 || bossState === "Attacked" || bossState === "Patrol") threatLevel = "danger";
  else threatLevel = "warn";

  const colorMap = {
    warn: {
      bg: "bg-amber-500/30",
      border: "border-amber-400",
      text: "text-amber-200",
      glow: "shadow-[0_0_24px_rgba(251,191,36,0.7)]",
      icon: "⚠️",
      label: "起疑心",
    },
    danger: {
      bg: "bg-orange-600/40",
      border: "border-orange-400",
      text: "text-orange-200",
      glow: "shadow-[0_0_28px_rgba(249,115,22,0.85)]",
      icon: "👁️",
      label: "正在搜寻",
    },
    critical: {
      bg: "bg-red-600/50",
      border: "border-red-400",
      text: "text-red-100",
      glow: "shadow-[0_0_36px_rgba(239,68,68,0.95)]",
      icon: "🔥",
      label: "暴怒！立即躲藏",
    },
  };
  const c = colorMap[threatLevel];

  // Position arrow at screen edge based on worldAngle
  // Screen center is 50%, edge is at ~45% offset
  // angle 0 (boss south/+Z) → arrow at bottom (top: ~85%)
  // angle π (boss north/-Z) → arrow at top (top: ~15%)
  // angle π/2 (boss east/+X) → arrow at right (left: ~85%)
  // angle -π/2 (boss west/-X) → arrow at left (left: ~15%)
  const radius = 38; // percent from center
  const leftPct = 50 + Math.sin(worldAngle) * radius;
  const topPct = 50 + Math.cos(worldAngle) * radius;

  // Arrow rotation: arrow points from center (player) to boss
  // CSS rotate: 0deg = up, 90deg = right, 180deg = down, 270deg = left
  // We want arrow to point in direction of boss from center
  // If boss is south (worldAngle=0), arrow should point down (rotate 180deg)
  // If boss is east (worldAngle=π/2), arrow should point right (rotate 90deg)
  // Formula: rotation = (worldAngle in degrees) + 90? Let me think:
  // worldAngle 0 → rotate 180 (down)
  // worldAngle π/2 → rotate 90 (right)... wait that doesn't match
  // Actually CSS rotate: 0 = up, 90 = right, 180 = down, 270 = left
  // worldAngle 0 (south) → down → 180
  // worldAngle π/2 (east) → right → 90
  // worldAngle π (north) → up → 0
  // worldAngle -π/2 (west) → left → 270
  // So rotation = 180 - worldAngleDeg
  const worldAngleDeg = (worldAngle * 180) / Math.PI;
  const arrowRotation = 180 - worldAngleDeg;

  // Distance label
  const distLabel = dist < 3 ? "极近" : dist < 6 ? "近" : dist < 9 ? "中" : "远";

  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div
        className={`relative flex flex-col items-center justify-center w-16 h-16 rounded-full border-2 ${c.border} ${c.bg} ${c.glow} backdrop-blur-sm animate-[pulse_1.5s_ease-in-out_infinite]`}
      >
        {/* Arrow pointing toward boss */}
        <div
          className="text-2xl leading-none"
          style={{ transform: `rotate(${arrowRotation}deg)` }}
        >
          ⬆️
        </div>
        <div className={`text-[9px] font-bold ${c.text} mt-0.5`}>{distLabel}</div>
      </div>
      {/* Label badge below */}
      <div
        className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/70 ${c.text} border ${c.border}`}
      >
        {c.icon} {c.label}
      </div>
    </div>
  );
}
