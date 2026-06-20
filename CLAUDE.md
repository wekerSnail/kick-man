# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"踹他一百下" (Kick Him 100 Times) — a 3D stealth action game built with Next.js 16 + Three.js. Player sneaks up to kick the boss in an office while avoiding detection. Includes FPS bonus mode.

## Commands

```bash
# Development
pnpm dev                    # Start dev server on port 3000

# Build & Production
pnpm build                  # Build for production (standalone output)
pnpm start                  # Start production server (uses bun)

# Lint
pnpm lint                   # Run ESLint

# Database (Prisma + SQLite)
pnpm db:push                # Push schema changes
pnpm db:generate            # Generate Prisma client
pnpm db:migrate             # Create migration
pnpm db:reset               # Reset database
```

## Architecture

### Engine/UI Separation Pattern

The game uses a strict separation between the Three.js engine (imperative TypeScript classes) and React UI (declarative components), bridged by Zustand:

- **Engine** (`src/game/engine/`) — Three.js game logic in plain TS classes
  - `GameEngine.ts` — Main orchestrator: renderer, scene, camera, player movement, collision, items, projectiles, game loop
  - `Boss.ts` — 8-state FSM boss AI (Normal/PhoneFlashing/LookingBack/Attacked/Meeting/Patrol/Stunned/Distracted) with procedural animations
  - `OfficeScene.ts` — Low-poly 3D office environment with colliders
  - `FPSMode.ts` — First-person shooter bonus mode with 3 weapon types

- **Store** (`src/game/store.ts`) — Zustand store for UI-facing state (HP, level, kicks, inventory, boss state, settings, minimap data)

- **UI Components** (`src/game/components/`) — React HUD/overlay components that read from store
  - `Game.tsx` — Main wrapper that bootstraps the engine and renders screen-specific overlays
  - `HUD.tsx`, `Minimap.tsx`, `FPSHUD.tsx` — In-game UI
  - `StartScreen.tsx`, `LevelTransition.tsx`, `GameOverScreen.tsx`, `VictoryScreen.tsx` — Screen overlays

- **Data** (`src/game/constants.ts`, `src/game/types.ts`) — Game constants (weapons, consumables, levels, dialogue) and type definitions

### Data Flow

1. `GameEngine` class runs the Three.js render loop and game logic
2. Engine calls `useGameStore.getState().setXxx()` to push state to React
3. React components read store via `useGameStore((s) => s.xxx)` hooks
4. User actions in React call engine methods via ref: `engineRef.current?.startGame()`

### Key Patterns

- **Dynamic import with SSR disabled**: `page.tsx` uses `dynamic(() => import("@/game/components/Game"), { ssr: false })` because Three.js requires browser APIs
- **WebAudio SFX**: All sound effects are synthesized via WebAudio API in `src/game/audio/AudioManager.ts` — no audio asset files
- **Canvas textures**: Boss speech bubbles and status icons are rendered as canvas-texture sprites
- **Debug hook**: `window.__engine` is exposed for QA testing (can be removed for production)

### Game Design

- 7 levels with increasing kick targets (10 → 150)
- Boss has detection mechanics: half-circle awareness, looking-back detection, patrol cone
- Items spawn every 10 seconds: 4 weapon types (mace, bat, pan, ruler) + 6 consumables (speed, invis, noise, combo, keyboard, smoke)
- Hiding spots (plants, shelves, sofas) provide concealment
- FPS bonus mode: 30-second shooter with laser/rocket/grenade weapons

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **3D**: Three.js (low-poly cartoon style)
- **State**: Zustand
- **UI**: Tailwind CSS + shadcn/ui components
- **Database**: Prisma + SQLite (schema exists but minimal — User/Post models)
- **Package Manager**: pnpm (lockfile present), bun used for production server

## ESLint Configuration

The project has relaxed ESLint rules — most TypeScript strictness rules are disabled (`no-explicit-any`, `no-unused-vars`, `no-non-null-assertion`, `ban-ts-comment` are all off). React hooks rules and compiler checks are also off. This is intentional for rapid game prototyping.

## File Structure Notes

- `src/app/` — Next.js App Router (single route: `page.tsx` mounts `<Game />`)
- `src/game/` — All game code (engine, components, store, types, constants, audio)
- `src/components/` — Shared UI components (likely shadcn/ui)
- `mini-services/` — Empty directory (placeholder for future microservices)
- `.zscripts/` — Shell scripts for dev/build/deployment workflows
- `worklog.md` — Detailed development history and task tracking
