# 游戏平衡性与体验迭代方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复游戏设计分析中发现的 12 个平衡性和体验问题，提升整体游戏品质。

**Architecture:** 所有改动集中在 4 个文件内，不引入新依赖或架构变更。改动分为 5 个独立任务组，可按顺序执行，每组改动互不依赖。

**Tech Stack:** TypeScript, Three.js, Zustand, React

---

## 涉及文件清单

| 文件 | 职责 | 改动类型 |
|------|------|---------|
| `src/game/constants.ts` | 武器数值、关卡目标、世界参数 | 修改数值 |
| `src/game/engine/Boss.ts` | Boss AI 状态机、碰撞检测、巡逻 | 修改逻辑 |
| `src/game/engine/GameEngine.ts` | 攻击系统、FPS 奖励、道具磁铁 | 修改逻辑 |
| `src/game/store.ts` | 连击系统、FPS 奖励状态 | 添加字段 |
| `src/game/components/LevelTransition.tsx` | 关卡结算界面 | 显示 FPS 奖励 |

---

## Task 1: 武器与道具数值平衡

**Files:**
- Modify: `src/game/constants.ts:25-74` (武器定义)
- Modify: `src/game/constants.ts:77-132` (道具定义)

### 问题描述
- 狼牙棒（5 伤害）过于强大，一次挥击可秒杀 4 HP 的 Boss
- 戒尺最弱但最稀有（2%），违反"稀有=强大"直觉
- 隐身药水持续 5 秒且出生率 17%，过于强大

- [ ] **Step 1: 调整狼牙棒数值**

修改 `src/game/constants.ts` 中狼牙棒定义：

```typescript
// 修改前
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

// 修改后
mace: {
  kind: "mace",
  name: "狼牙棒",
  icon: "🏏",
  hits: 3,        // 5 → 3，不再能一击秒杀 4HP Boss
  stun: 2,        // 3 → 2，眩晕时间略降
  swingTime: 0.45, // 0.4 → 0.45，挥击略慢
  range: 2.5,
  spawnRate: 0.05, // 0.1 → 0.05，降低出生率
  throwable: true,
  color: 0x8b5a2b,
},
```

- [ ] **Step 2: 调整戒尺数值——赋予独特优势**

```typescript
// 修改前
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

// 修改后
ruler: {
  kind: "ruler",
  name: "戒尺",
  icon: "📏",
  hits: 1,
  stun: 1.5,       // 1 → 1.5，眩晕更长作为补偿
  swingTime: 0.15,  // 0.2 → 0.15，最快的挥击速度
  range: 2.4,       // 2.2 → 2.4，略增范围
  spawnRate: 0.10,  // 0.02 → 0.10，提升出生率
  throwable: true,
  color: 0xd4a373,
},
```

- [ ] **Step 3: 调整棒球棒出生率**

```typescript
// 修改前
bat: {
  ...
  spawnRate: 0.08,
  ...
},

// 修改后
bat: {
  ...
  spawnRate: 0.08,  // 保持不变
  ...
},
```

- [ ] **Step 4: 调整平底锅出生率**

```typescript
// 修改前
pan: {
  ...
  spawnRate: 0.05,
  ...
},

// 修改后
pan: {
  ...
  spawnRate: 0.07,  // 0.05 → 0.07，略微提升
  ...
},
```

- [ ] **Step 5: 调整隐身药水**

```typescript
// 修改前
invis: {
  kind: "invis",
  name: "隐身药水",
  icon: "🧪",
  duration: 5,
  spawnRate: 0.17,
  color: 0x60a5fa,
  desc: "免疫所有检测，持续5秒",
},

// 修改后
invis: {
  kind: "invis",
  name: "隐身药水",
  icon: "🧪",
  duration: 3,       // 5 → 3，缩短持续时间
  spawnRate: 0.12,   // 0.17 → 0.12，降低出生率
  color: 0x60a5fa,
  desc: "免疫所有检测，持续3秒",  // 更新描述
},
```

- [ ] **Step 6: 验证修改后的出生率总和**

修改后的武器出生率总和：0.05 + 0.08 + 0.07 + 0.10 = 0.30
修改后的道具出生率总和：0.12 + 0.12 + 0.13 + 0.13 + 0.15 + 0.12 = 0.77
总和：1.07（加权随机，无需归一化，`rollItemKind()` 已处理）

**验证方式：** 运行 `pnpm dev`，进入游戏，观察道具刷新情况。狼牙棒应明显更稀有，戒尺应更常见。

- [ ] **Step 7: 提交**

```bash
git add src/game/constants.ts
git commit -m "balance: nerf mace (5→3 hits, 10%→5% spawn), buff ruler (faster swing, 2%→10% spawn), nerf invis (5s→3s, 17%→12%)"
```

---

## Task 2: Boss AI 修复

**Files:**
- Modify: `src/game/engine/Boss.ts:1784-1835` (Distracted 状态移动)
- Modify: `src/game/engine/Boss.ts:1695-1727` (Patrol 移动碰撞)
- Modify: `src/game/engine/Boss.ts:172` (stuckTimer)

### 问题描述
- Distracted 状态无碰撞检测，Boss 会穿过家具
- 巡逻碰撞半径 0.35 小于玩家 0.55，Boss 能穿过玩家不能过的缝隙
- `stuckTimer` 变量已声明但未使用

- [ ] **Step 1: 为 Distracted 状态添加碰撞检测**

修改 `src/game/engine/Boss.ts` 中 `updateDistracted` 方法的 `d_walk` 和 `d_return` 阶段。

在 `d_walk` 阶段（约第 1791-1809 行），替换直接位移为带碰撞的位移：

```typescript
// 修改前（d_walk 阶段）
} else if (p === "d_walk") {
  if (this.distractTarget) {
    const dx = this.distractTarget.x - this.x;
    const dz = this.distractTarget.z - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 0.5) {
      const step = Math.min(dist, 3 * ctx.dt);
      this.x += (dx / dist) * step;
      this.z += (dz / dist) * step;
      this.targetFacingY = Math.atan2(dx, dz);
      this.walkPhase += ctx.dt * 8;
      this.leftLeg.rotation.x = Math.sin(this.walkPhase) * 0.6;
      this.rightLeg.rotation.x = -Math.sin(this.walkPhase) * 0.6;
    } else {
      this.advancePhase();
    }
  } else {
    this.advancePhase();
  }
}

// 修改后（d_walk 阶段）
} else if (p === "d_walk") {
  if (this.distractTarget) {
    const dx = this.distractTarget.x - this.x;
    const dz = this.distractTarget.z - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 0.5) {
      const step = Math.min(dist, 3 * ctx.dt);
      let nx = this.x + (dx / dist) * step;
      let nz = this.z + (dz / dist) * step;
      // 碰撞检测（使用标准半径 0.5）
      if (this.collidesAtRadius(nx, nz, ctx.colliders, 0.5)) {
        if (!this.collidesAtRadius(nx, this.z, ctx.colliders, 0.5)) {
          nz = this.z;
        } else if (!this.collidesAtRadius(this.x, nz, ctx.colliders, 0.5)) {
          nx = this.x;
        } else {
          // 完全卡住，跳过此阶段
          this.advancePhase();
          return;
        }
      }
      this.x = nx;
      this.z = nz;
      this.targetFacingY = Math.atan2(dx, dz);
      this.walkPhase += ctx.dt * 8;
      this.leftLeg.rotation.x = Math.sin(this.walkPhase) * 0.6;
      this.rightLeg.rotation.x = -Math.sin(this.walkPhase) * 0.6;
    } else {
      this.advancePhase();
    }
  } else {
    this.advancePhase();
  }
}
```

同样修改 `d_return` 阶段（约第 1817-1835 行）：

```typescript
// 修改前（d_return 阶段）
} else if (p === "d_return") {
  const dx = this.homeX - this.x;
  const dz = this.homeZ - this.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > 0.3) {
    const step = Math.min(dist, 3 * ctx.dt);
    this.x += (dx / dist) * step;
    this.z += (dz / dist) * step;
    // ... walk anim
  } else {
    // ... sit
  }
}

// 修改后（d_return 阶段）
} else if (p === "d_return") {
  const dx = this.homeX - this.x;
  const dz = this.homeZ - this.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > 0.3) {
    const step = Math.min(dist, 3 * ctx.dt);
    let nx = this.x + (dx / dist) * step;
    let nz = this.z + (dz / dist) * step;
    // 碰撞检测
    if (this.collidesAtRadius(nx, nz, ctx.colliders, 0.5)) {
      if (!this.collidesAtRadius(nx, this.z, ctx.colliders, 0.5)) {
        nz = this.z;
      } else if (!this.collidesAtRadius(this.x, nz, ctx.colliders, 0.5)) {
        nx = this.x;
      } else {
        // 卡住，直接回家
        this.x = this.homeX;
        this.z = this.homeZ;
        this.targetFacingY = Math.PI;
        this.sitting = true;
        if (this.phase.t >= this.phase.dur) {
          this.setState("Normal");
        }
        return;
      }
    }
    this.x = nx;
    this.z = nz;
    this.targetFacingY = Math.atan2(dx, dz);
    this.walkPhase += ctx.dt * 8;
    this.leftLeg.rotation.x = Math.sin(this.walkPhase) * 0.6;
    this.rightLeg.rotation.x = -Math.sin(this.walkPhase) * 0.6;
  } else {
    this.targetFacingY = Math.PI;
    this.sitting = true;
    if (this.phase.t >= this.phase.dur) {
      this.setState("Normal");
    }
  }
}
```

- [ ] **Step 2: 统一巡逻碰撞半径**

修改 `src/game/engine/Boss.ts` 中 `walkToward` 方法（约第 1704 行），将碰撞半径从 0.35 改为 0.5：

```typescript
// 修改前
const blocked = this.collidesAtRadius(nx, nz, ctx.colliders, 0.35);
if (blocked) {
  if (!this.collidesAtRadius(nx, this.z, ctx.colliders, 0.35)) {
    nz = this.z;
  } else if (!this.collidesAtRadius(this.x, nz, ctx.colliders, 0.35)) {
    nx = this.x;
  } else {
    // stuck — advance waypoint
    this.patrolIdx += forward ? 1 : -1;
    return;
  }
}

// 修改后
const blocked = this.collidesAtRadius(nx, nz, ctx.colliders, 0.5);
if (blocked) {
  if (!this.collidesAtRadius(nx, this.z, ctx.colliders, 0.5)) {
    nz = this.z;
  } else if (!this.collidesAtRadius(this.x, nz, ctx.colliders, 0.5)) {
    nx = this.x;
  } else {
    // stuck — advance waypoint
    this.patrolIdx += forward ? 1 : -1;
    return;
  }
}
```

- [ ] **Step 3: 清理未使用的 stuckTimer**

删除 `src/game/engine/Boss.ts` 第 172 行的 `stuckTimer` 声明：

```typescript
// 删除这行
private stuckTimer = 0;
```

- [ ] **Step 4: 验证 Boss AI 修改**

运行 `pnpm dev`，进入游戏：
1. 使用噪音器吸引 Boss，观察 Boss 是否会被家具挡住
2. 等待 Boss 巡逻，观察 Boss 是否不再穿过狭窄缝隙
3. 确认无编译错误

- [ ] **Step 5: 提交**

```bash
git add src/game/engine/Boss.ts
git commit -m "fix: add collision to Distracted state, unify patrol collision radius to 0.5, remove unused stuckTimer"
```

---

## Task 3: 检测系统与难度调整

**Files:**
- Modify: `src/game/constants.ts:21` (detectionCooldown)
- Modify: `src/game/constants.ts:193-201` (关卡目标)
- Modify: `src/game/engine/Boss.ts` (怀疑值触发 LookingBack 时的冷却保护)
- Modify: `src/game/engine/GameEngine.ts:1062-1067` (星级评价)

### 问题描述
- 检测冷却 5 秒过于宽松，被发现后有太多喘息时间
- 第 7 关 150 踢目标过高，与第 6 关 100 踢形成断崖
- 怀疑值触发 LookingBack 时无冷却保护，可能被连击
- 3 星要求零伤害零发现过于严苛

- [ ] **Step 1: 缩短检测冷却时间**

修改 `src/game/constants.ts` 第 21 行：

```typescript
// 修改前
detectionCooldown: 5, // 半圆检测扣血冷却

// 修改后
detectionCooldown: 3, // 半圆检测扣血冷却（从5秒降至3秒）
```

- [ ] **Step 2: 平滑第 7 关难度曲线**

修改 `src/game/constants.ts` 中的关卡定义：

```typescript
// 修改前
export const LEVELS: LevelDef[] = [
  { level: 1, target: 10 },
  { level: 2, target: 20 },
  { level: 3, target: 35 },
  { level: 4, target: 50 },
  { level: 5, target: 70 },
  { level: 6, target: 100 },
  { level: 7, target: 150 },
];

// 修改后
export const LEVELS: LevelDef[] = [
  { level: 1, target: 10 },
  { level: 2, target: 20 },
  { level: 3, target: 35 },
  { level: 4, target: 50 },
  { level: 5, target: 70 },
  { level: 6, target: 100 },
  { level: 7, target: 120 },  // 150 → 120，降低断崖感
];
```

- [ ] **Step 3: 为怀疑值触发 LookingBack 添加冷却保护**

在 `src/game/engine/Boss.ts` 中找到怀疑值检测逻辑（Normal 状态下的 `updateNormal` 方法），在怀疑值满触发 LookingBack 之前检查检测冷却：

找到类似以下代码：
```typescript
// 修改前（约在 updateNormal 方法中）
if (this.suspicion >= 1) {
  this.suspicion = 0;
  this.startLookingBackSequence();
  return;
}
```

修改为：
```typescript
// 修改后
if (this.suspicion >= 1) {
  this.suspicion = 0;
  // 只有在检测冷却结束时才触发回头
  if (this.detectCooldown <= 0) {
    this.startLookingBackSequence();
  }
  return;
}
```

- [ ] **Step 4: 放宽 3 星评价标准**

修改 `src/game/engine/GameEngine.ts` 中的 `computeStars` 方法（约第 1062-1067 行）：

```typescript
// 修改前
private computeStars(): number {
  const dmg = this.store.damageThisLevel;
  const det = this.store.detectionsThisLevel;
  if (dmg === 0 && det === 0) return 3;
  if (det <= 1 && dmg <= 1) return 2;
  return 1;
}

// 修改后
private computeStars(): number {
  const dmg = this.store.damageThisLevel;
  const det = this.store.detectionsThisLevel;
  if (dmg === 0 && det <= 1) return 3;  // 允许被发现 1 次仍得 3 星
  if (dmg <= 1 && det <= 2) return 2;   // 允许更多容错
  return 1;
}
```

- [ ] **Step 5: 验证检测与难度修改**

运行 `pnpm dev`，进入游戏：
1. 被 Boss 发现后，观察冷却时间是否缩短（约 3 秒后可再次被检测）
2. 进入第 7 关，确认目标显示为 120
3. 故意被发现 1 次但不受伤通关，确认获得 3 星

- [ ] **Step 6: 提交**

```bash
git add src/game/constants.ts src/game/engine/Boss.ts src/game/engine/GameEngine.ts
git commit -m "balance: reduce detection cooldown 5→3s, level 7 target 150→120, relax 3-star to allow 1 detection, add cooldown guard to suspicion trigger"
```

---

## Task 4: 连击上限与道具磁铁调整

**Files:**
- Modify: `src/game/engine/GameEngine.ts:1634-1642` (道具磁铁)
- Modify: `src/game/store.ts:458-462` (连击系统)

### 问题描述
- 道具磁铁范围 2.5 单位过强，玩家无需移动即可拾取
- 连击手套 + 狼牙棒可无限连击，缺乏上限

- [ ] **Step 1: 缩减道具磁铁范围和强度**

修改 `src/game/engine/GameEngine.ts` 中 `updateItems` 方法（约第 1634-1642 行）：

```typescript
// 修改前
// magnet effect: when player within 2.5u, drift item toward player
const dx = this.px - it.mesh.position.x;
const dz = this.pz - it.mesh.position.z;
const d = Math.sqrt(dx * dx + dz * dz);
if (d < 2.5 && d > 0.01) {
  const pull = (1 - d / 2.5) * 2.5 * dt; // stronger when closer
  it.mesh.position.x += (dx / d) * pull;
  it.mesh.position.z += (dz / d) * pull;
}

// 修改后
// magnet effect: when player within 1.8u, drift item toward player
const dx = this.px - it.mesh.position.x;
const dz = this.pz - it.mesh.position.z;
const d = Math.sqrt(dx * dx + dz * dz);
if (d < 1.8 && d > 0.01) {
  const pull = (1 - d / 1.8) * 1.5 * dt; // 范围和力度都降低
  it.mesh.position.x += (dx / d) * pull;
  it.mesh.position.z += (dz / d) * pull;
}
```

- [ ] **Step 2: 添加连击上限**

修改 `src/game/store.ts` 中的 `incCombo` 方法（约第 458-462 行），添加连击上限：

```typescript
// 修改前
incCombo: () =>
  set((st) => {
    const nc = st.currentCombo + 1;
    return { currentCombo: nc, comboMax: Math.max(st.comboMax, nc) };
  }),

// 修改后
incCombo: () =>
  set((st) => {
    const nc = Math.min(st.currentCombo + 1, 15); // 上限 15 连击
    return { currentCombo: nc, comboMax: Math.max(st.comboMax, nc) };
  }),
```

- [ ] **Step 3: 更新连击成就阈值以匹配新上限**

修改 `src/game/engine/GameEngine.ts` 中的成就检查（约第 1080-1081 行）：

```typescript
// 修改前
if (s.comboMax >= 5) s.unlockAchievement("combo5", "连击5次");
if (s.comboMax >= 10) s.unlockAchievement("combo10", "连击大师：10连击");

// 修改后
if (s.comboMax >= 5) s.unlockAchievement("combo5", "连击5次");
if (s.comboMax >= 10) s.unlockAchievement("combo10", "连击大师：10连击");
if (s.comboMax >= 15) s.unlockAchievement("combo15", "连击宗师：15连击（上限）");
```

- [ ] **Step 4: 验证连击与磁铁修改**

运行 `pnpm dev`，进入游戏：
1. 拾取道具时，确认需要更靠近才能被磁铁吸引
2. 使用连击手套 + 武器连续攻击，确认连击数不会超过 15
3. 确认 10 连击成就仍可正常解锁

- [ ] **Step 5: 提交**

```bash
git add src/game/engine/GameEngine.ts src/game/store.ts
git commit -m "balance: reduce item magnet range 2.5→1.8, add combo cap at 15, add combo15 achievement"
```

---

## Task 5: FPS 模式奖励系统

**Files:**
- Modify: `src/game/store.ts` (添加 FPS 奖励状态)
- Modify: `src/game/engine/GameEngine.ts` (FPS 结束时计算奖励)
- Modify: `src/game/components/LevelTransition.tsx` (显示 FPS 奖励)

### 问题描述
- FPS 模式与主游戏完全脱节，分数不转化为任何奖励
- 玩家缺乏参与 FPS 模式的动力

- [ ] **Step 1: 在 store 中添加 FPS 奖励状态**

在 `src/game/store.ts` 的 store 接口中添加新字段（约在第 128 行 `fpsScore` 之后）：

```typescript
// 在 fpsScore: number; 之后添加
fpsReward: { kind: ConsumableKind; count: number } | null; // FPS 奖励道具
```

在 store 实现中添加对应的状态和 setter（约在第 360 行 `fpsScore: 0` 之后）：

```typescript
// 在 fpsScore: 0, 之后添加
fpsReward: null,
```

在 `setFps` 方法中添加 reward 处理，或者添加一个新的 `setFpsReward` 方法：

```typescript
// 在 setFps 定义之后添加
setFpsReward: (reward: { kind: ConsumableKind; count: number } | null) =>
  set({ fpsReward: reward }),
```

同时在 store 接口类型中声明 `setFpsReward`。

- [ ] **Step 2: 在 GameEngine 的 exitFPS 中计算并存储奖励**

修改 `src/game/engine/GameEngine.ts` 中的 `exitFPS` 方法（约第 1321-1341 行）：

```typescript
// 修改前
private exitFPS() {
  if (this.fpsMode) {
    this.fpsMode.stop();
    this.fpsMode = null;
  }
  // clear FPS store state so no FPS UI lingers
  useGameStore.setState({
    fpsWeapon: null,
    fpsTimeLeft: 30,
    fpsAmmo: 999,
    fpsScore: 0,
  });
  // return to level transition
  this.store.setBossDialogue(null);
  this.store.clearEventBanner();
  this.store.setScreen("level-transition");
  this.screen = "level-transition";
  this.paused = true;
  audio.startBgMusic();
}

// 修改后
private exitFPS() {
  const score = this.store.fpsScore;
  if (this.fpsMode) {
    this.fpsMode.stop();
    this.fpsMode = null;
  }

  // 根据 FPS 分数给予奖励
  let reward: { kind: ConsumableKind; count: number } | null = null;
  if (score >= 200) {
    // 高分：随机 2 个道具
    const pool: ConsumableKind[] = ["speed", "invis", "combo", "keyboard", "smoke"];
    const kind = pool[Math.floor(Math.random() * pool.length)];
    reward = { kind, count: 2 };
  } else if (score >= 100) {
    // 中分：随机 1 个道具
    const pool: ConsumableKind[] = ["speed", "invis", "noise", "combo", "keyboard", "smoke"];
    const kind = pool[Math.floor(Math.random() * pool.length)];
    reward = { kind, count: 1 };
  }
  this.store.setFpsReward(reward);

  // 如果有奖励，直接加入背包
  if (reward) {
    for (let i = 0; i < reward.count; i++) {
      this.store.addItem(reward.kind, 1);
    }
  }

  // clear FPS store state
  useGameStore.setState({
    fpsWeapon: null,
    fpsTimeLeft: 30,
    fpsAmmo: 999,
    fpsScore: 0,
  });
  // return to level transition
  this.store.setBossDialogue(null);
  this.store.clearEventBanner();
  this.store.setScreen("level-transition");
  this.screen = "level-transition";
  this.paused = true;
  audio.startBgMusic();
}
```

- [ ] **Step 3: 在 LevelTransition 界面显示 FPS 奖励**

修改 `src/game/components/LevelTransition.tsx`，在 FPS 按钮附近显示奖励信息。

在 FPS 按钮区域（约第 192 行之后）添加奖励提示：

```tsx
// 在 FPS 按钮的 <p> 标签之后添加
{fpsReward && (
  <div className="mt-2 px-3 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-300 text-sm animate-[popin_0.3s_ease-out]">
    🎉 FPS 奖励：{itemIcon(fpsReward.kind)} {itemName(fpsReward.kind)} ×{fpsReward.count} 已加入背包！
  </div>
)}
```

在组件顶部添加 store 订阅：

```tsx
const fpsReward = useGameStore((s) => s.fpsReward);
```

并导入需要的函数：

```tsx
import { itemIcon, itemName } from "../constants";
```

- [ ] **Step 4: 在开始新关卡时清除 FPS 奖励状态**

在 `src/game/engine/GameEngine.ts` 的 `startLevel` 方法开头添加：

```typescript
this.store.setFpsReward(null);
```

- [ ] **Step 5: 验证 FPS 奖励系统**

运行 `pnpm dev`，进入游戏：
1. 通关任意关卡后，点击"奖励神人（FPS 彩蛋）"
2. 在 FPS 模式中击中 Boss 多次，积累分数
3. FPS 结束后，确认关卡结算界面显示奖励道具
4. 确认道具已加入背包
5. 开始下一关时，确认奖励提示消失

- [ ] **Step 6: 提交**

```bash
git add src/game/store.ts src/game/engine/GameEngine.ts src/game/components/LevelTransition.tsx
git commit -m "feat: FPS mode rewards — score 100+ gives 1 item, 200+ gives 2 items, shown in level transition"
```

---

## 最终验证清单

完成所有任务后，进行完整的游戏体验测试：

- [ ] **武器平衡**：狼牙棒不再一击秒杀高 HP Boss；戒尺更常见且有独特手感
- [ ] **Boss AI**：分心状态不会穿墙；巡逻不会穿过狭窄缝隙
- [ ] **检测系统**：冷却从 5 秒降至 3 秒，节奏更紧凑
- [ ] **怀疑值**：不再在检测冷却期间触发回头
- [ ] **关卡难度**：第 7 关目标 120，曲线更平滑
- [ ] **星级评价**：被发现 1 次仍可获得 3 星
- [ ] **道具磁铁**：需要更靠近才能吸引
- [ ] **连击上限**：最高 15 连击，成就系统匹配
- [ ] **FPS 奖励**：分数转化为下一关的起始道具

```bash
git add -A
git commit -m "docs: update worklog with balance iteration changes"
```
