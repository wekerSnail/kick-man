// ===== Shared game types =====

export type GameScreen =
  | "start"
  | "playing"
  | "level-transition"
  | "game-over"
  | "victory"
  | "fps";

export type BossStateName =
  | "Normal"
  | "PhoneFlashing"
  | "LookingBack"
  | "Attacked"
  | "Meeting"
  | "Patrol"
  | "Stunned"
  | "Distracted";

export type WeaponKind = "mace" | "bat" | "pan" | "ruler";

export type ConsumableKind =
  | "speed" // 加速鞋
  | "invis" // 隐身药水
  | "noise" // 噪音器
  | "combo" // 连击手套
  | "keyboard" // 键盘盾
  | "smoke"; // 烟雾弹

export type ItemKind = WeaponKind | ConsumableKind;

export interface InventorySlot {
  kind: ItemKind | null;
  count: number;
}

export interface WeaponDef {
  kind: WeaponKind;
  name: string;
  icon: string;
  hits: number; // 命中次数（一脚=多少踹击数）
  stun: number; // 眩晕秒
  swingTime: number; // 挥砍时长
  range: number; // 攻击范围
  spawnRate: number; // 刷新概率
  throwable: boolean;
  color: number;
}

export interface ConsumableDef {
  kind: ConsumableKind;
  name: string;
  icon: string;
  duration: number; // 0 = instant
  spawnRate: number;
  color: number;
  desc: string;
}

export interface StatusFlags {
  hidden: boolean;
  invisible: boolean;
  spedUp: boolean;
  combo: boolean;
  shieldActive: boolean; // 键盘盾激活
  patrolWarn: boolean;
}

export interface LevelDef {
  level: number;
  target: number;
}

export interface ToastMsg {
  id: number;
  text: string;
  kind: "info" | "warn" | "danger" | "good";
}
