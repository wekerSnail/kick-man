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
import { Minimap } from "./Minimap";
import { PauseMenu } from "./PauseMenu";
import { TouchControls } from "./TouchControls";
import { AchievementToast } from "./AchievementToast";
import { ComboCounter } from "./ComboCounter";
import { Gallery } from "./Gallery";
import { EventBanner } from "./EventBanner";
import { TutorialHint } from "./TutorialHint";
import { DetectionArrow } from "./DetectionArrow";
import { SettingsMenu } from "./SettingsMenu";
import { Level1Tutorial } from "./Level1Tutorial";
import { KeyboardHelp } from "./KeyboardHelp";

export default function Game() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const screen = useGameStore((s) => s.screen);
  const settings = useGameStore((s) => s.settings);

  // '?' key toggles keyboard help overlay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        setShowKeyboardHelp((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
      {ready && screen === "playing" && (
        <>
          <HUD />
          {settings.minimap && <Minimap />}
          <TouchControls />
          <ComboCounter />
          <DetectionArrow />
        </>
      )}
      {ready && screen === "start" && (
        <StartScreen
          onStart={() => {
            engineRef.current?.startGame();
          }}
          onSelectLevel={(level) => {
            engineRef.current?.startAtLevel(level);
          }}
          onShowGallery={() => setShowGallery(true)}
          onShowSettings={() => setShowSettings(true)}
          onShowKeyboardHelp={() => setShowKeyboardHelp(true)}
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
          onBackToMenu={() => useGameStore.getState().setScreen("start")}
        />
      )}
      {ready && screen === "victory" && (
        <VictoryScreen
          onRestart={() => engineRef.current?.restartGame()}
          onBackToMenu={() => useGameStore.getState().setScreen("start")}
        />
      )}
      {ready && screen === "fps" && <FPSHUD />}

      {/* Pause menu overlay (works on top of playing screen) */}
      {ready && <PauseMenu onShowSettings={() => setShowSettings(true)} />}

      {/* Tutorial hint popup (boss variant first encounter) */}
      {ready && <TutorialHint />}

      {/* Level 1 first-time operations tutorial */}
      {ready && <Level1Tutorial />}

      {/* Gallery (achievements + items) overlay */}
      {ready && showGallery && <Gallery onClose={() => setShowGallery(false)} />}

      {/* Settings menu overlay */}
      {ready && showSettings && <SettingsMenu onClose={() => setShowSettings(false)} />}

      {/* Keyboard shortcuts help overlay */}
      {ready && showKeyboardHelp && <KeyboardHelp onClose={() => setShowKeyboardHelp(false)} />}

      {/* Achievement unlock toasts (always available) */}
      {ready && <AchievementToast />}

      {/* Event banner (boss state change notifications) */}
      {ready && <EventBanner />}

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

