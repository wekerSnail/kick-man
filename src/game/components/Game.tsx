"use client";

import { useEffect, useRef, useState } from "react";
import { GameEngine } from "../engine/GameEngine";
import { useGameStore } from "../store";
import { HUD } from "./HUD";
import { StartScreen } from "./StartScreen";
import { LevelTransition } from "./LevelTransition";
import { GameOverScreen } from "./GameOverScreen";
import { VictoryScreen } from "./VictoryScreen";
import { FPSHUD } from "./FPSHUD";
import { Toasts } from "./Toasts";

export default function Game() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [ready, setReady] = useState(false);
  const screen = useGameStore((s) => s.screen);

  useEffect(() => {
    if (!containerRef.current) return;
    const engine = new GameEngine(containerRef.current);
    engineRef.current = engine;
    // Defer ready state to avoid synchronous setState-in-effect cascading render.
    // The engine needs the DOM container which only exists after mount.
    const id = window.requestAnimationFrame(() => setReady(true));
    return () => {
      window.cancelAnimationFrame(id);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1a1a24] select-none">
      <div ref={containerRef} className="absolute inset-0" />
      {/* Detection flash vignette */}
      {ready && <FlashOverlay />}

      {/* UI overlays */}
      {ready && screen === "playing" && <HUD />}
      {ready && screen === "start" && (
        <StartScreen
          onStart={() => {
            engineRef.current?.startGame();
          }}
        />
      )}
      {ready && screen === "level-transition" && (
        <LevelTransition
          onNext={() => engineRef.current?.nextLevel()}
          onBonus={() => useGameStore.getState().setScreen("fps")}
        />
      )}
      {ready && screen === "game-over" && (
        <GameOverScreen
          onRestart={() => engineRef.current?.restartGame()}
        />
      )}
      {ready && screen === "victory" && (
        <VictoryScreen
          onRestart={() => engineRef.current?.restartGame()}
        />
      )}
      {ready && screen === "fps" && <FPSHUD />}

      <Toasts />
    </div>
  );
}

function FlashOverlay() {
  // briefly flash red when detected — driven by HP decreasing
  const hp = useGameStore((s) => s.hp);
  const [flash, setFlash] = useState(0);
  const prevHp = useRef(hp);
  useEffect(() => {
    if (hp < prevHp.current) {
      // schedule via rAF so it's not a synchronous setState in effect
      const id = window.requestAnimationFrame(() => setFlash((f) => f + 1));
      prevHp.current = hp;
      return () => window.cancelAnimationFrame(id);
    }
    prevHp.current = hp;
  }, [hp]);
  if (flash === 0) return null;
  return (
    <div
      key={flash}
      className="pointer-events-none absolute inset-0 animate-[detectflash_0.6s_ease-out] bg-red-600/30"
    />
  );
}

