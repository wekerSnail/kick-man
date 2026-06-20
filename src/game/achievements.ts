// Central source of truth for all achievements in the game.
// Used by Gallery, StartScreen, VictoryScreen, etc. to keep counts consistent.

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  // optional hint shown in gallery when locked
  hint?: string;
}

export const ALL_ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_blood", name: "初次踹击", icon: "🩸", desc: "第一次成功踹中神人" },
  { id: "perfect", name: "完美通关", icon: "🛡️", desc: "零伤害零发现通关任意关卡" },
  { id: "stealth", name: "潜行达人", icon: "🥷", desc: "零发现通关任意关卡" },
  { id: "speedrun", name: "速通达人", icon: "⚡", desc: "第1关 30 秒内通关" },
  { id: "combo5", name: "连击5次", icon: "🔥", desc: "连续命中 5 次" },
  { id: "combo10", name: "连击大师", icon: "💥", desc: "连续命中 10 次" },
  { id: "weapon_master", name: "武器行者", icon: "🏏", desc: "使用武器命中神人" },
  { id: "pacifist_kick", name: "徒手行者", icon: "🦵", desc: "全程只用脚踹通关" },
  { id: "no_items", name: "极简主义者", icon: "🎒", desc: "全程不用道具通关" },
  { id: "surviver", name: "职场幸存者", icon: "💼", desc: "到达第 5 关" },
  { id: "kicker_100", name: "踹击狂人", icon: "💯", desc: "单关 50+ 踹击" },
  { id: "level7", name: "通关大吉", icon: "👑", desc: "完成第 7 关" },
  {
    id: "variant_master",
    name: "变体克星",
    icon: "🎯",
    desc: "击败所有 5 种 Boss 变体（普通/眼镜/咖啡/耳机/暴怒）",
    hint: "通关 1-7 关即可解锁",
  },
  {
    id: "enrage_survivor",
    name: "暴怒幸存者",
    icon: "🌋",
    desc: "在第 7 关暴怒状态下存活 3 次（不被发现）",
    hint: "躲避暴怒全图检测 3 次",
  },
];

export const ACHIEVEMENT_COUNT = ALL_ACHIEVEMENTS.length; // 14

// Boss variants definitions (used by Gallery + TutorialHint + StartScreen)
export interface BossVariantDef {
  id: "normal" | "glasses" | "coffee" | "headphones" | "rage";
  icon: string;
  name: string;
  levelRange: string;
  color: string;
  bgGradient: string;
  borderColor: string;
  description: string;
  mechanics: string;
  weakness: string;
}

export const BOSS_VARIANTS: BossVariantDef[] = [
  {
    id: "normal",
    icon: "👨‍💼",
    name: "普通神人",
    levelRange: "第 1-2 关",
    color: "text-emerald-300",
    bgGradient: "from-emerald-950/40 to-slate-900",
    borderColor: "border-emerald-400/30",
    description: "标准办公室神人，正常办公、偶尔看手机、开会、巡逻。基础检测范围。",
    mechanics: "半圆检测 5u · 回头检测 6u · 巡逻检测 7u",
    weakness: "蹲盆栽/书架/沙发旁隐藏 · 用隐身药水穿检测区",
  },
  {
    id: "glasses",
    icon: "🤓",
    name: "戴眼镜的神人",
    levelRange: "第 3-4 关",
    color: "text-sky-300",
    bgGradient: "from-sky-950/40 to-slate-900",
    borderColor: "border-sky-400/30",
    description: "戴着厚厚的眼镜，视野范围更广（+40%），更远的距离就能发现你。",
    mechanics: "半圆检测 5→7 · 回头检测 6→8 · 巡逻 7→8",
    weakness: "烟雾弹、隐身药水、键盘盾都能有效对抗；藏身点依然有效",
  },
  {
    id: "coffee",
    icon: "☕",
    name: "喝咖啡的神人",
    levelRange: "第 5 关",
    color: "text-orange-300",
    bgGradient: "from-orange-950/40 to-slate-900",
    borderColor: "border-orange-400/30",
    description: "咖啡因让神人格外警觉！所有行为计时器额外加速 ×0.85，更频繁地回头/巡逻/开会。",
    mechanics: "计时器 ×0.85（动作更频繁）· 检测范围同普通",
    weakness: "噪音器依然能干扰；加速鞋+隐身药水组合可以快速突袭",
  },
  {
    id: "headphones",
    icon: "🎧",
    name: "戴耳机的神人",
    levelRange: "第 6 关",
    color: "text-purple-300",
    bgGradient: "from-purple-950/40 to-slate-900",
    borderColor: "border-purple-400/30",
    description: "神人戴着耳机听音乐，完全免疫噪音器的干扰！但视野和正常一样。",
    mechanics: "噪音器无效 · 检测范围同普通",
    weakness: "用烟雾弹挡视线、隐身药水穿检测区",
  },
  {
    id: "rage",
    icon: "😡",
    name: "暴怒的神人",
    levelRange: "第 7 关",
    color: "text-red-300",
    bgGradient: "from-red-950/40 to-slate-900",
    borderColor: "border-red-400/40",
    description: "终极形态！每 12 秒进入 4 秒【暴怒状态】，无视距离/方向全图检测！并且需要 4 次踹击才能击倒。",
    mechanics: "周期暴怒（12s 冷静 → 4s 暴怒）· 暴怒时全图检测 · HP 4",
    weakness: "暴怒时躲进藏身点或用隐身药水；暴怒间隙（8s 冷静期）是攻击良机；烟雾弹可挡暴怒检测",
  },
];

export const VARIANT_ICONS: Record<string, string> = BOSS_VARIANTS.reduce(
  (acc, v) => ({ ...acc, [v.id]: v.icon }),
  {} as Record<string, string>
);
