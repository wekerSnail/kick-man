"use client";

import { useEffect, useRef } from "react";
import { useGameStore, type MinimapData } from "../store";
import { WORLD, itemIcon, itemColor } from "../constants";

// Minimap renders a top-down view of the office.
// World coords are in [-9, 9]; we map to canvas pixels.
const SIZE = 180; // canvas px
const PADDING = 8;

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimap = useGameStore((s) => s.minimap);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // draw loop using rAF for smooth updates
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const m = useGameStore.getState().minimap;
      renderMinimap(ctx, m);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="pointer-events-auto absolute top-20 left-3 z-10">
      <div className="bg-black/60 backdrop-blur-md rounded-xl p-1.5 border border-white/10 shadow-lg">
        <div className="text-[9px] uppercase tracking-wider text-white/50 mb-0.5 text-center">
          小地图
        </div>
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className="rounded-lg"
          style={{ width: SIZE, height: SIZE }}
        />
      </div>
    </div>
  );
}

function w2c(v: number): number {
  // world [-WORLD.half, WORLD.half] -> canvas [PADDING, SIZE-PADDING]
  const range = WORLD.half * 2;
  return PADDING + ((v + WORLD.half) / range) * (SIZE - 2 * PADDING);
}

function renderMinimap(ctx: CanvasRenderingContext2D, m: MinimapData | null) {
  ctx.clearRect(0, 0, SIZE, SIZE);
  // background
  ctx.fillStyle = "#1a1a24";
  ctx.fillRect(0, 0, SIZE, SIZE);

  // floor area
  ctx.fillStyle = "#2a2a36";
  ctx.fillRect(PADDING, PADDING, SIZE - 2 * PADDING, SIZE - 2 * PADDING);

  // grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let i = -8; i <= 8; i += 2) {
    const x = w2c(i);
    const y = w2c(i);
    ctx.beginPath();
    ctx.moveTo(x, PADDING);
    ctx.lineTo(x, SIZE - PADDING);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(PADDING, y);
    ctx.lineTo(SIZE - PADDING, y);
    ctx.stroke();
  }

  // border
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 2;
  ctx.strokeRect(PADDING, PADDING, SIZE - 2 * PADDING, SIZE - 2 * PADDING);

  if (!m) return;

  // hiding spots
  for (const spot of m.hidingSpots) {
    const x = w2c(spot.x);
    const y = w2c(spot.z);
    const w = (spot.w / (WORLD.half * 2)) * (SIZE - 2 * PADDING);
    const h = (spot.d / (WORLD.half * 2)) * (SIZE - 2 * PADDING);
    ctx.fillStyle = "rgba(139, 92, 246, 0.5)";
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.strokeStyle = "rgba(139, 92, 246, 0.9)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  }

  // boss desk (static at z=-6.8)
  ctx.fillStyle = "rgba(139, 90, 43, 0.6)";
  const deskW = (3.2 / (WORLD.half * 2)) * (SIZE - 2 * PADDING);
  const deskH = (1.4 / (WORLD.half * 2)) * (SIZE - 2 * PADDING);
  ctx.fillRect(w2c(0) - deskW / 2, w2c(-6.8) - deskH / 2, deskW, deskH);

  // boss vision cone (patrol)
  if (m.patrolCone) {
    const bx = w2c(m.bx);
    const by = w2c(m.bz);
    const rangePx = (m.patrolCone.range / (WORLD.half * 2)) * (SIZE - 2 * PADDING);
    const halfAng = (m.patrolCone.angleDeg * Math.PI) / 180 / 2;
    // boss facing: bfacing. forward vector = (sin(bfacing), cos(bfacing)) in world.
    // On minimap, +x world = +x canvas, +z world = +y canvas (down).
    // So forward dir on canvas = (sin(bfacing), cos(bfacing))
    const fwdX = Math.sin(m.bfacing);
    const fwdY = Math.cos(m.bfacing);
    // perpendicular for the cone sides
    const perpX = -fwdY;
    const perpY = fwdX;
    const a1x = bx + (fwdX * Math.cos(halfAng) + perpX * Math.sin(halfAng)) * rangePx;
    const a1y = by + (fwdY * Math.cos(halfAng) + perpY * Math.sin(halfAng)) * rangePx;
    const a2x = bx + (fwdX * Math.cos(-halfAng) + perpX * Math.sin(-halfAng)) * rangePx;
    const a2y = by + (fwdY * Math.cos(-halfAng) + perpY * Math.sin(-halfAng)) * rangePx;
    ctx.fillStyle = "rgba(239, 68, 68, 0.35)";
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(a1x, a1y);
    ctx.lineTo(a2x, a2y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(239, 68, 68, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // boss half-circle awareness (Normal/LookingBack/Attacked)
  // Detection is always in the boss's FRONT hemisphere (where boss faces).
  // Minimap arc direction = bfacing (front).
  if (m.halfRange && m.halfRange > 0) {
    const bx = w2c(m.bx);
    const by = w2c(m.bz);
    const rPx = (m.halfRange / (WORLD.half * 2)) * (SIZE - 2 * PADDING);
    // awareness direction = boss forward = bfacing
    const awDirX = Math.sin(m.bfacing);
    const awDirY = Math.cos(m.bfacing);
    const awCanvasAng = Math.atan2(awDirY, awDirX);
    // color by state
    let color = "rgba(251, 191, 36, 0.25)";
    if (m.bossState === "LookingBack") color = "rgba(249, 115, 22, 0.35)";
    if (m.bossState === "Attacked") color = "rgba(239, 68, 68, 0.4)";
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.arc(bx, by, rPx, awCanvasAng - Math.PI / 2, awCanvasAng + Math.PI / 2);
    ctx.closePath();
    ctx.fill();
  }

  // items
  for (const item of m.items) {
    const x = w2c(item.x);
    const y = w2c(item.z);
    const color = "#" + itemColor(item.kind).toString(16).padStart(6, "0");
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // boss (red dot with direction)
  const bx = w2c(m.bx);
  const by = w2c(m.bz);
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(bx, by, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // direction tick
  const fX = Math.sin(m.bfacing);
  const fY = Math.cos(m.bfacing);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + fX * 9, by + fY * 9);
  ctx.stroke();

  // player (blue dot with direction)
  const px = w2c(m.px);
  const py = w2c(m.pz);
  ctx.fillStyle = "#60a5fa";
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const pfX = Math.sin(m.pfacing);
  const pfY = Math.cos(m.pfacing);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + pfX * 9, py + pfY * 9);
  ctx.stroke();
}
