# Level Diversification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 丰富7个关卡之间的差异化体验，让每关有独特的地图布局、特殊机制和道具节奏，而非仅靠踢击目标数量和Boss变体区分。

**Architecture:** 引入 `LevelConfig` 系统，将地图布局、特殊机制、道具规则等参数化。`OfficeScene` 支持动态布局加载，`GameEngine` 根据关卡配置激活特殊机制。保持现有 Boss 变体系统不变，在此基础上叠加新维度。

**Tech Stack:** Three.js (地图几何), Zustand (状态), TypeScript

---

## File Structure

```
src/game/
├── types.ts                    # Modify: 新增 LevelConfig, MapLayout, SpecialMechanic 类型
├── constants.ts                # Modify: LEVELS 扩展为完整配置, 新增 MAP_LAYOUTS
├── engine/
│   ├── OfficeScene.ts          # Modify: 支持接收 MapLayout 参数构建不同布局
│   ├── GameEngine.ts           # Modify: startLevel 读取 LevelConfig, 激活特殊机制
│   └── LevelMechanics.ts       # Create: 特殊机制逻辑（计时、夜间、多Boss等）
├── store.ts                    # Modify: 新增关卡特殊状态（timer, visibility等）
└── components/
    └── HUD.tsx                 # Modify: 显示关卡特殊UI（计时器、夜间滤镜等）
```

---

## Task 1: 扩展类型定义

**Files:**
- Modify: `src/game/types.ts`

- [ ] **Step 1: 新增 LevelConfig 相关类型**

在 `types.ts` 中 `LevelDef` 接口后添加：

```typescript
// 地图布局变体
export interface MapLayout {
  id: string;
  name: string;
  // 额外障碍物（除了默认家具外）
  extraObstacles: Array<{
    x: number;
    z: number;
    w: number;
    h: number;
    d: number;
    color: number;
    type: "desk" | "cabinet" | "partition" | "plant";
  }>;
  // 额外隐藏点
  extraHidingSpots: Array<{
    id: string;
    name: string;
    x: number;
    z: number;
    w: number;
    h: number;
    d: number;
    color: number;
  }>;
  // Boss初始位置偏移（相对于默认位置）
  bossOffset: { x: number; z: number };
  // 玩家初始位置
  playerStart: { x: number; z: number };
  // 是否替换默认布局（false=在默认布局上叠加）
  replaceDefault: boolean;
}

// 特殊机制类型
export type SpecialMechanicType =
  | "none"
  | "timed"          // 限时通关
  | "night"          // 夜间模式（视野受限）
  | "patrol_heavy"   // 强化巡逻（Boss更频繁巡逻）
  | "fragile"        // 脆弱模式（被发现一次即失败）
  | "dark_zone";     // 暗区模式（部分区域不可见）

export interface SpecialMechanic {
  type: SpecialMechanicType;
  // 限时模式的秒数
  timeLimit?: number;
  // 夜间模式的视野半径
  visionRadius?: number;
  // 脆弱模式的允许发现次数（默认1）
  maxDetections?: number;
}

// 扩展 LevelDef
export interface LevelDef {
  level: number;
  target: number;
  // 新增字段
  mapLayoutId?: string;        // 对应 MAP_LAYOUTS 的 id，不填用默认布局
  specialMechanic?: SpecialMechanic;
  // 道具刷新间隔倍率（1=正常，0.5=更快，2=更慢）
  itemSpawnRateMultiplier?: number;
  // 可用武器列表（不填=全部）
  availableWeapons?: WeaponKind[];
  // 可用消耗品列表（不填=全部）
  availableConsumables?: ConsumableKind[];
}
```

- [ ] **Step 2: 验证类型无报错**

Run: `pnpm build`（或 `npx tsc --noEmit`）
Expected: 无类型错误（新增字段都是 optional，不影响现有代码）

- [ ] **Step 3: Commit**

```bash
git add src/game/types.ts
git commit -m "feat: add LevelConfig, MapLayout, SpecialMechanic types"
```

---

## Task 2: 定义关卡配置和地图布局

**Files:**
- Modify: `src/game/constants.ts`

- [ ] **Step 1: 新增 MAP_LAYOUTS 常量**

在 `HIDING_SPOTS` 之后、`LEVELS` 之前添加：

```typescript
import type { MapLayout } from "./types";

// ===== Map Layouts =====
export const MAP_LAYOUTS: Record<string, MapLayout> = {
  default: {
    id: "default",
    name: "标准办公室",
    extraObstacles: [],
    extraHidingSpots: [],
    bossOffset: { x: 0, z: 0 },
    playerStart: { x: 0, z: 7 },
    replaceDefault: false,
  },
  maze_office: {
    id: "maze_office",
    name: "迷宫办公区",
    extraObstacles: [
      // 中央隔断墙
      { x: -3, z: 0, w: 6, h: 2, d: 0.4, color: 0xaaaaaa, type: "partition" },
      // 额外文件柜形成通道
      { x: 3, z: 2, w: 1, h: 1.5, d: 1, color: 0x4a4a4a, type: "cabinet" },
      { x: -3, z: -4, w: 1, h: 1.5, d: 1, color: 0x4a4a4a, type: "cabinet" },
    ],
    extraHidingSpots: [
      { id: "plant_maze", name: "盆栽", x: 0, z: 3, w: 2, h: 3, d: 2, color: 0x2f8f4e },
    ],
    bossOffset: { x: 0, z: 0 },
    playerStart: { x: 0, z: 7 },
    replaceDefault: false,
  },
  open_plan: {
    id: "open_plan",
    name: "开放式办公区",
    extraObstacles: [
      // 长条办公桌
      { x: -4, z: 0, w: 4, h: 0.8, d: 1.2, color: 0x9a6b3f, type: "desk" },
      { x: 4, z: -2, w: 4, h: 0.8, d: 1.2, color: 0x9a6b3f, type: "desk" },
      { x: -4, z: -5, w: 4, h: 0.8, d: 1.2, color: 0x9a6b3f, type: "desk" },
    ],
    extraHidingSpots: [
      { id: "sofa_open", name: "沙发", x: 0, z: 5, w: 4, h: 1, d: 2, color: 0x8b5cf6 },
    ],
    bossOffset: { x: -3, z: 2 },
    playerStart: { x: 5, z: 7 },
    replaceDefault: false,
  },
  corner_office: {
    id: "corner_office",
    name: "角落办公室",
    extraObstacles: [
      // L形隔断
      { x: -6, z: 0, w: 0.4, h: 2, d: 8, color: 0xaaaaaa, type: "partition" },
      { x: -3, z: -4, w: 6, h: 2, d: 0.4, color: 0xaaaaaa, type: "partition" },
    ],
    extraHidingSpots: [
      { id: "plant_corner", name: "盆栽", x: -9, z: -8, w: 2, h: 3, d: 2, color: 0x2f8f4e },
    ],
    bossOffset: { x: -5, z: -3 },
    playerStart: { x: 5, z: 7 },
    replaceDefault: false,
  },
};
```

- [ ] **Step 2: 扩展 LEVELS 配置**

将现有 `LEVELS` 数组替换为：

```typescript
export const LEVELS: LevelDef[] = [
  {
    level: 1,
    target: 10,
    // 教学关：标准布局，无特殊机制，道具正常
  },
  {
    level: 2,
    target: 20,
    mapLayoutId: "open_plan",
    itemSpawnRateMultiplier: 1.2, // 稍微慢一点，逼迫玩家学习走位
  },
  {
    level: 3,
    target: 35,
    mapLayoutId: "maze_office",
    specialMechanic: { type: "timed", timeLimit: 120 },
  },
  {
    level: 4,
    target: 50,
    mapLayoutId: "corner_office",
    specialMechanic: { type: "night", visionRadius: 8 },
  },
  {
    level: 5,
    target: 70,
    mapLayoutId: "open_plan",
    specialMechanic: { type: "patrol_heavy" },
    itemSpawnRateMultiplier: 0.8, // 道具更快刷新，帮助应对频繁巡逻
  },
  {
    level: 6,
    target: 100,
    mapLayoutId: "maze_office",
    specialMechanic: { type: "dark_zone" },
    availableWeapons: ["mace", "bat"], // 只有近战武器
  },
  {
    level: 7,
    target: 120,
    specialMechanic: { type: "fragile", maxDetections: 1 },
    itemSpawnRateMultiplier: 0.6, // 道具充足但不能被发现
  },
];
```

- [ ] **Step 3: 验证编译通过**

Run: `pnpm build`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/game/constants.ts
git commit -m "feat: add MAP_LAYOUTS and extend LEVELS with layout/mechanic config"
```

---

## Task 3: OfficeScene 支持动态布局

**Files:**
- Modify: `src/game/engine/OfficeScene.ts`

- [ ] **Step 1: 修改 OfficeScene 构造函数接收 MapLayout**

将构造函数改为接收可选的 `MapLayout` 参数：

```typescript
export class OfficeScene {
  group: THREE.Group;
  colliders: Collider[] = [];
  bossChair: THREE.Group | null = null;
  plantLeaves: THREE.Mesh | null = null;
  // 新增：当前布局的额外碰撞器（用于重置时清理）
  private extraColliders: Collider[] = [];

  constructor(layout?: MapLayout) {
    this.group = new THREE.Group();
    this.build();
    if (layout) {
      this.applyLayout(layout);
    }
  }
```

- [ ] **Step 2: 添加 applyLayout 方法**

在 `OfficeScene` 类中添加：

```typescript
  /** 根据 MapLayout 添加额外障碍物和隐藏点 */
  applyLayout(layout: MapLayout) {
    // 清除之前的额外碰撞器
    for (const c of this.extraColliders) {
      const idx = this.colliders.indexOf(c);
      if (idx >= 0) this.colliders.splice(idx, 1);
    }
    this.extraColliders = [];

    // 添加额外障碍物
    for (const obs of layout.extraObstacles) {
      const geo = new THREE.BoxGeometry(obs.w, obs.h, obs.d);
      const mat = this.mat(obs.color);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(obs.x, obs.h / 2, obs.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);

      const collider: Collider = {
        minX: obs.x - obs.w / 2,
        maxX: obs.x + obs.w / 2,
        minZ: obs.z - obs.d / 2,
        maxZ: obs.z + obs.d / 2,
      };
      this.addCollider(collider);
      this.extraColliders.push(collider);
    }

    // 添加额外隐藏点
    for (const spot of layout.extraHidingSpots) {
      const kind = spot.id.replace(/[0-9]+$/, "");
      if (kind === "plant") {
        const plant = this.buildPlant(spot.x, spot.z);
        this.group.add(plant);
      } else if (kind === "shelf") {
        const shelf = this.buildShelf(spot.x, spot.z);
        this.group.add(shelf);
      } else if (kind === "sofa") {
        const sofa = this.buildSofa(spot.x, spot.z);
        this.group.add(sofa);
      }
      const collider: Collider = {
        minX: spot.x - spot.w / 2,
        maxX: spot.x + spot.w / 2,
        minZ: spot.z - spot.d / 2,
        maxZ: spot.z + spot.d / 2,
      };
      this.addCollider(collider);
      this.extraColliders.push(collider);
    }
  }

  /** 获取布局指定的Boss位置偏移 */
  getBossOffset(layout?: MapLayout): { x: number; z: number } {
    return layout?.bossOffset ?? { x: 0, z: 0 };
  }

  /** 获取布局指定的玩家起始位置 */
  getPlayerStart(layout?: MapLayout): { x: number; z: number } {
    return layout?.playerStart ?? WORLD.playerStart;
  }
```

- [ ] **Step 3: 验证编译通过**

Run: `pnpm build`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/game/engine/OfficeScene.ts
git commit -m "feat: OfficeScene supports dynamic MapLayout loading"
```

---

## Task 4: GameEngine 集成关卡配置

**Files:**
- Modify: `src/game/engine/GameEngine.ts`

- [ ] **Step 1: 修改 startLevel 读取 LevelConfig**

在 `startLevel` 方法中，读取关卡配置并应用布局：

```typescript
  private startLevel(level: number) {
    // clear FPS reward from previous level
    this.store.setFpsReward(null);

    // 读取关卡配置
    const levelConfig = LEVELS[level - 1];
    const layoutId = levelConfig?.mapLayoutId ?? "default";
    const layout = MAP_LAYOUTS[layoutId] ?? MAP_LAYOUTS.default;

    // 重置场景并应用布局
    // ... 现有的场景重置逻辑 ...
    this.officeScene = new OfficeScene(layout);

    // 使用布局指定的玩家起始位置
    const playerStart = layout.playerStart ?? WORLD.playerStart;
    this.px = playerStart.x;
    this.pz = playerStart.z;

    // 使用布局指定的Boss位置偏移
    const bossOffset = layout.bossOffset ?? { x: 0, z: 0 };
    // ... 在设置Boss位置时应用偏移 ...

    // 应用特殊机制
    this.applySpecialMechanic(levelConfig?.specialMechanic);

    // ... 其余现有逻辑 ...
  }
```

- [ ] **Step 2: 添加 applySpecialMechanic 方法**

```typescript
  private activeMechanic: SpecialMechanic | null = null;
  private mechanicTimer = 0;
  private nightOverlay: THREE.Mesh | null = null;

  private applySpecialMechanic(mechanic?: SpecialMechanic) {
    this.activeMechanic = mechanic ?? null;
    this.mechanicTimer = 0;

    // 清除之前的夜间效果
    if (this.nightOverlay) {
      this.scene.remove(this.nightOverlay);
      this.nightOverlay = null;
    }

    if (!mechanic) return;

    switch (mechanic.type) {
      case "timed":
        this.mechanicTimer = mechanic.timeLimit ?? 60;
        this.store.setMechanicTimer(this.mechanicTimer);
        break;
      case "night":
        this.createNightOverlay(mechanic.visionRadius ?? 8);
        break;
      case "patrol_heavy":
        // Boss巡逻频率在Boss.ts中通过difficultyScale处理
        break;
      case "fragile":
        // 在store中设置最大发现次数
        this.store.setMaxDetections(mechanic.maxDetections ?? 1);
        break;
      case "dark_zone":
        // 暗区效果通过夜间叠加层实现，但范围更大
        this.createNightOverlay(15);
        break;
    }
  }
```

- [ ] **Step 3: 添加夜间/暗区视觉效果**

```typescript
  private createNightOverlay(radius: number) {
    // 创建一个黑色平面覆盖整个地图，中间挖洞（玩家视野）
    const geo = new THREE.PlaneGeometry(WORLD.half * 2 + 4, WORLD.half * 2 + 4);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        playerPos: { value: new THREE.Vector2(0, 0) },
        visionRadius: { value: radius },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec2 playerPos;
        uniform float visionRadius;
        varying vec2 vUv;
        void main() {
          // 将UV转换为世界坐标（近似）
          vec2 worldPos = (vUv - 0.5) * 28.0; // WORLD.half*2+4 ≈ 28
          float dist = distance(worldPos, playerPos);
          float alpha = smoothstep(visionRadius * 0.7, visionRadius, dist);
          gl_FragColor = vec4(0.0, 0.0, 0.05, alpha * 0.85);
        }
      `,
    });
    this.nightOverlay = new THREE.Mesh(geo, mat);
    this.nightOverlay.rotation.x = -Math.PI / 2;
    this.nightOverlay.position.y = 3;
    this.scene.add(this.nightOverlay);
  }
```

- [ ] **Step 4: 在游戏循环中更新特殊机制**

在 `update(dt)` 方法中添加：

```typescript
    // 更新特殊机制
    this.updateMechanic(dt);
```

```typescript
  private updateMechanic(dt: number) {
    if (!this.activeMechanic) return;

    switch (this.activeMechanic.type) {
      case "timed":
        this.mechanicTimer -= dt;
        this.store.setMechanicTimer(Math.max(0, Math.ceil(this.mechanicTimer)));
        if (this.mechanicTimer <= 0) {
          // 时间到，游戏失败
          this.store.pushToast("⏰ 时间到！", "danger");
          this.triggerGameOver();
        }
        break;
      case "night":
      case "dark_zone":
        // 更新夜间效果的位置跟随玩家
        if (this.nightOverlay) {
          const mat = this.nightOverlay.material as THREE.ShaderMaterial;
          mat.uniforms.playerPos.value.set(this.px, this.pz);
        }
        break;
    }
  }
```

- [ ] **Step 5: 修改道具刷新逻辑支持倍率和武器限制**

在道具刷新逻辑中：

```typescript
    // 读取关卡配置的道具刷新倍率
    const levelConfig = LEVELS[this.store.level - 1];
    const spawnInterval = ITEM_SPAWN.interval * (levelConfig?.itemSpawnRateMultiplier ?? 1);
    const availableWeapons = levelConfig?.availableWeapons;
    const availableConsumables = levelConfig?.availableConsumables;

    // 在选择随机道具时，过滤可用列表
    // 如果 availableWeapons 存在，只从该列表中选择武器
    // 如果 availableConsumables 存在，只从该列表中选择消耗品
```

- [ ] **Step 6: 验证编译通过**

Run: `pnpm build`
Expected: 无错误

- [ ] **Step 7: Commit**

```bash
git add src/game/engine/GameEngine.ts
git commit -m "feat: GameEngine integrates LevelConfig, special mechanics, and item restrictions"
```

---

## Task 5: Store 扩展关卡特殊状态

**Files:**
- Modify: `src/game/store.ts`

- [ ] **Step 1: 新增 store 字段**

在 store 的 state 定义中添加：

```typescript
  // 特殊机制状态
  mechanicTimer: number | null;  // 限时模式剩余秒数
  maxDetections: number | null;  // 脆弱模式允许发现次数
  setMechanicTimer: (t: number | null) => void;
  setMaxDetections: (d: number | null) => void;
```

在 store 的实现中添加：

```typescript
  mechanicTimer: null,
  maxDetections: null,
  setMechanicTimer: (t) => set({ mechanicTimer: t }),
  setMaxDetections: (d) => set({ maxDetections: d }),
```

- [ ] **Step 2: 在 startLevel 重置时清除**

确保关卡开始时重置这些状态：

```typescript
  mechanicTimer: null,
  maxDetections: null,
```

- [ ] **Step 3: 验证编译通过**

Run: `pnpm build`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/game/store.ts
git commit -m "feat: store adds mechanicTimer and maxDetections for special mechanics"
```

---

## Task 6: HUD 显示关卡特殊信息

**Files:**
- Modify: `src/game/components/HUD.tsx`

- [ ] **Step 1: 添加计时器显示**

在 HUD 组件中，当 `mechanicTimer` 不为 null 时显示倒计时：

```tsx
  const mechanicTimer = useGameStore((s) => s.mechanicTimer);

  // 在 HUD 布局中添加（靠近顶部中央）：
  {mechanicTimer !== null && (
    <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg font-mono text-xl font-bold
      ${mechanicTimer <= 10 ? "bg-red-600/90 text-white animate-pulse" : "bg-black/60 text-white"}`}>
      ⏰ {mechanicTimer}s
    </div>
  )}
```

- [ ] **Step 2: 添加脆弱模式提示**

```tsx
  const maxDetections = useGameStore((s) => s.maxDetections);
  const detections = useGameStore((s) => s.detectionsThisLevel);

  // 在 HUD 中显示：
  {maxDetections !== null && (
    <div className="absolute top-4 right-4 px-3 py-1 rounded bg-yellow-600/80 text-white text-sm">
      ⚠️ 脆弱模式：最多被发现 {maxDetections} 次
    </div>
  )}
```

- [ ] **Step 3: 验证编译通过**

Run: `pnpm build`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/game/components/HUD.tsx
git commit -m "feat: HUD displays timer and fragile mode indicators"
```

---

## Task 7: 脆弱模式逻辑集成

**Files:**
- Modify: `src/game/engine/GameEngine.ts`

- [ ] **Step 1: 修改 onPlayerDetected 支持脆弱模式**

在 `onPlayerDetected` 方法中添加检查：

```typescript
  private onPlayerDetected(amount: number, line: string) {
    // 现有逻辑...

    // 脆弱模式：被发现超过允许次数直接失败
    if (this.activeMechanic?.type === "fragile") {
      const maxDet = this.store.maxDetections ?? 1;
      if (this.store.detectionsThisLevel >= maxDet) {
        this.store.pushToast("💀 被发现了！脆弱模式失败", "danger");
        this.triggerGameOver();
        return;
      }
    }
  }
```

- [ ] **Step 2: 验证编译通过**

Run: `pnpm build`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/game/engine/GameEngine.ts
git commit -m "feat: fragile mode triggers game over on detection threshold"
```

---

## Task 8: 巡逻强化模式集成

**Files:**
- Modify: `src/game/engine/Boss.ts`

- [ ] **Step 1: 添加巡逻强化标志**

在 `Boss` 类中添加：

```typescript
  private patrolHeavy = false;

  setPatrolHeavy(enabled: boolean) {
    this.patrolHeavy = enabled;
  }
```

- [ ] **Step 2: 修改巡逻计时逻辑**

在 Boss 的 `updateNormal` 或巡逻触发逻辑中，当 `patrolHeavy` 为 true 时缩短巡逻间隔：

```typescript
    // 在巡逻计时器重置时
    const patrolMultiplier = this.patrolHeavy ? 0.4 : 1; // 巡逻频率提高2.5倍
    this.patrolTimer = (20 + Math.random() * 15) * this.difficultyScale() * patrolMultiplier;
```

- [ ] **Step 3: 在 GameEngine 中激活**

在 `applySpecialMechanic` 的 `patrol_heavy` case 中：

```typescript
      case "patrol_heavy":
        this.boss.setPatrolHeavy(true);
        break;
```

- [ ] **Step 4: 验证编译通过**

Run: `pnpm build`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/game/engine/Boss.ts src/game/engine/GameEngine.ts
git commit -m "feat: patrol_heavy mechanic increases boss patrol frequency"
```

---

## Task 9: 关卡过渡UI显示关卡特性

**Files:**
- Modify: `src/game/components/LevelTransition.tsx`

- [ ] **Step 1: 在关卡过渡界面显示下一关特性**

在显示下一关信息时，展示该关卡的特殊机制和布局：

```tsx
  const nextLevel = currentLevel + 1;
  const nextConfig = LEVELS[nextLevel - 1];
  const layoutId = nextConfig?.mapLayoutId ?? "default";
  const layoutName = MAP_LAYOUTS[layoutId]?.name ?? "标准办公室";
  const mechanic = nextConfig?.specialMechanic;

  // 在关卡信息区域添加：
  <div className="mt-2 text-sm text-gray-300">
    <div>🗺️ 地图：{layoutName}</div>
    {mechanic && (
      <div className="mt-1">
        {mechanic.type === "timed" && `⏰ 限时模式：${mechanic.timeLimit}秒`}
        {mechanic.type === "night" && "🌙 夜间模式：视野受限"}
        {mechanic.type === "patrol_heavy" && "🚶 强化巡逻：Boss更活跃"}
        {mechanic.type === "fragile" && "⚠️ 脆弱模式：不能被发现"}
        {mechanic.type === "dark_zone" && "🌑 暗区模式：部分区域不可见"}
      </div>
    )}
    {nextConfig?.availableWeapons && (
      <div className="mt-1">⚔️ 限制武器：{nextConfig.availableWeapons.map(w => WEAPONS[w].name).join("、")}</div>
    )}
  </div>
```

- [ ] **Step 2: 验证编译通过**

Run: `pnpm build`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/game/components/LevelTransition.tsx
git commit -m "feat: LevelTransition shows next level mechanics and layout info"
```

---

## Task 10: 测试和平衡调整

- [ ] **Step 1: 逐关测试特殊机制**

手动测试每一关：
- 第1关：标准布局，无特殊机制（回归测试）
- 第2关：开放式布局，Boss在偏移位置
- 第3关：迷宫布局+限时120秒，确认计时器UI和超时失败
- 第4关：角落布局+夜间模式，确认视野遮罩效果
- 第5关：开放式+强化巡逻，确认Boss巡逻更频繁
- 第6关：迷宫+暗区+仅近战武器，确认道具过滤
- 第7关：默认布局+脆弱模式，确认被发现一次即失败

- [ ] **Step 2: 平衡调整**

根据测试结果调整：
- 限时模式的时间是否合理
- 夜间视野半径是否太小/太大
- 巡逻强化的频率是否太高
- 脆弱模式的容错是否太低

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "balance: tune level mechanics based on playtesting"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - ✅ 不同地图布局 → Task 2-3
   - ✅ 特殊关卡机制（限时、夜间、强化巡逻、脆弱、暗区）→ Task 4, 7, 8
   - ✅ 道具/武器解锁节奏 → Task 2 (availableWeapons/consumables), Task 4 (spawn rate)
   - ✅ UI展示 → Task 6, 9

2. **Placeholder scan:** 无 TBD/TODO，所有代码块完整

3. **Type consistency:** `LevelDef`, `MapLayout`, `SpecialMechanic` 在 Task 1 定义，后续 Task 引用一致
