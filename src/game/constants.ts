import type {
  WeaponDef,
  ConsumableDef,
  LevelDef,
  WeaponKind,
  ConsumableKind,
} from "./types";

// ===== World / player =====
export const WORLD = {
  half: 12, // [-12, 12] — expanded room for more player space
  wallHeight: 3.2,
  playerStart: { x: 0, z: 7 },
  bossStart: { x: 0, z: -8 },
  playerSpeed: 5,
  playerRadius: 0.55,
  bossRadius: 0.7,
  kickRange: 2,
  kickCooldown: 5,
  pickupRange: 1.5,
  detectionCooldown: 5, // 半圆检测扣血冷却
};

// ===== Weapons =====
export const WEAPONS: Record<WeaponKind, WeaponDef> = {
  mace: {
    kind: "mace",
    name: "狼牙棒",
    icon: "🏏",
    hits: 5,
    stun: 3,
    swingTime: 0.4,
    range: 2.5,
    spawnRate: 0.1,
    throwable: true,
    color: 0x8b5a2b,
  },
  bat: {
    kind: "bat",
    name: "棒球棒",
    icon: "⚾",
    hits: 3,
    stun: 2,
    swingTime: 0.35,
    range: 2.8,
    spawnRate: 0.08,
    throwable: true,
    color: 0xc9856b,
  },
  pan: {
    kind: "pan",
    name: "平底锅",
    icon: "🍳",
    hits: 1,
    stun: 1.5,
    swingTime: 0.3,
    range: 2.0,
    spawnRate: 0.05,
    throwable: true,
    color: 0x444444,
  },
  ruler: {
    kind: "ruler",
    name: "戒尺",
    icon: "📏",
    hits: 1,
    stun: 1,
    swingTime: 0.2,
    range: 2.2,
    spawnRate: 0.02,
    throwable: true,
    color: 0xd4a373,
  },
};

// ===== Consumables =====
export const CONSUMABLES: Record<ConsumableKind, ConsumableDef> = {
  speed: {
    kind: "speed",
    name: "加速鞋",
    icon: "👟",
    duration: 5,
    spawnRate: 0.17,
    color: 0x4ade80,
    desc: "移动速度 x2，持续5秒",
  },
  invis: {
    kind: "invis",
    name: "隐身药水",
    icon: "🧪",
    duration: 5,
    spawnRate: 0.17,
    color: 0x60a5fa,
    desc: "免疫所有检测，持续5秒",
  },
  noise: {
    kind: "noise",
    name: "噪音器",
    icon: "📢",
    duration: 0,
    spawnRate: 0.13,
    color: 0xfbbf24,
    desc: "吸引老板前往噪音位置",
  },
  combo: {
    kind: "combo",
    name: "连击手套",
    icon: "🥊",
    duration: 5,
    spawnRate: 0.13,
    color: 0xf87171,
    desc: "攻击无冷却，持续5秒",
  },
  keyboard: {
    kind: "keyboard",
    name: "键盘",
    icon: "⌨️",
    duration: 5,
    spawnRate: 0.15,
    color: 0xa16207,
    desc: "装备后可挡脸防御",
  },
  smoke: {
    kind: "smoke",
    name: "烟雾弹",
    icon: "💨",
    duration: 6,
    spawnRate: 0.12,
    color: 0x9ca3af,
    desc: "在玩家位置制造烟雾区，老板无法透过烟雾检测",
  },
};

export const ALL_ITEM_KINDS: (WeaponKind | ConsumableKind)[] = [
  "mace",
  "bat",
  "pan",
  "ruler",
  "speed",
  "invis",
  "noise",
  "combo",
  "keyboard",
  "smoke",
];

// weighted random item kind (for spawning)
export function rollItemKind(): WeaponKind | ConsumableKind {
  const entries: { kind: WeaponKind | ConsumableKind; w: number }[] = [
    { kind: "mace", w: WEAPONS.mace.spawnRate },
    { kind: "bat", w: WEAPONS.bat.spawnRate },
    { kind: "pan", w: WEAPONS.pan.spawnRate },
    { kind: "ruler", w: WEAPONS.ruler.spawnRate },
    { kind: "speed", w: CONSUMABLES.speed.spawnRate },
    { kind: "invis", w: CONSUMABLES.invis.spawnRate },
    { kind: "noise", w: CONSUMABLES.noise.spawnRate },
    { kind: "combo", w: CONSUMABLES.combo.spawnRate },
    { kind: "keyboard", w: CONSUMABLES.keyboard.spawnRate },
    { kind: "smoke", w: CONSUMABLES.smoke.spawnRate },
  ];
  const total = entries.reduce((s, e) => s + e.w, 0);
  let r = Math.random() * total;
  for (const e of entries) {
    r -= e.w;
    if (r <= 0) return e.kind;
  }
  return "speed";
}

// ===== Hiding spots =====
export interface HidingSpot {
  id: string;
  name: string;
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: number;
}

export const HIDING_SPOTS: HidingSpot[] = [
  { id: "plant", name: "盆栽", x: -6, z: -5, w: 2, h: 3, d: 2, color: 0x2f8f4e },
  { id: "plant2", name: "盆栽", x: 7, z: -6, w: 2, h: 3, d: 2, color: 0x2f8f4e },
  { id: "plant3", name: "盆栽", x: -8, z: 4, w: 2, h: 3, d: 2, color: 0x2f8f4e },
  { id: "shelf", name: "书架", x: 6, z: -11, w: 3, h: 2, d: 1, color: 0x6b4423 },
  { id: "shelf2", name: "书架", x: -6, z: 11, w: 3, h: 2, d: 1, color: 0x6b4423 },
  { id: "sofa", name: "沙发", x: -8, z: 1, w: 4, h: 1, d: 2, color: 0x8b5cf6 },
  { id: "sofa2", name: "沙发", x: 9, z: 3, w: 4, h: 1, d: 2, color: 0x8b5cf6 },
];

// ===== Levels =====
export const LEVELS: LevelDef[] = [
  { level: 1, target: 10 },
  { level: 2, target: 20 },
  { level: 3, target: 35 },
  { level: 4, target: 50 },
  { level: 5, target: 70 },
  { level: 6, target: 100 },
  { level: 7, target: 150 },
];

// ===== Item spawn =====
export const ITEM_SPAWN = {
  interval: 10,
  maxItems: 5,
  yFloat: 0.5,
};

// ===== Boss dialogue lines =====
export const BOSS_LINES = {
  lookingFound: "你在瞎晃悠什么！",
  attackedKeyboard: "你以为你挡着我就看不到你？",
  attackedFound: "就是你小子打我，今晚留下来加班",
  attackedNone: "难道是我幻觉了",
  attackedWho: "谁在打我！",
  distracted: "什么声音？",
  meeting: [
    "对齐一下颗粒度",
    "降本增效",
    "我们是一个团队",
    "这个需求很简单",
    "下次一定",
    "我觉得可以再优化",
    "打通底层逻辑",
    "形成闭环",
  ],
  patrolWarn: "我去巡视一下",
  fps: [
    "这需求不合理！",
    "我要找 PM 理论！",
    "这 bug 不是我写的！",
    "让我先喝杯咖啡...",
    "能不能先对齐一下？",
    "别打了别打了！",
    "我也要下班啊！",
    "周末加班行不行？",
    "这个锅我不背！",
    "你行你上啊！",
    "需求又变了？",
    "我先去开个会",
    "代码在我本地是好的",
    "这得拉个群",
    "我周末有事...",
  ],
};

// ===== Inventory =====
export const INVENTORY_SIZE = 6;
export const MAX_HP = 3;

// ===== FPS mode =====
export const FPS_MODE = {
  duration: 30,
  playerPos: { x: 0, y: 1.6, z: 3 },
  bossXRange: 6,
  weapons: {
    laser: { name: "激光枪", fireRate: 5, bulletSpeed: 50, color: 0x00ffff },
    rocket: { name: "火箭炮", fireRate: 0.5, bulletSpeed: 30, color: 0xff6600 },
    grenade: { name: "手榴弹", fireRate: 0.8, bulletSpeed: 15, color: 0x3a3a3a },
  } as const,
};

// ===== Item color / emoji lookup =====
export function itemColor(kind: WeaponKind | ConsumableKind): number {
  if (kind in WEAPONS) return WEAPONS[kind as WeaponKind].color;
  return CONSUMABLES[kind as ConsumableKind].color;
}
export function itemIcon(kind: WeaponKind | ConsumableKind): string {
  if (kind in WEAPONS) return WEAPONS[kind as WeaponKind].icon;
  return CONSUMABLES[kind as ConsumableKind].icon;
}
export function itemName(kind: WeaponKind | ConsumableKind): string {
  if (kind in WEAPONS) return WEAPONS[kind as WeaponKind].name;
  return CONSUMABLES[kind as ConsumableKind].name;
}
