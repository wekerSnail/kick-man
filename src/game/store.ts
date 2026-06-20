"use client";

import { create } from "zustand";
import type {
  GameScreen,
  BossStateName,
  InventorySlot,
  StatusFlags,
  ToastMsg,
  ItemKind,
  WeaponKind,
  ConsumableKind,
} from "./types";
import {
  INVENTORY_SIZE,
  MAX_HP,
  LEVELS,
} from "./constants";

// Minimap data (world-space, normalized to [-9, 9])
export interface MinimapData {
  px: number; // player x
  pz: number; // player z
  pfacing: number; // player facing radians
  bx: number; // boss x
  bz: number; // boss z
  bfacing: number; // boss facing radians
  bossState: BossStateName;
  // patrol cone (when patrolling)
  patrolCone?: { range: number; angleDeg: number };
  // half-circle awareness range (0 = none)
  halfRange?: number;
  // items: list of {x, z, kind}
  items: { x: number; z: number; kind: ItemKind }[];
  // hiding spots (static)
  hidingSpots: { x: number; z: number; w: number; d: number; id: string }[];
  // level timer seconds
  levelTime: number;
}

interface GameState {
  // screen
  screen: GameScreen;
  setScreen: (s: GameScreen) => void;

  // core run stats
  level: number;
  kicks: number;
  target: number;
  hp: number;
  maxHp: number;

  setLevel: (l: number) => void;
  setKicks: (k: number) => void;
  setHp: (h: number) => void;
  damageHp: (amt: number) => void;
  resetRun: () => void;

  // boss state mirror
  bossState: BossStateName;
  bossDialogue: string | null;
  setBossState: (s: BossStateName) => void;
  setBossDialogue: (d: string | null) => void;

  // status flags
  status: StatusFlags;
  setStatus: (s: Partial<StatusFlags>) => void;

  // inventory
  inventory: InventorySlot[];
  selectedSlot: number; // currently "held" weapon (for throw/swing), -1 none
  setInventory: (inv: InventorySlot[]) => void;
  setSelectedSlot: (i: number) => void;

  // cooldowns / progress
  kickCooldown: number; // 0..1 (1 = ready)
  throwCharge: number; // 0..1 when charging
  setKickCooldown: (v: number) => void;
  setThrowCharge: (v: number) => void;

  // equipped weapon for throw (kind or null)
  equippedWeapon: WeaponKind | null;
  setEquippedWeapon: (w: WeaponKind | null) => void;

  // last death dialogue (for game over screen)
  deathDialogue: string;
  setDeathDialogue: (s: string) => void;

  // fps mode
  fpsWeapon: "laser" | "rocket" | "grenade" | null;
  fpsTimeLeft: number;
  fpsAmmo: number;
  fpsScore: number;
  setFps: (p: Partial<{ weapon: "laser" | "rocket" | "grenade"; timeLeft: number; ammo: number; score: number }>) => void;

  // toasts
  toasts: ToastMsg[];
  pushToast: (text: string, kind?: ToastMsg["kind"]) => void;
  removeToast: (id: number) => void;

  // reset inventory helper
  resetInventory: () => void;

  // mutable bridge: used by engine to add items, etc.
  addItem: (kind: ItemKind, count?: number) => boolean;
  useSlot: (index: number) => void;

  // minimap data (updated each frame by engine)
  minimap: MinimapData | null;
  setMinimap: (m: MinimapData) => void;

  // paused (ESC menu)
  paused: boolean;
  setPaused: (p: boolean) => void;

  // sound on/off
  soundOn: boolean;
  toggleSound: () => void;

  // best level times (per level, in seconds; lower is better)
  bestTimes: Record<number, number>;
  setBestTime: (level: number, time: number) => void;
}

let toastId = 1;

function emptyInv(): InventorySlot[] {
  return Array.from({ length: INVENTORY_SIZE }, () => ({ kind: null, count: 0 }));
}

export const useGameStore = create<GameState>((set, get) => ({
  screen: "start",
  setScreen: (s) => set({ screen: s }),

  level: 1,
  kicks: 0,
  target: LEVELS[0].target,
  hp: MAX_HP,
  maxHp: MAX_HP,

  setLevel: (l) =>
    set({
      level: l,
      target: LEVELS[Math.min(l - 1, LEVELS.length - 1)].target,
    }),
  setKicks: (k) => set({ kicks: k }),
  setHp: (h) => set({ hp: Math.max(0, Math.min(MAX_HP, h)) }),
  damageHp: (amt) =>
    set((st) => ({ hp: Math.max(0, Math.min(MAX_HP, st.hp - amt)) })),
  resetRun: () =>
    set({
      level: 1,
      kicks: 0,
      target: LEVELS[0].target,
      hp: MAX_HP,
      inventory: emptyInv(),
      selectedSlot: -1,
      equippedWeapon: null,
      bossState: "Normal",
      bossDialogue: null,
      status: {
        hidden: false,
        invisible: false,
        spedUp: false,
        combo: false,
        shieldActive: false,
        patrolWarn: false,
      },
      kickCooldown: 1,
      throwCharge: 0,
      deathDialogue: "",
    }),

  bossState: "Normal",
  bossDialogue: null,
  setBossState: (s) => set({ bossState: s }),
  setBossDialogue: (d) => set({ bossDialogue: d }),

  status: {
    hidden: false,
    invisible: false,
    spedUp: false,
    combo: false,
    shieldActive: false,
    patrolWarn: false,
  },
  setStatus: (s) => set((st) => ({ status: { ...st.status, ...s } })),

  inventory: emptyInv(),
  selectedSlot: -1,
  setInventory: (inv) => set({ inventory: inv }),
  setSelectedSlot: (i) => set({ selectedSlot: i }),

  kickCooldown: 1,
  throwCharge: 0,
  setKickCooldown: (v) => set({ kickCooldown: v }),
  setThrowCharge: (v) => set({ throwCharge: v }),

  equippedWeapon: null,
  setEquippedWeapon: (w) => set({ equippedWeapon: w }),

  deathDialogue: "",
  setDeathDialogue: (s) => set({ deathDialogue: s }),

  fpsWeapon: null,
  fpsTimeLeft: 30,
  fpsAmmo: 999,
  fpsScore: 0,
  setFps: (p) =>
    set((st) => ({
      fpsWeapon: p.weapon ?? st.fpsWeapon,
      fpsTimeLeft: p.timeLeft ?? st.fpsTimeLeft,
      fpsAmmo: p.ammo ?? st.fpsAmmo,
      fpsScore: p.score ?? st.fpsScore,
    })),

  toasts: [],
  pushToast: (text, kind = "info") => {
    const id = toastId++;
    set((st) => ({ toasts: [...st.toasts, { id, text, kind }] }));
    setTimeout(() => {
      set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) }));
    }, 2400);
  },
  removeToast: (id) =>
    set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),

  resetInventory: () => set({ inventory: emptyInv(), selectedSlot: -1, equippedWeapon: null }),

  addItem: (kind, count = 1) => {
    const inv = [...get().inventory];
    // stack if same kind
    const stackIdx = inv.findIndex((s) => s.kind === kind && s.count > 0);
    if (stackIdx >= 0) {
      inv[stackIdx] = { ...inv[stackIdx], count: inv[stackIdx].count + count };
    } else {
      const emptyIdx = inv.findIndex((s) => s.kind === null || s.count === 0);
      if (emptyIdx < 0) return false; // full
      inv[emptyIdx] = { kind, count };
    }
    set({ inventory: inv });
    return true;
  },

  useSlot: (index) => {
    const inv = [...get().inventory];
    const slot = inv[index];
    if (!slot || !slot.kind || slot.count <= 0) return;
    // For weapons: "select" them as equipped (don't consume yet)
    if (isWeapon(slot.kind)) {
      set({
        selectedSlot: index,
        equippedWeapon: slot.kind,
        inventory: inv,
      });
      return;
    }
    // consumables are consumed by engine via engineUseConsumable
    set({ selectedSlot: index });
  },

  minimap: null,
  setMinimap: (m) => set({ minimap: m }),

  paused: false,
  setPaused: (p) => set({ paused: p }),

  soundOn: true,
  toggleSound: () => set((st) => ({ soundOn: !st.soundOn })),

  bestTimes: {},
  setBestTime: (level, time) =>
    set((st) => {
      const prev = st.bestTimes[level];
      if (prev === undefined || time < prev) {
        return { bestTimes: { ...st.bestTimes, [level]: time } };
      }
      return {};
    }),
}));

// helper export for components
const WEAPON_KINDS: WeaponKind[] = ["mace", "bat", "pan", "ruler"];
export function isWeapon(kind: ItemKind | null): kind is WeaponKind {
  return kind !== null && (WEAPON_KINDS as string[]).includes(kind);
}
export function isConsumable(kind: ItemKind | null): kind is ConsumableKind {
  return kind !== null && !isWeapon(kind);
}
