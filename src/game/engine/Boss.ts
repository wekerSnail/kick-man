import * as THREE from "three";
import type { BossStateName } from "../types";
import { BOSS_LINES, WORLD, HIDING_SPOTS } from "../constants";
import type { Collider } from "./OfficeScene";

export interface BossContext {
  playerPos: THREE.Vector3;
  playerHidden: boolean;
  playerInvisible: boolean;
  playerShield: boolean; // keyboard shield active
  playerShieldUsed: boolean; // already used this detection cycle
  playerObscuredBySmoke: boolean; // smoke blocks line of sight
  isPlayerAttacking: boolean; // for attack-block during meeting
  dt: number;
  time: number;
  colliders: Collider[];
}

export interface BossCallbacks {
  onStateChange: (s: BossStateName) => void;
  onDialogue: (text: string | null, durationMs?: number) => void;
  onDetect: (amount: number, line: string) => void; // damage player
  onAttackBlocked: () => void; // meeting blocks player's weapon swing
  onBossHit?: () => void; // visual feedback when boss takes a hit
}

// helper: canvas texture for sprite
function makeTextTexture(text: string, opts?: {
  bg?: string;
  color?: string;
  fontSize?: number;
  bold?: boolean;
  emoji?: string;
}): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  const fontSize = opts?.fontSize ?? 28;
  const padding = 16;
  const emoji = opts?.emoji ?? "";
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, c.width, c.height);
  // measure
  ctx.font = `${opts?.bold ? "bold " : ""}${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  const lines = text.split("\n");
  // box
  const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const boxW = Math.min(c.width - 20, maxW + 40 + (emoji ? 40 : 0));
  const boxH = lines.length * (fontSize + 6) + 24;
  const bx = (c.width - boxW) / 2;
  const by = (c.height - boxH) / 2;
  // bg
  ctx.fillStyle = opts?.bg ?? "rgba(255,255,255,0.95)";
  ctx.strokeStyle = "rgba(60,60,60,0.9)";
  ctx.lineWidth = 4;
  roundRect(ctx, bx, by, boxW, boxH, 16);
  ctx.fill();
  ctx.stroke();
  // tail
  ctx.beginPath();
  ctx.moveTo(c.width / 2 - 12, by + boxH);
  ctx.lineTo(c.width / 2, by + boxH + 18);
  ctx.lineTo(c.width / 2 + 12, by + boxH);
  ctx.fillStyle = opts?.bg ?? "rgba(255,255,255,0.95)";
  ctx.fill();
  ctx.strokeStyle = "rgba(60,60,60,0.9)";
  ctx.stroke();
  // text
  ctx.fillStyle = opts?.color ?? "#222";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => {
    const tx = c.width / 2 + (emoji ? 16 : 0);
    ctx.fillText(l, tx, by + 16 + i * (fontSize + 6) + fontSize / 2);
  });
  if (emoji) {
    ctx.font = `${fontSize + 4}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(emoji, c.width / 2 - boxW / 2 + 28, c.height / 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function makeEmojiTexture(emoji: string, size = 128): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.font = `${size * 0.7}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, size / 2, size / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

interface Phase {
  t: number; // elapsed in current phase
  dur: number; // phase duration
  name: string;
}

export class Boss {
  group: THREE.Group;
  bodyGroup: THREE.Group; // body that sits/stands (moves up/down)
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;

  homeX = WORLD.bossStart.x;
  homeZ = WORLD.bossStart.z;
  x = WORLD.bossStart.x;
  z = WORLD.bossStart.z;
  facingY = Math.PI; // facing -Z (toward desk/wall) in Normal
  targetFacingY = Math.PI;

  state: BossStateName = "Normal";
  private phase: Phase = { t: 0, dur: 0, name: "" };
  private phaseQueue: { name: string; dur: number }[] = [];

  // internal timers (Normal state)
  private phoneTimer = 6 + Math.random() * 4; // 8~13 → start mid
  private meetingTimer = 12 + Math.random() * 6;
  private patrolTimer = 20 + Math.random() * 10;

  // detection cooldown (after damage)
  private detectCooldown = 0;
  // sitting pose
  private sitting = true;
  private sitBlend = 1; // 1 = sitting, 0 = standing
  // walk anim
  private walkPhase = 0;
  // sway
  private swayPhase = 0;
  // meeting icon / status icon sprite
  private statusSprite: THREE.Sprite;
  private dialogueSprite: THREE.Sprite;
  private dialogueTimer = 0;
  private starsSprite: THREE.Sprite;
  // patrol waypoints
  private patrolRoute: THREE.Vector3[] = [];
  private patrolIdx = 0;
  private stuckTimer = 0;
  private lastPos = new THREE.Vector3();
  private patrolDirection = 1; // 1 forward, -1 back

  // ===== Boss variant system =====
  // variant determines appearance + detection modifiers
  variant: "normal" | "glasses" | "coffee" | "headphones" | "rage" = "normal";
  // detection range multipliers (set by variant)
  private halfRangeBase = 5;
  private lookRangeBase = 6;
  private patrolRangeBase = 7;
  private noiseImmune = false;
  // accessories group (rebuildable)
  private accessories: THREE.Group = new THREE.Group();
  // facial feature references (for state-based expressions)
  private eyeL?: THREE.Mesh;
  private eyeR?: THREE.Mesh;
  private mouth?: THREE.Mesh;
  private browL?: THREE.Mesh;
  private browR?: THREE.Mesh;
  // blink animation timer (eyes briefly close)
  private blinkTimer = 2 + Math.random() * 3; // seconds until next blink
  private blinkProgress = 0; // 0..1 (1 = fully closed), 0 = no blink
  // mouth animation (talking / expressions)
  private mouthAnimPhase = 0;
  // base scales set by updateFacialExpression (blink/mouth anim multiply on top)
  private eyeBaseScaleY = 1;
  private mouthBaseScaleY = 1;
  // suspicion meter (0..1) — rises with nearby kicks, decays over time
  suspicion = 0;
  private suspicionDecayPerSec = 0.08;

  // ===== Boss HP system (multi-phase) =====
  // Boss needs N hits to "stagger" (enter a longer Stunned phase), then HP resets.
  // HP scales with level: 1-2 → 1, 3-4 → 2, 5-6 → 3, 7 → 4
  bossHP = 1;
  bossMaxHP = 1;
  // rage mode (level 7): periodic enrage with full-map detection
  private enraged = false;
  private enrageTimer = 0; // counts down; when 0, toggles enrage
  // HP bar 3D meshes
  private bossHpBar: THREE.Mesh;
  private bossHpBarBg: THREE.Mesh;

  // distracted target
  private distractTarget: THREE.Vector3 | null = null;

  // stunned remaining
  private stunRemaining = 0;

  private cb: BossCallbacks;

  // facing forward vector
  get forward(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.facingY), 0, Math.cos(this.facingY));
  }

  // expose current phase name for minimap/visual logic
  get phaseName(): string {
    return this.phase.name;
  }

  constructor(cb: BossCallbacks) {
    this.cb = cb;
    this.group = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    this.head = new THREE.Group();
    this.leftArm = new THREE.Group();
    this.rightArm = new THREE.Group();
    this.leftLeg = new THREE.Group();
    this.rightLeg = new THREE.Group();
    this.buildModel();
    this.group.position.set(this.x, 0, this.z);

    // status icon sprite
    const statusMat = new THREE.SpriteMaterial({
      map: makeEmojiTexture(""),
      transparent: true,
      depthTest: false,
    });
    this.statusSprite = new THREE.Sprite(statusMat);
    this.statusSprite.position.set(0, 2.8, 0);
    this.statusSprite.scale.set(0.7, 0.7, 1);
    this.statusSprite.visible = false;
    this.group.add(this.statusSprite);

    // stars sprite
    const starsMat = new THREE.SpriteMaterial({
      map: makeEmojiTexture("💫"),
      transparent: true,
      depthTest: false,
    });
    this.starsSprite = new THREE.Sprite(starsMat);
    this.starsSprite.position.set(0, 2.6, 0);
    this.starsSprite.scale.set(0.8, 0.8, 1);
    this.starsSprite.visible = false;
    this.group.add(this.starsSprite);

    // dialogue sprite
    const dMat = new THREE.SpriteMaterial({
      map: makeTextTexture(" "),
      transparent: true,
      depthTest: false,
    });
    this.dialogueSprite = new THREE.Sprite(dMat);
    this.dialogueSprite.position.set(0, 3.4, 0);
    this.dialogueSprite.scale.set(3, 1.5, 1);
    this.dialogueSprite.visible = false;
    this.group.add(this.dialogueSprite);

    // ===== Boss HP bar (visible when bossMaxHP > 1) =====
    const hpBgGeo = new THREE.PlaneGeometry(1.4, 0.16);
    const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.7, depthTest: false });
    this.bossHpBarBg = new THREE.Mesh(hpBgGeo, hpBgMat);
    this.bossHpBarBg.position.set(0, 2.9, 0);
    this.bossHpBarBg.renderOrder = 999;
    this.bossHpBarBg.visible = false;
    this.group.add(this.bossHpBarBg);
    const hpGeo = new THREE.PlaneGeometry(1.3, 0.12);
    const hpMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.95, depthTest: false });
    this.bossHpBar = new THREE.Mesh(hpGeo, hpMat);
    this.bossHpBar.position.set(0, 2.9, 0.01);
    this.bossHpBar.renderOrder = 1000;
    this.bossHpBar.visible = false;
    this.group.add(this.bossHpBar);

    // ===== Vision cone visualization =====
    // A semi-transparent cone on the ground showing the boss's current
    // detection range & direction. Color shifts: yellow (idle/normal),
    // orange (looking back/attacked observe), red (patrol cone).
    this.buildVisionCone();
  }

  // Vision cone (half-circle for Normal/LookingBack/Attacked, narrow cone for Patrol)
  private visionPatrolCone: THREE.Mesh;
  private visionHalfCircle: THREE.Mesh;
  private buildVisionCone() {
    // Half-circle (radius 5/6) facing +Z (awareness side), laid flat on ground
    // Use a CircleGeometry and mask to half via vertex alpha? Simpler: use a
    // half-disc custom geometry (triangle fan from -90° to +90°).
    const makeHalfDisc = (radius: number, color: number, opacity: number) => {
      const segments = 24;
      const geo = new THREE.BufferGeometry();
      const verts: number[] = [0, 0.02, 0];
      const indices: number[] = [];
      // half disc from -90° to +90° (facing +Z = +z direction)
      for (let i = 0; i <= segments; i++) {
        const ang = -Math.PI / 2 + (i / segments) * Math.PI;
        verts.push(Math.sin(ang) * radius, 0.02, Math.cos(ang) * radius);
      }
      for (let i = 0; i < segments; i++) {
        indices.push(0, i + 1, i + 2);
      }
      geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = 0; // already flat (y=0.02)
      m.renderOrder = 5;
      return m;
    };
    // half circle radius 6 (max of looking range), color yellow, opacity low
    this.visionHalfCircle = makeHalfDisc(6, 0xfbbf24, 0.12);
    this.visionHalfCircle.visible = false;
    this.group.add(this.visionHalfCircle);

    // Patrol cone: 80° cone radius 7, red
    const makeCone = (radius: number, angleDeg: number, color: number, opacity: number) => {
      const segments = 24;
      const half = (angleDeg * Math.PI) / 180 / 2;
      const geo = new THREE.BufferGeometry();
      const verts: number[] = [0, 0.02, 0];
      const indices: number[] = [];
      for (let i = 0; i <= segments; i++) {
        const ang = -half + (i / segments) * (half * 2);
        verts.push(Math.sin(ang) * radius, 0.02, Math.cos(ang) * radius);
      }
      for (let i = 0; i < segments; i++) {
        indices.push(0, i + 1, i + 2);
      }
      geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = 5;
      return m;
    };
    this.visionPatrolCone = makeCone(7, 80, 0xef4444, 0.2);
    this.visionPatrolCone.visible = false;
    this.group.add(this.visionPatrolCone);
  }

  private updateVisionCone() {
    // Default: hide all
    this.visionHalfCircle.visible = false;
    this.visionPatrolCone.visible = false;
    // Half-circle faces +Z in local space (awareness hemisphere).
    // Boss local +Z is the player-area side. But boss rotates with this.group.rotation.y = this.facingY.
    // We want the cone to point in the "awareness" direction = opposite of facing.
    // The half-disc visual shows the boss's FRONT detection hemisphere (where boss faces).
    // Detection is always in front (halfCircleDetect/lookingDetect/attackedDetect all use front dot check).
    // So the visual should always face the same direction as the boss's forward = facingY.
    this.visionHalfCircle.rotation.y = this.facingY;
    this.visionPatrolCone.rotation.y = this.facingY; // patrol cone faces forward (where boss looks)

    switch (this.state) {
      case "Normal":
        // dim half-circle awareness (player can sneak up from behind/sides)
        this.visionHalfCircle.visible = true;
        (this.visionHalfCircle.material as THREE.MeshBasicMaterial).color.setHex(0xfbbf24);
        (this.visionHalfCircle.material as THREE.MeshBasicMaterial).opacity = 0.10;
        break;
      case "LookingBack":
        // during observe phase, show brighter half-circle
        if (this.phase.name === "observe") {
          this.visionHalfCircle.visible = true;
          (this.visionHalfCircle.material as THREE.MeshBasicMaterial).color.setHex(0xf97316);
          (this.visionHalfCircle.material as THREE.MeshBasicMaterial).opacity = 0.22;
        }
        break;
      case "Attacked":
        if (this.phase.name === "a_observe") {
          this.visionHalfCircle.visible = true;
          (this.visionHalfCircle.material as THREE.MeshBasicMaterial).color.setHex(0xef4444);
          (this.visionHalfCircle.material as THREE.MeshBasicMaterial).opacity = 0.25;
        }
        break;
      case "Patrol":
        // red cone in front
        if (this.phase.name === "p_patrol" || this.phase.name === "p_return") {
          this.visionPatrolCone.visible = true;
        }
        break;
      case "PhoneFlashing":
      case "Meeting":
      case "Stunned":
      case "Distracted":
        // no active detection vision
        break;
    }
  }

  private mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.05,
      flatShading: true,
      ...opts,
    });
  }

  private buildModel() {
    // Boss: low-poly humanoid in business suit
    const suitMat = this.mat(0x2a3a5a); // navy suit
    const shirtMat = this.mat(0xf0f0f0);
    const skinMat = this.mat(0xf2c9a0);
    const hairMat = this.mat(0x2a1a0a);
    const shoeMat = this.mat(0x1a1a1a);

    // pelvis / torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), suitMat);
    torso.position.y = 1.25;
    torso.castShadow = true;
    this.bodyGroup.add(torso);

    // belly (slightly bigger boss)
    const belly = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.42), suitMat);
    belly.position.y = 0.85;
    this.bodyGroup.add(belly);

    // shirt collar / tie
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.02), this.mat(0xcc2222));
    tie.position.set(0, 1.3, 0.21);
    this.bodyGroup.add(tie);

    // head
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 0.42), skinMat);
    headMesh.position.y = 1.95;
    headMesh.castShadow = true;
    this.head.add(headMesh);
    // hair
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.46), hairMat);
    hair.position.y = 2.18;
    this.head.add(hair);
    // eyes (white base + dark pupil) — references kept for state-based expression changes
    const eyeWhiteMat = this.mat(0xffffff);
    const eyePupilMat = this.mat(0x111111, { emissive: 0x222222 });
    for (const sx of [-0.1, 0.1]) {
      // white sclera
      const sclera = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.015), eyeWhiteMat);
      sclera.position.set(sx, 1.98, 0.215);
      this.head.add(sclera);
      // pupil (we keep this reference for animation)
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.012), eyePupilMat);
      pupil.position.set(sx, 1.98, 0.225);
      this.head.add(pupil);
      if (sx < 0) this.eyeL = pupil;
      else this.eyeR = pupil;
    }
    // eyebrows (references kept for animation)
    const browMat = this.mat(0x3a2a1a);
    for (const sx of [-0.1, 0.1]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.015), browMat);
      brow.position.set(sx, 2.06, 0.22);
      this.head.add(brow);
      if (sx < 0) this.browL = brow;
      else this.browR = brow;
    }
    // mouth (references kept for animation)
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.02), this.mat(0x6a3a2a));
    mouth.position.set(0, 1.82, 0.22);
    this.head.add(mouth);
    this.mouth = mouth;
    this.head.position.y = 0;
    this.bodyGroup.add(this.head);

    // arms
    for (const [name, sx] of [["L", -1], ["R", 1]] as const) {
      const armGroup = new THREE.Group();
      armGroup.position.set(sx * 0.45, 1.6, 0);
      const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.2), suitMat);
      upperArm.position.y = -0.25;
      upperArm.castShadow = true;
      armGroup.add(upperArm);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.18), skinMat);
      hand.position.y = -0.55;
      armGroup.add(hand);
      if (name === "L") {
        this.leftArm = armGroup;
      } else {
        this.rightArm = armGroup;
      }
      this.bodyGroup.add(armGroup);
    }

    // legs
    for (const [name, sx] of [["L", -1], ["R", 1]] as const) {
      const legGroup = new THREE.Group();
      legGroup.position.set(sx * 0.18, 0.6, 0);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.24), suitMat);
      thigh.position.y = -0.25;
      thigh.castShadow = true;
      legGroup.add(thigh);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.22), suitMat);
      shin.position.y = -0.7;
      legGroup.add(shin);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.34), shoeMat);
      shoe.position.set(0, -0.95, 0.05);
      legGroup.add(shoe);
      if (name === "L") this.leftLeg = legGroup;
      else this.rightLeg = legGroup;
      this.bodyGroup.add(legGroup);
    }

    // NOTE: chair is rendered by OfficeScene (fixed at home position) so it
    // doesn't move with the boss during patrol/distracted.

    // bodyGroup default: sitting pose
    this.bodyGroup.position.y = 0;
    this.group.add(this.bodyGroup);
    this.applySittingPose(1);

    // accessories group (added to bodyGroup so it moves with sitting/standing)
    this.bodyGroup.add(this.accessories);
  }

  // ===== Variant system =====
  // Set boss variant: changes appearance + detection modifiers.
  // - normal: baseline
  // - glasses: +50% half-circle & look range (boss sees further)
  // - coffee: +30% patrol frequency (more alert, shorter timers)
  // - headphones: noise-immune (noise item has no effect)
  // - rage: periodic enrage with full-map detection (level 7)
  setVariant(v: "normal" | "glasses" | "coffee" | "headphones" | "rage") {
    this.variant = v;
    switch (v) {
      case "glasses":
        this.halfRangeBase = 7;
        this.lookRangeBase = 8;
        this.patrolRangeBase = 8;
        this.noiseImmune = false;
        break;
      case "coffee":
        this.halfRangeBase = 5;
        this.lookRangeBase = 6;
        this.patrolRangeBase = 7;
        this.noiseImmune = false;
        // coffee makes boss more alert → timers even shorter (handled in difficultyScale via extra factor)
        break;
      case "headphones":
        this.halfRangeBase = 5;
        this.lookRangeBase = 6;
        this.patrolRangeBase = 7;
        this.noiseImmune = true;
        break;
      case "rage":
        // rage: baseline ranges, but enrage mode periodically grants full-map detection
        this.halfRangeBase = 5;
        this.lookRangeBase = 6;
        this.patrolRangeBase = 7;
        this.noiseImmune = false;
        this.enrageTimer = 12; // first enrage after 12s
        break;
      default:
        this.halfRangeBase = 5;
        this.lookRangeBase = 6;
        this.patrolRangeBase = 7;
        this.noiseImmune = false;
    }
    this.rebuildAccessories();
  }

  private rebuildAccessories() {
    // clear existing
    while (this.accessories.children.length) {
      const c = this.accessories.children[0];
      this.accessories.remove(c);
      if (c instanceof THREE.Mesh) {
        c.geometry.dispose();
        (c.material as THREE.Material).dispose();
      }
    }
    if (this.variant === "glasses") {
      // thick black frame glasses — enlarged for visibility (1.6x)
      const frameMat = this.mat(0x111111);
      const lensW = 0.26;
      const lensH = 0.2;
      const lensD = 0.05;
      for (const sx of [-0.2, 0.2]) {
        // frame ring (slightly larger box)
        const lens = new THREE.Mesh(new THREE.BoxGeometry(lensW, lensH, lensD), frameMat);
        lens.position.set(sx, 1.98, 0.22);
        this.accessories.add(lens);
        // glass (translucent cyan)
        const glass = new THREE.Mesh(
          new THREE.BoxGeometry(lensW * 0.75, lensH * 0.75, lensD * 0.4),
          new THREE.MeshBasicMaterial({
            color: 0x88eeff,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
          })
        );
        glass.position.set(sx, 1.98, 0.245);
        this.accessories.add(glass);
        // shine glint (small white box) on upper-right of each lens
        const glint = new THREE.Mesh(
          new THREE.BoxGeometry(lensW * 0.2, lensH * 0.15, 0.01),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
        );
        glint.position.set(sx + 0.05, 2.04, 0.255);
        glint.userData.isGlint = true;
        this.accessories.add(glint);
      }
      // bridge
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.04), frameMat);
      bridge.position.set(0, 1.98, 0.24);
      this.accessories.add(bridge);
      // temple arms (longer, extend back along head)
      for (const sx of [-0.32, 0.32]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.28), frameMat);
        arm.position.set(sx, 1.98, 0.08);
        this.accessories.add(arm);
      }
    } else if (this.variant === "coffee") {
      // coffee mug in right hand — enlarged
      const mugMat = this.mat(0xeeeeee);
      const mugRadius = 0.11;
      const mugHeight = 0.18;
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(mugRadius, mugRadius * 0.9, mugHeight, 12), mugMat);
      mug.position.set(0.55, 1.1, 0.15);
      this.accessories.add(mug);
      // handle (torus, larger)
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.022, 8, 12, Math.PI), mugMat);
      handle.position.set(0.66, 1.1, 0.15);
      handle.rotation.y = Math.PI / 2;
      this.accessories.add(handle);
      // coffee (dark liquid)
      const coffee = new THREE.Mesh(
        new THREE.CylinderGeometry(mugRadius * 0.9, mugRadius * 0.9, 0.025, 12),
        this.mat(0x3a1a0a)
      );
      coffee.position.set(0.55, 1.19, 0.15);
      this.accessories.add(coffee);
      // steam particles (slightly larger, animated)
      for (let i = 0; i < 5; i++) {
        const steam = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 6, 4),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })
        );
        steam.position.set(0.55 + (i - 2) * 0.05, 1.32 + i * 0.07, 0.15 + ((i % 2) - 0.5) * 0.05);
        steam.userData.isSteam = true;
        steam.userData.steamBase = 1.32 + i * 0.07;
        steam.userData.steamIdx = i;
        this.accessories.add(steam);
      }
      // a small " aroma" indicator (three short vertical lines, like rising smell)
      const aromaMat = new THREE.MeshBasicMaterial({ color: 0xffcc88, transparent: true, opacity: 0.4 });
      for (let i = 0; i < 3; i++) {
        const wisp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.02), aromaMat);
        wisp.position.set(0.55 + (i - 1) * 0.07, 1.55, 0.15);
        wisp.userData.isAroma = true;
        this.accessories.add(wisp);
      }
    } else if (this.variant === "headphones") {
      // over-ear headphones — enlarged cups, brighter accent
      const hpMat = this.mat(0x222222);
      const accentMat = this.mat(0xff66cc, { emissive: 0x661133, emissiveIntensity: 0.5 });
      // headband (larger radius, thicker)
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 16, Math.PI), hpMat);
      band.position.set(0, 2.18, 0);
      band.rotation.x = Math.PI / 2;
      this.accessories.add(band);
      // band cushion (top)
      const cushion = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.04, 0.18),
        this.mat(0x111111)
      );
      cushion.position.set(0, 2.4, 0);
      this.accessories.add(cushion);
      // ear cups (larger)
      for (const sx of [-0.28, 0.28]) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 16), hpMat);
        cup.position.set(sx, 1.95, 0);
        cup.rotation.z = Math.PI / 2;
        this.accessories.add(cup);
        // outer accent ring (visible "music" indicator)
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.1, 0.012, 8, 16),
          accentMat
        );
        ring.position.set(sx + (sx > 0 ? 0.051 : -0.051), 1.95, 0);
        ring.rotation.y = Math.PI / 2;
        ring.userData.isHpRing = true;
        this.accessories.add(ring);
        // cushion (inner, against ear)
        const cush = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16),
          this.mat(0x111111)
        );
        cush.position.set(sx + (sx > 0 ? -0.04 : 0.04), 1.95, 0);
        cush.rotation.z = Math.PI / 2;
        this.accessories.add(cush);
      }
      // floating music note sprite (above head, animated)
      const note = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.8 })
      );
      note.position.set(0.2, 2.55, 0.15);
      note.userData.isMusicNote = true;
      this.accessories.add(note);
    } else if (this.variant === "rage") {
      // rage: red angry crown + glowing aura ring on ground — all enlarged
      const crownMat = this.mat(0xdc2626, { emissive: 0xaa1111, emissiveIntensity: 0.8 });
      // crown: 3 cones for spiked crown look
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.1, 0.3, 4),
          crownMat
        );
        const angle = (i / 5) * Math.PI - Math.PI / 2;
        spike.position.set(Math.cos(angle) * 0.18, 2.45, Math.sin(angle) * 0.18);
        this.accessories.add(spike);
      }
      // crown band (torus base)
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.05, 6, 16),
        crownMat
      );
      band.position.set(0, 2.3, 0);
      band.rotation.x = Math.PI / 2;
      this.accessories.add(band);
      // anger mark (red sphere above head, larger) with pulsing
      const anger = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xff3333 })
      );
      anger.position.set(0.18, 2.65, 0.2);
      anger.userData.isAnger = true;
      this.accessories.add(anger);
      // cross-vein marks (small red boxes for anime-style anger veins)
      const veinMat = new THREE.MeshBasicMaterial({ color: 0xff5555 });
      for (let i = 0; i < 4; i++) {
        const vein = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.04), veinMat);
        vein.position.set(-0.18 + i * 0.12, 2.65, 0.2);
        vein.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.4;
        vein.userData.isVein = true;
        this.accessories.add(vein);
      }
      // ground aura ring (larger, more dramatic)
      const aura = new THREE.Mesh(
        new THREE.RingGeometry(0.8, 1.2, 32),
        new THREE.MeshBasicMaterial({
          color: 0xff3333,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      aura.rotation.x = -Math.PI / 2;
      aura.position.y = 0.04;
      aura.userData.isAura = true;
      this.accessories.add(aura);
      // outer aura ring (subtle, larger)
      const aura2 = new THREE.Mesh(
        new THREE.RingGeometry(1.3, 1.6, 32),
        new THREE.MeshBasicMaterial({
          color: 0xff6633,
          transparent: true,
          opacity: 0.25,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      aura2.rotation.x = -Math.PI / 2;
      aura2.position.y = 0.045;
      aura2.userData.isAuraOuter = true;
      this.accessories.add(aura2);
    }
  }

  private applySittingPose(blend: number) {
    // blend 1 = sitting, 0 = standing
    // sitting: body lowered, legs bent forward, arms on lap
    const standY = 0;
    const sitY = -0.15;
    this.bodyGroup.position.y = THREE.MathUtils.lerp(standY, sitY, blend);
    // legs: rotate forward when sitting
    const legRot = THREE.MathUtils.lerp(0, -1.2, blend);
    this.leftLeg.rotation.x = legRot;
    this.rightLeg.rotation.x = legRot;
    // arms: rest on lap when sitting
    const armRot = THREE.MathUtils.lerp(0, -0.5, blend);
    this.leftArm.rotation.x = armRot;
    this.rightArm.rotation.x = armRot;
  }

  // ===== State transitions =====
  private setState(s: BossStateName) {
    if (this.state === s) return;
    this.state = s;
    this.phase = { t: 0, dur: 0, name: "" };
    this.phaseQueue = [];
    this.cb.onStateChange(s);
    // hide status icon by default per-state
    if (s === "Normal") {
      this.statusSprite.visible = false;
      this.starsSprite.visible = false;
    } else if (s === "Stunned") {
      this.starsSprite.visible = true;
      this.statusSprite.visible = false;
    } else if (s === "Meeting") {
      this.setStatusEmoji("📅");
    } else if (s === "PhoneFlashing") {
      this.setStatusEmoji("📱");
    } else if (s === "Patrol") {
      // warning icon handled in phase
    }
    // update facial expression for new state
    this.updateFacialExpression(s);
  }

  // Update boss facial expression based on state.
  // Eyes/mouth/brows change shape & color to convey emotion.
  private updateFacialExpression(state: BossStateName) {
    if (!this.eyeL || !this.eyeR || !this.mouth || !this.browL || !this.browR) return;
    // default shapes
    let eyeScale = new THREE.Vector3(1, 1, 1);
    let eyeColor = 0x111111;
    let mouthScale = new THREE.Vector3(1, 1, 1);
    let mouthColor = 0x6a3a2a;
    let browRotL = 0;
    let browRotR = 0;
    let browY = 2.06;

    switch (state) {
      case "Normal":
        // neutral, half-closed eyes (relaxed)
        eyeScale = new THREE.Vector3(1, 0.6, 1);
        mouthScale = new THREE.Vector3(1, 1, 1);
        browY = 2.07;
        break;
      case "PhoneFlashing":
        // wide eyes, small "o" mouth (surprised)
        eyeScale = new THREE.Vector3(1.1, 1.3, 1);
        eyeColor = 0x222222;
        mouthScale = new THREE.Vector3(0.4, 1.5, 1);
        mouthColor = 0x4a2a1a;
        browY = 2.1;
        break;
      case "LookingBack":
        // narrowed suspicious eyes (squinting), mouth slight frown
        eyeScale = new THREE.Vector3(1.2, 0.4, 1);
        mouthScale = new THREE.Vector3(1.2, 1, 1);
        mouthColor = 0x5a2a1a;
        browRotL = -0.3; // inner down (suspicious)
        browRotR = 0.3;
        browY = 2.04;
        break;
      case "Attacked":
        // angry eyes, open mouth (shouting)
        eyeScale = new THREE.Vector3(1, 1.2, 1);
        eyeColor = 0xaa1111; // red angry eyes
        mouthScale = new THREE.Vector3(0.6, 2, 1);
        mouthColor = 0x3a1a0a;
        browRotL = 0.4; // inner down (angry)
        browRotR = -0.4;
        browY = 2.02;
        break;
      case "Meeting":
        // focused eyes, neutral mouth
        eyeScale = new THREE.Vector3(0.9, 1, 1);
        mouthScale = new THREE.Vector3(0.8, 1, 1);
        browY = 2.05;
        break;
      case "Patrol":
        // alert eyes, slight frown
        eyeScale = new THREE.Vector3(1.1, 0.9, 1);
        eyeColor = 0x331111;
        mouthScale = new THREE.Vector3(1.1, 1, 1);
        mouthColor = 0x5a2a1a;
        browRotL = -0.15;
        browRotR = 0.15;
        browY = 2.05;
        break;
      case "Stunned":
        // X eyes (dizzy), wavy mouth
        eyeScale = new THREE.Vector3(1, 1, 1);
        eyeColor = 0x6644aa; // purple dizzy
        mouthScale = new THREE.Vector3(1.3, 0.5, 1);
        mouthColor = 0x4a2a3a;
        browRotL = 0.3;
        browRotR = -0.3;
        browY = 2.08;
        break;
      case "Distracted":
        // confused eyes, tilted
        eyeScale = new THREE.Vector3(0.9, 1.1, 1);
        eyeColor = 0x222266;
        mouthScale = new THREE.Vector3(0.7, 0.8, 1);
        browRotL = 0.2;
        browRotR = 0.2;
        browY = 2.08;
        break;
    }

    this.eyeL.scale.copy(eyeScale);
    this.eyeR.scale.copy(eyeScale);
    this.eyeBaseScaleY = eyeScale.y;
    (this.eyeL.material as THREE.MeshStandardMaterial).color.setHex(eyeColor);
    (this.eyeR.material as THREE.MeshStandardMaterial).color.setHex(eyeColor);
    if (state === "Stunned") {
      // emissive purple for X eyes effect
      (this.eyeL.material as THREE.MeshStandardMaterial).emissive.setHex(0x331166);
      (this.eyeR.material as THREE.MeshStandardMaterial).emissive.setHex(0x331166);
    } else if (state === "Attacked") {
      (this.eyeL.material as THREE.MeshStandardMaterial).emissive.setHex(0x660000);
      (this.eyeR.material as THREE.MeshStandardMaterial).emissive.setHex(0x660000);
    } else {
      (this.eyeL.material as THREE.MeshStandardMaterial).emissive.setHex(0x222222);
      (this.eyeR.material as THREE.MeshStandardMaterial).emissive.setHex(0x222222);
    }
    this.mouth.scale.copy(mouthScale);
    this.mouthBaseScaleY = mouthScale.y;
    (this.mouth.material as THREE.MeshStandardMaterial).color.setHex(mouthColor);
    this.browL.rotation.z = browRotL;
    this.browR.rotation.z = browRotR;
    this.browL.position.y = browY;
    this.browR.position.y = browY;
  }

  // Apply blink animation on top of the base eye scale.
  // Blink briefly squashes eye Y scale to 0.1.
  private applyBlinkToEyes() {
    if (!this.eyeL || !this.eyeR) return;
    // skip blink visual for Stunned (X eyes) — they look "closed" already
    if (this.state === "Stunned") return;
    let blinkFactor = 1;
    if (this.blinkProgress > 0) {
      // blinkProgress 0→0.4 close, 0.4→0.6 hold, 0.6→1 open
      const p = this.blinkProgress;
      if (p < 0.4) blinkFactor = 1 - (p / 0.4) * 0.9; // 1 → 0.1
      else if (p < 0.6) blinkFactor = 0.1; // hold closed
      else blinkFactor = 0.1 + ((p - 0.6) / 0.4) * 0.9; // 0.1 → 1
    }
    this.eyeL.scale.y = this.eyeBaseScaleY * blinkFactor;
    this.eyeR.scale.y = this.eyeBaseScaleY * blinkFactor;
  }

  // Apply mouth animation on top of base mouth scale.
  // PhoneFlashing: talking (open/close rhythmically ~5Hz)
  // Attacked: shouting (wide open, slight pulsing)
  // Meeting: occasional muttering (slow small open)
  private applyMouthAnim(dt: number) {
    if (!this.mouth) return;
    let mouthY = this.mouthBaseScaleY;
    let mouthX = 1;
    if (this.state === "PhoneFlashing") {
      // talking: rapid open/close
      const talk = Math.abs(Math.sin(this.mouthAnimPhase * 18));
      mouthY = this.mouthBaseScaleY * (1 + talk * 2.5);
      mouthX = 0.7 + talk * 0.3;
    } else if (this.state === "Attacked") {
      // shouting: held open with slight pulse
      const pulse = Math.sin(this.mouthAnimPhase * 12) * 0.15;
      mouthY = this.mouthBaseScaleY * (1 + pulse);
    } else if (this.state === "Meeting") {
      // muttering: slow small mouth movement
      const mutter = Math.abs(Math.sin(this.mouthAnimPhase * 4));
      mouthY = this.mouthBaseScaleY * (1 + mutter * 0.5);
    } else if (this.state === "Patrol") {
      // breathing through mouth: slow subtle
      const breath = Math.sin(this.mouthAnimPhase * 2);
      mouthY = this.mouthBaseScaleY * (1 + breath * 0.1);
    }
    this.mouth.scale.y = mouthY;
    this.mouth.scale.x = mouthX;
  }

  private setStatusEmoji(emoji: string) {
    const mat = this.statusSprite.material as THREE.SpriteMaterial;
    if (mat.map) mat.map.dispose();
    mat.map = makeEmojiTexture(emoji);
    mat.needsUpdate = true;
    this.statusSprite.visible = true;
  }

  showDialogue(text: string, durationMs = 2000) {
    const mat = this.dialogueSprite.material as THREE.SpriteMaterial;
    if (mat.map) mat.map.dispose();
    mat.map = makeTextTexture(text, { fontSize: 26 });
    mat.needsUpdate = true;
    this.dialogueSprite.visible = true;
    this.dialogueSprite.scale.set(3, 1.5, 1);
    this.dialogueTimer = durationMs / 1000;
    this.cb.onDialogue(text, durationMs);
  }

  hideDialogue() {
    this.dialogueSprite.visible = false;
    this.dialogueTimer = 0;
    this.cb.onDialogue(null);
  }

  // ===== Public triggers =====
  triggerAttacked(
    weaponHits: number,
    stunTime: number,
    ctx: BossContext
  ) {
    // If meeting → block + consume weapon
    if (this.state === "Meeting") {
      this.showDialogue("开会呢！别闹！", 1500);
      this.cb.onAttackBlocked();
      return false; // blocked
    }
    // If stunned → ignore (already stunned)
    if (this.state === "Stunned") {
      return false;
    }
    // If throwable hit (stunTime > 0) → stunned directly
    if (stunTime > 0) {
      this.stunRemaining = stunTime;
      this.setState("Stunned");
      this.showDialogue("啊——！", 1200);
      this.cb.onBossHit?.();
      return true;
    }
    // HP system: deduct HP per hit. If HP reaches 0 → longer stagger stun.
    if (this.bossMaxHP > 1) {
      this.bossHP -= 1;
      if (this.bossHP <= 0) {
        // staggered! longer stun (3s), reset HP
        this.stunRemaining = 3;
        this.setState("Stunned");
        this.showDialogue("你…给我等着！", 2000);
        this.bossHP = this.bossMaxHP;
        this.suspicion = Math.min(1, this.suspicion + 0.5);
        this.cb.onBossHit?.();
        return true;
      }
    }
    // Otherwise → Attacked state (swing hit)
    if (this.state !== "Attacked") {
      this.setState("Attacked");
      this.startAttackedSequence(ctx);
    }
    // being hit raises suspicion (lingering awareness after Attacked resolves)
    this.suspicion = Math.min(1, this.suspicion + 0.3);
    this.cb.onBossHit?.();
    return true;
  }

  triggerDistracted(noisePos: THREE.Vector3) {
    if (this.state === "Stunned" || this.state === "Meeting") return;
    // headphones variant is immune to noise
    if (this.noiseImmune) return;
    this.distractTarget = noisePos.clone();
    this.setState("Distracted");
    this.startDistractSequence();
  }

  // ===== Phase helpers =====
  private startSequence(steps: { name: string; dur: number }[]) {
    this.phaseQueue = steps.slice();
    this.phase = { ...this.phaseQueue.shift()!, t: 0 };
  }

  private advancePhase() {
    if (this.phaseQueue.length > 0) {
      this.phase = { ...this.phaseQueue.shift()!, t: 0 };
    } else {
      this.phase = { t: 0, dur: 0, name: "done" };
    }
  }

  private startLookingBackSequence() {
    // stand(0.5) → turn(0.6) → observe(2) → dialogue(2) → turn back(0.6) → sit(0.5)
    this.startSequence([
      { name: "stand", dur: 0.5 },
      { name: "turn", dur: 0.6 },
      { name: "observe", dur: 2 },
      { name: "dialogue", dur: 2 },
      { name: "turnback", dur: 0.6 },
      { name: "sit", dur: 0.5 },
    ]);
  }

  private startAttackedSequence(_ctx: BossContext) {
    // dialogue(1.5) → turn(0.6) → observe(2) → conclusion(2.5) → turnback(0.6)
    this.showDialogue(BOSS_LINES.attackedWho, 1500);
    this.startSequence([
      { name: "a_who", dur: 1.5 },
      { name: "a_turn", dur: 0.6 },
      { name: "a_observe", dur: 2 },
      { name: "a_conclude", dur: 2.5 },
      { name: "a_turnback", dur: 0.6 },
    ]);
  }

  private startPatrolSequence() {
    // warn(2.5) → stand(0.6) → patrol → return → sit(0.6)
    this.setStatusEmoji("⚠️");
    this.showDialogue(BOSS_LINES.patrolWarn, 2000);
    this.generatePatrolRoute();
    this.patrolIdx = 0;
    this.patrolDirection = 1;
    this.startSequence([
      { name: "p_warn", dur: 2.5 },
      { name: "p_stand", dur: 0.6 },
      { name: "p_patrol", dur: 8 },
      { name: "p_return", dur: 4 },
      { name: "p_sit", dur: 0.6 },
    ]);
  }

  private startDistractSequence() {
    this.setStatusEmoji("❓");
    this.showDialogue(BOSS_LINES.distracted, 1200);
    this.startSequence([
      { name: "d_react", dur: 0.8 },
      { name: "d_walk", dur: 2 },
      { name: "d_look", dur: 1.5 },
      { name: "d_return", dur: 2 },
    ]);
  }

  // Candidate patrol waypoints scattered around the expanded office room (24x24).
  // Boss randomly picks a subset to visit, then returns home.
  private static PATROL_WAYPOINTS: { x: number; z: number }[] = [
    { x: -6, z: -3 },    // left-back (near plant)
    { x: -6, z: 4 },     // left-front (near cubicle desk)
    { x: 6, z: 5 },      // right-front (near second cubicle)
    { x: 6, z: -2 },     // right-back (near coffee table)
    { x: -9, z: 0 },     // far left (cabinets / sofa)
    { x: 9, z: 3 },      // far right (sofa2)
    { x: 0, z: 4 },      // center-front
    { x: -3, z: 9 },     // front-left (water cooler area)
    { x: 3, z: 9 },      // front-right
    { x: -8, z: -6 },    // back-left corner
    { x: 8, z: -6 },     // back-right corner
    { x: 0, z: 0 },      // center
    { x: -10, z: 6 },    // far front-left
    { x: 10, z: -4 },    // far back-right
  ];

  private generatePatrolRoute() {
    // Randomly pick 3-5 waypoints from the candidate list (no repeats),
    // then append home to return.
    const pool = [...Boss.PATROL_WAYPOINTS];
    const numStops = 3 + Math.floor(Math.random() * 3); // 3..5 stops
    const stops: THREE.Vector3[] = [];
    for (let i = 0; i < numStops && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const wp = pool.splice(idx, 1)[0];
      stops.push(new THREE.Vector3(wp.x, 0, wp.z));
    }
    // route: home → stops... → home
    this.patrolRoute = [
      new THREE.Vector3(this.homeX, 0, this.homeZ),
      ...stops,
      new THREE.Vector3(this.homeX, 0, this.homeZ),
    ];
  }

  // ===== Update =====
  update(ctx: BossContext) {
    const dt = ctx.dt;
    this.detectCooldown = Math.max(0, this.detectCooldown - dt);

    // suspicion decay (only in Normal state, and not during detection cooldown)
    if (this.state === "Normal") {
      this.suspicion = Math.max(0, this.suspicion - this.suspicionDecayPerSec * dt);
      // rise suspicion if player is nearby and not hidden/invisible
      const dx = ctx.playerPos.x - this.x;
      const dz = ctx.playerPos.z - this.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 5 && !ctx.playerHidden && !ctx.playerInvisible && !ctx.playerObscuredBySmoke) {
        // closer = faster rise; rate tuned to outpace decay when very close
        const closeness = 1 - dist / 5;
        this.suspicion = Math.min(1, this.suspicion + closeness * 0.35 * dt);
      }
      // if suspicion maxed → trigger LookingBack
      if (this.suspicion >= 1) {
        this.suspicion = 0;
        this.setState("LookingBack");
        this.startLookingBackSequence();
      }
    }

    // dialogue timer
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.hideDialogue();
    }

    // facing smooth
    const facingDiff = this.angleDiff(this.targetFacingY, this.facingY);
    this.facingY += facingDiff * Math.min(1, dt * 6);
    this.group.rotation.y = this.facingY;

    // sway (idle)
    this.swayPhase += dt;

    // blink animation: random intervals, brief close
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && this.blinkProgress === 0) {
      this.blinkProgress = 0.001; // start blink
    }
    if (this.blinkProgress > 0) {
      // blink lasts ~150ms: 60ms close, 30ms hold, 60ms open
      this.blinkProgress += dt / 0.15;
      if (this.blinkProgress >= 1) {
        this.blinkProgress = 0;
        this.blinkTimer = 2 + Math.random() * 4; // next blink in 2-6s
      }
    }
    // apply blink to eyes (scales Y down)
    this.applyBlinkToEyes();

    // mouth animation (talking during PhoneFlashing, shouting during Attacked)
    this.mouthAnimPhase += dt;
    this.applyMouthAnim(dt);

    // state logic
    switch (this.state) {
      case "Normal":
        this.updateNormal(ctx);
        this.idleSway(0.02);
        break;
      case "PhoneFlashing":
        this.updatePhoneFlashing(ctx);
        break;
      case "LookingBack":
        this.updateLookingBack(ctx);
        break;
      case "Attacked":
        this.updateAttacked(ctx);
        break;
      case "Meeting":
        this.updateMeeting(ctx);
        break;
      case "Patrol":
        this.updatePatrol(ctx);
        break;
      case "Stunned":
        this.updateStunned(ctx);
        break;
      case "Distracted":
        this.updateDistracted(ctx);
        break;
    }

    // sit/stand blend
    const targetSit = this.sitting ? 1 : 0;
    this.sitBlend += (targetSit - this.sitBlend) * Math.min(1, dt * 8);
    // Only apply sitting pose when actually sitting. When walking (patrol/distract),
    // the walk animation in moveAlongRoute controls legs/arms, so we must not override.
    if (this.sitBlend > 0.01 && this.sitting) {
      this.applySittingPose(this.sitBlend);
    } else if (this.sitBlend > 0.01) {
      // transitioning from sit to stand — apply blend for body Y only, don't lock legs
      this.bodyGroup.position.y = THREE.MathUtils.lerp(0, -0.15, this.sitBlend);
    } else {
      // fully standing — reset body Y
      this.bodyGroup.position.y = 0;
    }

    // vision cone visualization (after facing/position updated)
    this.updateVisionCone();

    // boss HP bar update
    this.updateBossHpBar();

    // rage mode timer (level 7 rage variant)
    this.updateRage(dt);

    // position update
    this.group.position.x = this.x;
    this.group.position.z = this.z;
  }

  private updateBossHpBar() {
    const show = this.bossMaxHP > 1;
    this.bossHpBarBg.visible = show;
    this.bossHpBar.visible = show;
    if (show) {
      const ratio = Math.max(0, this.bossHP / this.bossMaxHP);
      this.bossHpBar.scale.x = Math.max(0.001, ratio);
      this.bossHpBar.position.x = -(1 - ratio) * 0.65;
      // color: green > orange > red as HP drops
      const color = ratio > 0.6 ? 0xef4444 : ratio > 0.3 ? 0xf97316 : 0xfbbf24;
      (this.bossHpBar.material as THREE.MeshBasicMaterial).color.setHex(color);
    }
  }

  private updateRage(dt: number) {
    if (this.variant !== "rage") return;
    this.enrageTimer -= dt;
    if (this.enrageTimer <= 0) {
      this.enraged = !this.enraged;
      this.enrageTimer = this.enraged ? 4 : 10; // enraged 4s, calm 10s
      if (this.enraged) {
        this.showDialogue("我要让你加班到死！", 2000);
        this.cb.onStateChange(this.state); // trigger UI refresh
      }
    }
    // animate anger marker (pulse)
    this.accessories.children.forEach((c) => {
      if (c instanceof THREE.Mesh && c.userData.isAnger) {
        const s = 1 + Math.sin(this.swayPhase * 6) * 0.3;
        c.scale.set(s, s, s);
      }
      if (c instanceof THREE.Mesh && c.userData.isAura) {
        const mat = c.material as THREE.MeshBasicMaterial;
        mat.opacity = this.enraged ? 0.7 : 0.3;
        const s = 1 + Math.sin(this.swayPhase * 3) * 0.15;
        c.scale.set(s, s, s);
      }
      if (c instanceof THREE.Mesh && c.userData.isAuraOuter) {
        const mat = c.material as THREE.MeshBasicMaterial;
        mat.opacity = this.enraged ? 0.45 : 0.18;
        const s = 1.05 + Math.sin(this.swayPhase * 2 + 1) * 0.2;
        c.scale.set(s, s, s);
      }
      if (c instanceof THREE.Mesh && c.userData.isVein) {
        // throb veins
        const s = 1 + Math.sin(this.swayPhase * 8 + c.position.x * 5) * 0.2;
        c.scale.set(1, s, 1);
      }
      if (c instanceof THREE.Mesh && c.userData.isGlint) {
        // twinkle glasses shine
        const mat = c.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.4 + Math.abs(Math.sin(this.swayPhase * 3 + c.position.x * 10)) * 0.5;
      }
      if (c instanceof THREE.Mesh && c.userData.isMusicNote) {
        // bobbing music note
        c.position.y = 2.55 + Math.sin(this.swayPhase * 3) * 0.08;
        c.position.x = 0.2 + Math.cos(this.swayPhase * 3) * 0.04;
        const mat = c.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.6 + Math.sin(this.swayPhase * 4) * 0.3;
      }
      if (c instanceof THREE.Mesh && c.userData.isHpRing) {
        // pulse the headphone accent ring
        const mat = c.material as THREE.MeshStandardMaterial;
        if (mat.emissiveIntensity !== undefined) {
          mat.emissiveIntensity = 0.4 + Math.abs(Math.sin(this.swayPhase * 4)) * 0.4;
        }
      }
      if (c instanceof THREE.Mesh && c.userData.isAroma) {
        // rise and fade aroma wisps
        const mat = c.material as THREE.MeshBasicMaterial;
        const phase = (this.swayPhase * 1.5 + c.position.x * 8) % (Math.PI * 2);
        c.position.y = 1.55 + (Math.sin(phase) + 1) * 0.5 * 0.15;
        mat.opacity = 0.4 * (1 - (Math.sin(phase) + 1) / 2);
      }
    });
  }

  // is boss currently enraged (full-map detection)?
  isEnraged(): boolean {
    return this.enraged;
  }

  private angleDiff(target: number, current: number): number {
    let d = target - current;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  private idleSway(amount: number) {
    this.bodyGroup.rotation.z = Math.sin(this.swayPhase * 1.5) * amount;
    // animate coffee steam (if coffee variant)
    if (this.variant === "coffee") {
      this.accessories.children.forEach((c) => {
        if (c instanceof THREE.Mesh && c.userData.isSteam) {
          const base = c.userData.steamBase as number;
          c.position.y = base + Math.sin(this.swayPhase * 2 + base * 10) * 0.04;
          const mat = c.material as THREE.MeshBasicMaterial;
          mat.opacity = 0.3 + Math.sin(this.swayPhase * 2 + base * 10) * 0.25;
        }
      });
    }
  }

  // ===== Normal =====
  private updateNormal(ctx: BossContext) {
    this.sitting = true;
    this.targetFacingY = Math.PI; // face desk (-Z)
    // half-circle detection: boss senses player approaching within 5u on +Z side
    // (we model the "behind awareness" as front half-circle toward +Z)
    this.halfCircleDetect(ctx);

    // timers
    this.phoneTimer -= ctx.dt;
    this.meetingTimer -= ctx.dt;
    this.patrolTimer -= ctx.dt;

    if (this.phoneTimer <= 0) {
      this.phoneTimer = (8 + Math.random() * 5) * this.difficultyScale();
      this.setState("PhoneFlashing");
      this.startSequence([
        { name: "pf_phone", dur: 2 + Math.random() * 3 },
      ]);
    } else if (this.meetingTimer <= 0 && Math.random() < 0.5) {
      this.meetingTimer = (12 + Math.random() * 8) * this.difficultyScale();
      this.setState("Meeting");
      this.startSequence([
        { name: "m_meeting", dur: 12 + Math.random() * 8 },
      ]);
    } else if (this.patrolTimer <= 0) {
      this.patrolTimer = (20 + Math.random() * 15) * this.difficultyScale();
      this.setState("Patrol");
      this.startPatrolSequence();
    }
  }

  // difficulty scale factor (set by GameEngine via setDifficulty)
  private _difficulty = 1;
  setDifficulty(d: number) {
    this._difficulty = d;
  }
  private difficultyScale(): number {
    // coffee variant → extra 0.85x (more alert)
    const variantFactor = this.variant === "coffee" ? 0.85 : 1.0;
    return Math.max(0.45, (1.05 - this._difficulty * 0.07) * variantFactor);
  }

  private halfCircleDetect(ctx: BossContext) {
    if (this.detectCooldown > 0) return;
    const dx = ctx.playerPos.x - this.x;
    const dz = ctx.playerPos.z - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    // enraged boss detects anywhere on the map (full-map detection)
    const range = this.enraged ? 99 : this.halfRangeBase;
    if (dist > range) return;
    // Direction check: detection is always in the boss's FRONT hemisphere.
    // Boss forward = (sin(facingY), 0, cos(facingY)). Player must be in front (dot > 0).
    // Normal: boss faces -Z (facingY=π), front = -Z. Player sneaks from +Z (behind) = safe.
    // LookingBack/Attacked: boss faces +Z (facingY=0), front = +Z. Player in +Z = detected.
    // enraged boss detects in all directions
    if (!this.enraged) {
      const fwdX = Math.sin(this.facingY);
      const fwdZ = Math.cos(this.facingY);
      const dot = (dx * fwdX + dz * fwdZ) / Math.max(0.001, dist);
      if (dot < 0.2) return; // player must be clearly in front hemisphere
    }
    // check exemptions
    if (ctx.playerInvisible) return;
    if (ctx.playerObscuredBySmoke) return;
    if (ctx.playerHidden) return;
    if (ctx.playerShield) {
      // keyboard shield: detected but only -0.5
      this.cb.onDetect(0.5, BOSS_LINES.attackedKeyboard);
      this.detectCooldown = WORLD.detectionCooldown;
      return;
    }
    this.cb.onDetect(1, BOSS_LINES.lookingFound);
    this.detectCooldown = WORLD.detectionCooldown;
  }

  // ===== PhoneFlashing =====
  private updatePhoneFlashing(ctx: BossContext) {
    this.sitting = true;
    this.targetFacingY = Math.PI;
    // flash icon
    if (Math.floor(this.phase.t * 4) % 2 === 0) {
      this.setStatusEmoji("📱");
    } else {
      this.statusSprite.visible = false;
    }
    this.phase.t += ctx.dt;
    // look at phone (arm up)
    this.rightArm.rotation.x = -1.2;
    if (this.phase.t >= this.phase.dur) {
      this.rightArm.rotation.x = 0;
      this.statusSprite.visible = false;
      // go to LookingBack
      this.setState("LookingBack");
      this.startLookingBackSequence();
    }
  }

  // ===== LookingBack =====
  private updateLookingBack(ctx: BossContext) {
    this.phase.t += ctx.dt;
    const p = this.phase.name;
    if (p === "stand") {
      this.sitting = false;
      if (this.phase.t >= this.phase.dur) this.advancePhase();
    } else if (p === "turn") {
      this.targetFacingY = 0; // face +Z (player area)
      if (this.phase.t >= this.phase.dur) this.advancePhase();
    } else if (p === "observe") {
      // detect during observe
      this.lookingDetect(ctx, this.lookRangeBase);
      if (this.phase.t >= this.phase.dur) this.advancePhase();
    } else if (p === "dialogue") {
      // speak (generic) — only if not already shown
      if (this.phase.t < 0.05) {
        this.showDialogue("嗯...刚刚好像有动静", 1800);
      }
      if (this.phase.t >= this.phase.dur) this.advancePhase();
    } else if (p === "turnback") {
      this.targetFacingY = Math.PI;
      if (this.phase.t >= this.phase.dur) this.advancePhase();
    } else if (p === "sit") {
      this.sitting = true;
      if (this.phase.t >= this.phase.dur) {
        this.setState("Normal");
      }
    }
  }

  private lookingDetect(ctx: BossContext, range: number) {
    if (this.detectCooldown > 0) return;
    const dx = ctx.playerPos.x - this.x;
    const dz = ctx.playerPos.z - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > range) return;
    // Direction check: detection is always in the boss's FRONT hemisphere.
    // During LookingBack, boss faces +Z (facingY≈0). Player in +Z (front) = detected.
    const fwdX = Math.sin(this.facingY);
    const fwdZ = Math.cos(this.facingY);
    const dot = (dx * fwdX + dz * fwdZ) / Math.max(0.001, dist);
    if (dot < 0.2) return; // player must be clearly in front hemisphere
    if (ctx.playerInvisible) return;
    if (ctx.playerObscuredBySmoke) return;
    if (ctx.playerHidden) return;
    if (ctx.playerShield) {
      this.cb.onDetect(0.5, BOSS_LINES.attackedKeyboard);
      this.detectCooldown = WORLD.detectionCooldown;
      return;
    }
    this.cb.onDetect(1, BOSS_LINES.lookingFound);
    this.detectCooldown = WORLD.detectionCooldown;
  }

  // ===== Attacked =====
  private updateAttacked(ctx: BossContext) {
    this.phase.t += ctx.dt;
    const p = this.phase.name;
    if (p === "a_who") {
      this.sitting = true;
      if (this.phase.t >= this.phase.dur) this.advancePhase();
    } else if (p === "a_turn") {
      this.sitting = false;
      this.targetFacingY = 0;
      if (this.phase.t >= this.phase.dur) this.advancePhase();
    } else if (p === "a_observe") {
      this.attackedDetect(ctx, this.halfRangeBase);
      if (this.phase.t >= this.phase.dur) this.advancePhase();
    } else if (p === "a_conclude") {
      // conclusion line is set in attackedDetect; if not detected show "幻觉"
      if (this.phase.t < 0.05 && !this._attackedFound) {
        this.showDialogue(BOSS_LINES.attackedNone, 2200);
      }
      if (this.phase.t >= this.phase.dur) this.advancePhase();
    } else if (p === "a_turnback") {
      this.targetFacingY = Math.PI;
      if (this.phase.t >= this.phase.dur) {
        this._attackedFound = false;
        this.setState("Normal");
      }
    }
  }

  private _attackedFound = false;
  private attackedDetect(ctx: BossContext, range: number) {
    if (this.detectCooldown > 0) return;
    const dx = ctx.playerPos.x - this.x;
    const dz = ctx.playerPos.z - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > range) return;
    // Direction check: detection is always in the boss's FRONT hemisphere.
    // During Attacked, boss faces +Z (facingY≈0). Player in +Z (front) = detected.
    const fwdX = Math.sin(this.facingY);
    const fwdZ = Math.cos(this.facingY);
    const dot = (dx * fwdX + dz * fwdZ) / Math.max(0.001, dist);
    if (dot < 0.2) return; // player must be clearly in front hemisphere
    if (ctx.playerInvisible) return;
    if (ctx.playerObscuredBySmoke) return;
    if (ctx.playerHidden) return;
    this._attackedFound = true;
    if (ctx.playerShield) {
      this.cb.onDetect(0.5, BOSS_LINES.attackedKeyboard);
      this.showDialogue(BOSS_LINES.attackedKeyboard, 2200);
    } else {
      this.cb.onDetect(1, BOSS_LINES.attackedFound);
      this.showDialogue(BOSS_LINES.attackedFound, 2200);
    }
    this.detectCooldown = WORLD.detectionCooldown;
  }

  // ===== Meeting =====
  private updateMeeting(ctx: BossContext) {
    this.sitting = true;
    this.targetFacingY = Math.PI;
    // sway
    this.bodyGroup.rotation.z = Math.sin(this.swayPhase * 1.2) * 0.05;
    // random meeting lines
    this.phase.t += ctx.dt;
    if (Math.floor(this.phase.t * 0.5) !== Math.floor((this.phase.t - ctx.dt) * 0.5)) {
      const line = BOSS_LINES.meeting[Math.floor(Math.random() * BOSS_LINES.meeting.length)];
      this.showDialogue(line, 1800);
    }
    if (this.phase.t >= this.phase.dur) {
      this.bodyGroup.rotation.z = 0;
      this.statusSprite.visible = false;
      this.setState("Normal");
    }
  }

  // ===== Patrol =====
  private updatePatrol(ctx: BossContext) {
    this.phase.t += ctx.dt;
    const p = this.phase.name;
    if (p === "p_warn") {
      this.sitting = true;
      if (this.phase.t >= this.phase.dur) {
        this.statusSprite.visible = false;
        this.advancePhase();
      }
    } else if (p === "p_stand") {
      this.sitting = false;
      if (this.phase.t >= this.phase.dur) this.advancePhase();
    } else if (p === "p_patrol") {
      this.moveAlongRoute(ctx, 2.2, true);
      this.patrolDetect(ctx);
      if (this.phase.t >= this.phase.dur || this.patrolIdx >= this.patrolRoute.length - 1) {
        this.advancePhase();
      }
    } else if (p === "p_return") {
      this.moveAlongRoute(ctx, 2.5, false);
      this.patrolDetect(ctx);
      if (this.phase.t >= this.phase.dur || this.reachedHome()) {
        this.advancePhase();
      }
    } else if (p === "p_sit") {
      this.sitting = true;
      this.targetFacingY = Math.PI;
      if (this.phase.t >= this.phase.dur) {
        this.x = this.homeX;
        this.z = this.homeZ;
        this.setState("Normal");
      }
    }
  }

  private reachedHome(): boolean {
    const dx = this.x - this.homeX;
    const dz = this.z - this.homeZ;
    return dx * dx + dz * dz < 0.3;
  }

  private moveAlongRoute(ctx: BossContext, speed: number, forward: boolean) {
    if (this.patrolRoute.length === 0) return;
    const target = this.patrolRoute[this.patrolIdx];
    if (!target) return;
    const dx = target.x - this.x;
    const dz = target.z - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.3) {
      this.patrolIdx += forward ? 1 : -1;
      if (this.patrolIdx < 0) this.patrolIdx = 0;
      if (this.patrolIdx >= this.patrolRoute.length) {
        this.patrolIdx = this.patrolRoute.length - 1;
      }
      return;
    }
    const step = Math.min(dist, speed * ctx.dt);
    let nx = this.x + (dx / dist) * step;
    let nz = this.z + (dz / dist) * step;
    // collision check with smaller patrol radius (boss can navigate tight spaces)
    const blocked = this.collidesAtRadius(nx, nz, ctx.colliders, 0.35);
    if (blocked) {
      // try sliding
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
    this.x = nx;
    this.z = nz;
    // face movement direction
    this.targetFacingY = Math.atan2(dx, dz);
    // walk anim
    this.walkPhase += ctx.dt * 8;
    this.leftLeg.rotation.x = Math.sin(this.walkPhase) * 0.6;
    this.rightLeg.rotation.x = -Math.sin(this.walkPhase) * 0.6;
    this.leftArm.rotation.x = -Math.sin(this.walkPhase) * 0.4;
    this.rightArm.rotation.x = Math.sin(this.walkPhase) * 0.4;
  }

  private collidesAtRadius(x: number, z: number, colliders: Collider[], r: number): boolean {
    for (const c of colliders) {
      if (
        x + r > c.minX &&
        x - r < c.maxX &&
        z + r > c.minZ &&
        z - r < c.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  private patrolDetect(ctx: BossContext) {
    if (this.detectCooldown > 0) return;
    // patrolRangeBase u, 80° cone in front
    const toPlayer = new THREE.Vector3(
      ctx.playerPos.x - this.x,
      0,
      ctx.playerPos.z - this.z
    );
    const dist = toPlayer.length();
    if (dist > this.patrolRangeBase) return;
    if (ctx.playerInvisible || ctx.playerHidden || ctx.playerObscuredBySmoke) return;
    // cone
    const fwd = this.forward;
    const dot = toPlayer.normalize().dot(fwd);
    const cosHalf = Math.cos((40 * Math.PI) / 180); // half of 80°
    if (dot < cosHalf) return;
    if (ctx.playerShield) {
      if (Math.random() < 0.5) {
        this.cb.onDetect(0.5, BOSS_LINES.attackedKeyboard);
        this.detectCooldown = WORLD.detectionCooldown;
      }
      return;
    }
    this.cb.onDetect(1, "巡逻中发现你！");
    this.detectCooldown = WORLD.detectionCooldown;
  }

  // ===== Stunned =====
  private updateStunned(ctx: BossContext) {
    this.sitting = true;
    this.stunRemaining -= ctx.dt;
    // sway stars
    this.starsSprite.material.rotation += ctx.dt * 4;
    this.bodyGroup.rotation.z = Math.sin(this.swayPhase * 4) * 0.08;
    if (this.stunRemaining <= 0) {
      this.bodyGroup.rotation.z = 0;
      this.starsSprite.visible = false;
      this.setState("Normal");
    }
  }

  // ===== Distracted =====
  private updateDistracted(ctx: BossContext) {
    this.phase.t += ctx.dt;
    const p = this.phase.name;
    if (p === "d_react") {
      this.sitting = false;
      if (this.phase.t >= this.phase.dur) this.advancePhase();
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
    } else if (p === "d_look") {
      // look around
      this.head.rotation.y = Math.sin(this.phase.t * 6) * 0.6;
      if (this.phase.t >= this.phase.dur) {
        this.head.rotation.y = 0;
        this.advancePhase();
      }
    } else if (p === "d_return") {
      const dx = this.homeX - this.x;
      const dz = this.homeZ - this.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.3) {
        const step = Math.min(dist, 3 * ctx.dt);
        this.x += (dx / dist) * step;
        this.z += (dz / dist) * step;
        this.targetFacingY = Math.atan2(dx, dz);
        this.walkPhase += ctx.dt * 8;
        this.leftLeg.rotation.x = Math.sin(this.walkPhase) * 0.6;
        this.rightLeg.rotation.x = -Math.sin(this.walkPhase) * 0.6;
      } else {
        this.targetFacingY = Math.PI;
        this.sitting = true;
        if (this.phase.t >= this.phase.dur) {
          this.x = this.homeX;
          this.z = this.homeZ;
          this.statusSprite.visible = false;
          this.setState("Normal");
        }
      }
    }
  }

  // ===== Hiding spot query (for engine) =====
  isPlayerHiddenAt(playerPos: THREE.Vector3): boolean {
    for (const spot of HIDING_SPOTS) {
      const dx = playerPos.x - spot.x;
      const dz = playerPos.z - spot.z;
      if (Math.abs(dx) < spot.w / 2 + 0.8 && Math.abs(dz) < spot.d / 2 + 0.8) {
        return true;
      }
    }
    return false;
  }

  // reset to Normal (for level restart)
  // difficulty: 1 = normal. Higher levels → more frequent boss actions.
  reset(difficulty = 1) {
    this.x = this.homeX;
    this.z = this.homeZ;
    this.facingY = Math.PI;
    this.targetFacingY = Math.PI;
    this.sitting = true;
    this.stunRemaining = 0;
    this._attackedFound = false;
    // difficulty scaling: timers shrink with higher difficulty
    // difficulty 1 → 0.85x (slightly slower), difficulty 7 → 0.55x (much faster)
    const scale = Math.max(0.55, 1.05 - difficulty * 0.07);
    this.phoneTimer = (6 + Math.random() * 4) * scale;
    this.meetingTimer = (12 + Math.random() * 6) * scale;
    this.patrolTimer = (20 + Math.random() * 10) * scale;
    this.detectCooldown = 0;
    this.hideDialogue();
    this.starsSprite.visible = false;
    this.statusSprite.visible = false;
    this.visionHalfCircle.visible = false;
    this.visionPatrolCone.visible = false;
    this.setState("Normal");
    // ensure facial expression matches initial state
    this.updateFacialExpression("Normal");
    // reset enrage state for rage variant
    this.enraged = false;
    this.enrageTimer = this.variant === "rage" ? 12 : 0;
    // reset blink/mouth anim
    this.blinkTimer = 2 + Math.random() * 3;
    this.blinkProgress = 0;
    this.mouthAnimPhase = 0;
  }
}
