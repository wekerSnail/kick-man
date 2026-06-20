"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../store";

// Detects touch device and shows virtual joystick + kick/throw buttons.
// Communicates with engine via window.__engine + key simulation.

function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

export function TouchControls() {
  // detect touch device lazily via state initializer + rAF to avoid setState-in-effect
  const [show, setShow] = useState(false);
  const screen = useGameStore((s) => s.screen);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setShow(isTouchDevice()));
    return () => window.cancelAnimationFrame(id);
  }, []);

  if (!show || screen !== "playing") return null;

  return (
    <>
      <Joystick />
      <ActionButtons />
    </>
  );
}

function Joystick() {
  const baseRef = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const activeRef = useRef(false);
  const touchIdRef = useRef<number | null>(null);
  const centerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const base = baseRef.current;
    if (!base) return;

    const onStart = (e: TouchEvent) => {
      if (activeRef.current) return;
      const t = e.changedTouches[0];
      touchIdRef.current = t.identifier;
      const rect = base.getBoundingClientRect();
      centerRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      activeRef.current = true;
      updateStick(t.clientX, t.clientY);
      e.preventDefault();
    };
    const onMove = (e: TouchEvent) => {
      if (!activeRef.current || touchIdRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === touchIdRef.current) {
          updateStick(t.clientX, t.clientY);
          e.preventDefault();
          break;
        }
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (touchIdRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === touchIdRef.current) {
          activeRef.current = false;
          touchIdRef.current = null;
          setStick({ x: 0, y: 0 });
          // release all keys
          const eng = (window as unknown as { __engine?: { keys: Record<string, boolean> } }).__engine;
          if (eng) {
            eng.keys["w"] = false;
            eng.keys["a"] = false;
            eng.keys["s"] = false;
            eng.keys["d"] = false;
          }
          e.preventDefault();
          break;
        }
      }
    };
    const updateStick = (cx: number, cy: number) => {
      const dx = cx - centerRef.current.x;
      const dy = cy - centerRef.current.y;
      const maxR = 45;
      const len = Math.sqrt(dx * dx + dy * dy);
      const cl = Math.min(len, maxR);
      const nx = len > 0 ? (dx / len) * cl : 0;
      const ny = len > 0 ? (dy / len) * cl : 0;
      setStick({ x: nx, y: ny });
      // map to WASD: deadzone 0.2
      const deadzone = 0.2;
      const tx = len > 0 ? dx / maxR : 0;
      const ty = len > 0 ? dy / maxR : 0;
      const eng = (window as unknown as { __engine?: { keys: Record<string, boolean> } }).__engine;
      if (eng) {
        eng.keys["w"] = ty < -deadzone;
        eng.keys["s"] = ty > deadzone;
        eng.keys["a"] = tx < -deadzone;
        eng.keys["d"] = tx > deadzone;
      }
    };

    base.addEventListener("touchstart", onStart, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      base.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return (
    <div
      ref={baseRef}
      className="pointer-events-auto absolute bottom-24 left-6 z-20 w-32 h-32 rounded-full bg-black/40 border-2 border-white/20 backdrop-blur-sm touch-none"
      style={{ touchAction: "none" }}
    >
      <div className="absolute inset-0 flex items-center justify-center text-white/30 text-[10px] pointer-events-none">
        移动
      </div>
      <div
        className="absolute w-12 h-12 rounded-full bg-white/40 border-2 border-white/60 pointer-events-none transition-transform"
        style={{
          left: "50%",
          top: "50%",
          transform: `translate(calc(-50% + ${stick.x}px), calc(-50% + ${stick.y}px))`,
        }}
      />
    </div>
  );
}

function ActionButtons() {
  const [charging, setCharging] = useState(false);
  const chargeRaf = useRef(0);

  const doKick = () => {
    const eng = (window as unknown as {
      __engine?: { tryAttack: () => void };
    }).__engine;
    eng?.tryAttack();
  };

  const startThrow = () => {
    const eng = (window as unknown as {
      __engine?: {
        store: { equippedWeapon: string | null };
        charging: boolean;
        rightDown: boolean;
      };
    }).__engine;
    if (!eng) return;
    // check throwable
    const w = eng.store.equippedWeapon as "mace" | "bat" | "pan" | "ruler" | null;
    if (!w || (w !== "mace" && w !== "bat" && w !== "pan" && w !== "ruler")) return;
    eng.charging = true;
    eng.rightDown = true;
    setCharging(true);
  };

  const stopThrow = () => {
    const eng = (window as unknown as {
      __engine?: { releaseThrow: () => void; charging: boolean };
    }).__engine;
    if (!eng || !eng.charging) return;
    eng.releaseThrow();
    eng.charging = false;
    setCharging(false);
  };

  // pickup button
  const doPickup = () => {
    const eng = (window as unknown as {
      __engine?: { tryPickupNearby: () => void };
    }).__engine;
    eng?.tryPickupNearby();
  };

  return (
    <div className="pointer-events-none absolute bottom-24 right-6 z-20 flex flex-col gap-3 items-end">
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          doPickup();
        }}
        className="pointer-events-auto w-14 h-14 rounded-full bg-amber-500/80 border-2 border-white/40 text-white font-bold text-2xl shadow-lg active:scale-90 transition-transform touch-none"
        style={{ touchAction: "none" }}
        aria-label="拾取"
      >
        📦
      </button>
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          startThrow();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          stopThrow();
        }}
        onPointerLeave={() => charging && stopThrow()}
        className={`pointer-events-auto w-16 h-16 rounded-full ${
          charging ? "bg-red-500/90 scale-110" : "bg-orange-500/80"
        } border-2 border-white/40 text-white font-bold text-xs shadow-lg active:scale-90 transition-all touch-none flex flex-col items-center justify-center`}
        style={{ touchAction: "none" }}
        aria-label="投掷"
      >
        <span className="text-xl">🤾</span>
        <span>投掷</span>
      </button>
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          doKick();
        }}
        className="pointer-events-auto w-20 h-20 rounded-full bg-gradient-to-br from-rose-500 to-red-600 border-2 border-white/50 text-white font-bold text-sm shadow-xl active:scale-90 transition-transform touch-none flex flex-col items-center justify-center"
        style={{ touchAction: "none" }}
        aria-label="踹击"
      >
        <span className="text-2xl">🦵</span>
        <span>踹/砍</span>
      </button>
    </div>
  );
}
