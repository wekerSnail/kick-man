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
  bossVariant: "normal" | "glasses" | "coffee" | "headphones";
  suspicion: number; // 0..1 boss suspicion meter
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

  // star ratings per level (1-3 stars)
  stars: Record<number, number>;
  setStars: (level: number, stars: number) => void;

  // run statistics (reset each level)
  detectionsThisLevel: number; // times caught/detected
  damageThisLevel: number; // hp lost
  comboMax: number; // max consecutive hits without miss
  currentCombo: number;
  incDetection: () => void;
  incDamage: (amt: number) => void;
  setCombo: (c: number) => void;
  incCombo: () => void;
  resetRunStats: () => void;

  // achievements
  achievements: Record<string, boolean>; // id -> unlocked
  unlockAchievement: (id: string, name: string) => void;
  // pending achievement toast (engine → UI)
  achievementQueue: { id: string; name: string; icon: string }[];
  pushAchievement: (a: { id: string; name: string; icon: string }) => void;
  shiftAchievement: () => void;

  // last level result (for level-transition screen)
  lastLevelResult: { level: number; stars: number; time: number; detections: number; damage: number } | null;
  setLastLevelResult: (r: { level: number; stars: number; time: number; detections: number; damage: number } | null) => void;

  // cross-run stats (persisted)
  totalKicks: number; // total kicks across all runs
  maxLevelReached: number; // highest level reached
  addKicksTotal: (n: number) => void;
  setMaxLevelReached: (n: number) => void;
}

let toastId = 1;

function emptyInv(): InventorySlot[] {
  return Array.from({ length: INVENTORY_SIZE }, () => ({ kind: null, count: 0 }));
}

// ===== Persistence (localStorage) — must be defined BEFORE create() =====
const STORAGE_KEY = "kick100-progress-v1";

interface PersistedProgress {
  stars: Record<number, number>;
  achievements: Record<string, boolean>;
  bestTimes: Record<number, number>;
  totalKicks: number;
  maxLevelReached: number;
}

function loadProgress(): Partial<PersistedProgress> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PersistedProgress>;
  } catch {
    return {};
  }
}

function saveProgress(data: PersistedProgress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or disabled — ignore
  }
}

// cached lazy loader (only reads once, on first access — client-side)
let _persistedCache: Partial<PersistedProgress> | null = null;
function getPersisted(): Partial<PersistedProgress> {
  if (_persistedCache === null) {
    _persistedCache = loadProgress();
  }
  return _persistedCache;
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

  bestTimes: getPersisted().bestTimes || {},
  setBestTime: (level, time) =>
    set((st) => {
      const prev = st.bestTimes[level];
      if (prev === undefined || time < prev) {
        const next = { bestTimes: { ...st.bestTimes, [level]: time } };
        persistFromStore({ ...st, ...next });
        return next;
      }
      return {};
    }),

  stars: getPersisted().stars || {},
  setStars: (level, starCount) =>
    set((st) => {
      const prev = st.stars[level] || 0;
      if (starCount > prev) {
        const next = { stars: { ...st.stars, [level]: starCount } };
        persistFromStore({ ...st, ...next });
        return next;
      }
      return {};
    }),

  detectionsThisLevel: 0,
  damageThisLevel: 0,
  comboMax: 0,
  currentCombo: 0,
  incDetection: () => set((st) => ({ detectionsThisLevel: st.detectionsThisLevel + 1 })),
  incDamage: (amt) => set((st) => ({ damageThisLevel: st.damageThisLevel + amt })),
  setCombo: (c) =>
    set((st) => ({
      currentCombo: c,
      comboMax: Math.max(st.comboMax, c),
    })),
  incCombo: () =>
    set((st) => {
      const nc = st.currentCombo + 1;
      return { currentCombo: nc, comboMax: Math.max(st.comboMax, nc) };
    }),
  resetRunStats: () =>
    set({
      detectionsThisLevel: 0,
      damageThisLevel: 0,
      comboMax: 0,
      currentCombo: 0,
    }),

  achievements: getPersisted().achievements || {},
  unlockAchievement: (id, name) =>
    set((st) => {
      if (st.achievements[id]) return {};
      const next = {
        achievements: { ...st.achievements, [id]: true },
        achievementQueue: [...st.achievementQueue, { id, name, icon: ACHIEVEMENT_ICONS[id] || "🏆" }],
      };
      persistFromStore({ ...st, ...next });
      return next;
    }),
  achievementQueue: [],
  pushAchievement: (a) =>
    set((st) => ({
      achievementQueue: [...st.achievementQueue, a],
    })),
  shiftAchievement: () =>
    set((st) => ({ achievementQueue: st.achievementQueue.slice(1) })),

  lastLevelResult: null,
  setLastLevelResult: (r) => set({ lastLevelResult: r }),

  // cross-run persisted stats
  totalKicks: getPersisted().totalKicks || 0,
  maxLevelReached: getPersisted().maxLevelReached || 1,
  addKicksTotal: (n) =>
    set((st) => {
      const next = { totalKicks: st.totalKicks + n };
      persistFromStore({ ...st, ...next });
      return next;
    }),
  setMaxLevelReached: (n) =>
    set((st) => {
      if (n <= st.maxLevelReached) return {};
      const next = { maxLevelReached: n };
      persistFromStore({ ...st, ...next });
      return next;
    }),
}));

// Achievement icons
const ACHIEVEMENT_ICONS: Record<string, string> = {
  perfect: "🛡️",
  combo5: "🔥",
  combo10: "💥",
  stealth: "🥷",
  speedrun: "⚡",
  first_blood: "🩸",
  weapon_master: "🏏",
  pacifist_kick: "🦵",
  no_items: "🎒",
  level7: "👑",
  surviver: "💼",
  kicker_100: "💯",
};


// helper export for components
const WEAPON_KINDS: WeaponKind[] = ["mace", "bat", "pan", "ruler"];
export function isWeapon(kind: ItemKind | null): kind is WeaponKind {
  return kind !== null && (WEAPON_KINDS as string[]).includes(kind);
}
export function isConsumable(kind: ItemKind | null): kind is ConsumableKind {
  return kind !== null && !isWeapon(kind);
}

// helper to persist current state (defined after GameState type is available)
function persistFromStore(state: GameState) {
  saveProgress({
    stars: state.stars,
    achievements: state.achievements,
    bestTimes: state.bestTimes,
    totalKicks: state.totalKicks,
    maxLevelReached: state.maxLevelReached,
  });
}
