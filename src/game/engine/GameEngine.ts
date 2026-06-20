import * as THREE from "three";
import { OfficeScene, type Collider } from "./OfficeScene";
import { Boss } from "./Boss";
import { FPSMode } from "./FPSMode";
import { audio } from "../audio/AudioManager";
import { useGameStore } from "../store";
import {
  WORLD,
  WEAPONS,
  CONSUMABLES,
  HIDING_SPOTS,
  LEVELS,
  ITEM_SPAWN,
  MAX_HP,
  rollItemKind,
  itemColor,
  itemIcon,
  itemName,
} from "../constants";
import type {
  WeaponKind,
  ConsumableKind,
  ItemKind,
  BossStateName,
} from "../types";

interface ItemEntity {
  kind: ItemKind;
  mesh: THREE.Group;
  baseY: number;
  phase: number;
}

interface Projectile {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  weapon: WeaponKind;
  life: number;
}

interface Particle3D {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

function makeEmojiSprite(emoji: string, size = 128): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.font = `${size * 0.7}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, size / 2, size / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
  const s = new THREE.Sprite(mat);
  return s;
}

export class GameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private office: OfficeScene;
  private boss: Boss;
  private playerGroup: THREE.Group;
  private playerHead: THREE.Group;
  private playerRightArm: THREE.Group;
  private playerLeftArm: THREE.Group;
  private playerRightLeg: THREE.Group;
  private playerLeftLeg: THREE.Group;
  private weaponInHand: THREE.Group | null = null;
  private shieldMesh: THREE.Group | null = null;

  // player state
  private px = WORLD.playerStart.x;
  private pz = WORLD.playerStart.z;
  private py = 0;
  private pfacing = Math.PI; // face -Z (toward boss) at start
  private ptargetFacing = Math.PI;
  private pvel = new THREE.Vector3();
  private walkPhase = 0;

  // kick/attack
  private kickCd = 0; // seconds remaining
  private attackAnim = 0; // attack animation timer (kick or swing)
  private attackAnimDur = 0;
  private attackType: "kick" | "swing" | null = null;
  private attackHasHit = false;
  private attackWeapon: WeaponKind | null = null;

  // throw
  private charging = false;
  private chargeVal = 0; // 0..1, sinusoidal
  private chargeDir = 1;

  // status effects timers
  private tSpeed = 0;
  private tInvis = 0;
  private tCombo = 0;
  private tShield = 0;
  private shieldUsedThisCycle = false;

  // items
  private items: ItemEntity[] = [];
  private itemSpawnTimer = ITEM_SPAWN.interval;

  // projectiles
  private projectiles: Projectile[] = [];
  private particles: Particle3D[] = [];

  // cooldown bar (above player head)
  private cooldownBar: THREE.Mesh;
  private cooldownBarBg: THREE.Mesh;

  // status icon sprite (above player head) - shows active effects
  private statusIcon: THREE.Sprite;

  // camera offset (iso 45°)
  private camOffset = new THREE.Vector3(0, 11, 9);

  // input
  private keys: Record<string, boolean> = {};
  private mouseDown = false;
  private rightDown = false;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundContextMenu: (e: Event) => void;
  private boundResize: () => void;
  private boundNumKey: (e: KeyboardEvent) => void;

  // fps mode
  private fpsMode: FPSMode | null = null;

  // screen state (local mirror to avoid spamming store)
  private screen: "playing" | "level-transition" | "game-over" | "victory" | "fps" = "playing";
  private paused = false;

  // detection flash
  private detectFlashTimer = 0;

  // hit feedback
  private hitFlashTimer = 0; // boss red flash on hit
  private screenShake = 0; // camera shake amount
  private hitFlashLight: THREE.PointLight;

  // level timer
  private levelStartTime = 0;
  private levelTime = 0;

  // store unsubscribe
  private unsubStore: (() => void) | null = null;
  // pending consumable use from store slot selection
  private pendingConsume = false;

  // store handle
  private get store() {
    return useGameStore.getState();
  }

  constructor(container: HTMLElement) {
    this.container = container;
    // renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.cursor = "crosshair";

    // scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a24);
    this.scene.fog = new THREE.Fog(0x1a1a24, 25, 45);

    // camera
    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(this.px, 11, this.pz + 9);
    this.camera.lookAt(this.px, 1, this.pz);

    // lights — hemisphere for ambient sky/ground tint (adds depth)
    const hemi = new THREE.HemisphereLight(0xfff4dd, 0x4a3a5a, 0.45);
    this.scene.add(hemi);
    const amb = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(8, 16, 6);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -11;
    dir.shadow.camera.right = 11;
    dir.shadow.camera.top = 11;
    dir.shadow.camera.bottom = -11;
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 30;
    dir.shadow.bias = -0.0008;
    this.scene.add(dir);
    const fill = new THREE.PointLight(0xffddaa, 0.4, 25);
    fill.position.set(0, 6, 0);
    this.scene.add(fill);

    // office
    this.office = new OfficeScene();
    this.scene.add(this.office.group);

    // boss
    this.boss = new Boss({
      onStateChange: (s) => {
        this.store.setBossState(s);
        // push event banner for key state changes
        this.pushBossEventBanner(s);
      },
      onDialogue: (text, dur) => {
        this.store.setBossDialogue(text);
        if (text === null && dur === undefined) {
          /* store handles null */
        }
      },
      onDetect: (amt, line) => this.onPlayerDetected(amt, line),
      onAttackBlocked: () => {
        audio.block();
        this.store.pushToast("老板开会格挡了你的攻击！武器被消耗", "warn");
        // consume the equipped weapon (the one used in the attack)
        if (this.attackWeapon) this.consumeEquippedWeapon();
      },
      onBossHit: () => {
        // boss red flash + screen shake + hit particles
        this.hitFlashTimer = 0.35;
        if (this.store.settings.screenshake) {
          this.screenShake = Math.max(this.screenShake, 0.4);
        }
        this.spawnHitParticles();
      },
    });
    this.scene.add(this.boss.group);

    // hit flash light (red, attached to boss group, hidden by default)
    this.hitFlashLight = new THREE.PointLight(0xff2200, 0, 4);
    this.hitFlashLight.position.set(0, 1.5, 0);
    this.boss.group.add(this.hitFlashLight);

    // player
    this.playerGroup = new THREE.Group();
    this.playerHead = new THREE.Group();
    this.playerRightArm = new THREE.Group();
    this.playerLeftArm = new THREE.Group();
    this.playerRightLeg = new THREE.Group();
    this.playerLeftLeg = new THREE.Group();
    this.buildPlayerModel();
    this.playerGroup.position.set(this.px, 0, this.pz);
    this.playerGroup.rotation.y = this.pfacing;
    this.scene.add(this.playerGroup);

    // cooldown bar above player
    const barBgGeo = new THREE.PlaneGeometry(1.1, 0.16);
    const barBgMat = new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.6, depthTest: false });
    this.cooldownBarBg = new THREE.Mesh(barBgGeo, barBgMat);
    this.cooldownBarBg.position.set(0, 2.4, 0);
    this.cooldownBarBg.renderOrder = 999;
    this.playerGroup.add(this.cooldownBarBg);
    const barGeo = new THREE.PlaneGeometry(1.0, 0.12);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.95, depthTest: false });
    this.cooldownBar = new THREE.Mesh(barGeo, barMat);
    this.cooldownBar.position.set(0, 2.4, 0.01);
    this.cooldownBar.renderOrder = 1000;
    this.playerGroup.add(this.cooldownBar);

    // status icon (active effect emoji)
    this.statusIcon = makeEmojiSprite("", 128);
    (this.statusIcon.material as THREE.SpriteMaterial).opacity = 0;
    this.statusIcon.position.set(0, 2.9, 0);
    this.statusIcon.scale.set(0.6, 0.6, 1);
    this.playerGroup.add(this.statusIcon);

    // bind events
    this.boundKeyDown = (e) => this.onKeyDown(e);
    this.boundKeyUp = (e) => this.onKeyUp(e);
    this.boundMouseDown = (e) => this.onMouseDown(e);
    this.boundMouseUp = (e) => this.onMouseUp(e);
    this.boundContextMenu = (e) => e.preventDefault();
    this.boundResize = () => this.onResize();
    this.boundNumKey = (e) => this.onNumKey(e);

    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);
    window.addEventListener("keydown", this.boundNumKey);
    this.renderer.domElement.addEventListener("mousedown", this.boundMouseDown);
    window.addEventListener("mouseup", this.boundMouseUp);
    this.renderer.domElement.addEventListener("contextmenu", this.boundContextMenu);
    window.addEventListener("resize", this.boundResize);

    // store subscription: react to screen changes & slot use
    this.unsubStore = useGameStore.subscribe((state, prev) => {
      if (state.screen !== prev.screen) {
        this.onScreenChange(state.screen);
      }
      // sync engine paused state with store paused
      if (state.paused !== prev.paused) {
        this.paused = state.paused;
        // also stop charging throw when pausing
        if (state.paused) {
          this.charging = false;
          this.rightDown = false;
          this.store.setThrowCharge(0);
        }
      }
      // detect consumable slot selection (selectedSlot changed + it's a consumable)
      if (state.selectedSlot !== prev.selectedSlot) {
        this.onSlotSelected(state.selectedSlot);
      }
    });

    // start
    this.clock.start();
    this.loop();
    // debug hook (removed in production if needed)
    if (typeof window !== "undefined") {
      (window as unknown as { __engine?: GameEngine }).__engine = this;
    }
  }

  private mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0.05,
      flatShading: true,
      ...opts,
    });
  }

  private buildPlayerModel() {
    const shirtMat = this.mat(0x4a90d9); // blue casual shirt (employee)
    const pantsMat = this.mat(0x333a4a);
    const skinMat = this.mat(0xf2c9a0);
    const hairMat = this.mat(0x3a2a1a);
    const shoeMat = this.mat(0x222222);

    // torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.35), shirtMat);
    torso.position.y = 1.15;
    torso.castShadow = true;
    this.playerGroup.add(torso);
    // hips
    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), pantsMat);
    hips.position.y = 0.75;
    this.playerGroup.add(hips);

    // head group
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.36), skinMat);
    headMesh.position.y = 1.7;
    headMesh.castShadow = true;
    this.playerHead.add(headMesh);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.4), hairMat);
    hair.position.y = 1.9;
    this.playerHead.add(hair);
    // eyes (looking forward = +Z by default in local; we orient player so +Z forward)
    for (const sx of [-0.08, 0.08]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.02), this.mat(0x111111));
      eye.position.set(sx, 1.72, 0.19);
      this.playerHead.add(eye);
    }
    // smile
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.02), this.mat(0x6a3a2a));
    mouth.position.set(0, 1.6, 0.19);
    this.playerHead.add(mouth);
    this.playerGroup.add(this.playerHead);

    // arms (pivot at shoulder)
    for (const [name, sx] of [["L", -1], ["R", 1]] as const) {
      const arm = new THREE.Group();
      arm.position.set(sx * 0.36, 1.45, 0);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.45, 0.18), shirtMat);
      upper.position.y = -0.22;
      upper.castShadow = true;
      arm.add(upper);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.16), skinMat);
      hand.position.y = -0.5;
      arm.add(hand);
      if (name === "L") this.playerLeftArm = arm;
      else this.playerRightArm = arm;
      this.playerGroup.add(arm);
    }

    // legs
    for (const [name, sx] of [["L", -1], ["R", 1]] as const) {
      const leg = new THREE.Group();
      leg.position.set(sx * 0.14, 0.65, 0);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.22), pantsMat);
      thigh.position.y = -0.2;
      thigh.castShadow = true;
      leg.add(thigh);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.2), pantsMat);
      shin.position.y = -0.6;
      leg.add(shin);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.3), shoeMat);
      shoe.position.set(0, -0.85, 0.04);
      leg.add(shoe);
      if (name === "L") this.playerLeftLeg = leg;
      else this.playerRightLeg = leg;
      this.playerGroup.add(leg);
    }
  }

  // ===== input handlers =====
  private onKeyDown(e: KeyboardEvent) {
    // ESC toggles pause (works in playing + paused states)
    if (e.key === "Escape") {
      if (this.screen === "playing") {
        this.paused = true;
        this.store.setPaused(true);
      } else if (this.store.paused) {
        this.paused = false;
        this.store.setPaused(false);
      }
      return;
    }
    // 'm' toggles sound
    if (e.key.toLowerCase() === "m") {
      this.store.toggleSound();
      audio.setEnabled(this.store.soundOn);
      this.store.pushToast(this.store.soundOn ? "音效已开启" : "音效已关闭", "info");
      return;
    }
    if (this.screen !== "playing" || this.paused) return;
    this.keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === "e") this.tryPickupNearby();
  }
  private onKeyUp(e: KeyboardEvent) {
    this.keys[e.key.toLowerCase()] = false;
  }
  private onNumKey(e: KeyboardEvent) {
    if (this.screen !== "playing") return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 6) {
      this.store.useSlot(n - 1);
    }
  }
  private onMouseDown(e: MouseEvent) {
    if (this.screen !== "playing") return;
    audio.resume();
    if (e.button === 0) {
      this.mouseDown = true;
      this.tryAttack();
    } else if (e.button === 2) {
      // right click — start charging throw if equipped weapon is throwable
      const w = this.store.equippedWeapon;
      if (w && WEAPONS[w].throwable) {
        this.rightDown = true;
        this.charging = true;
        this.chargeVal = 0;
        this.chargeDir = 1;
      }
    }
  }
  private onMouseUp(e: MouseEvent) {
    if (e.button === 0) this.mouseDown = false;
    else if (e.button === 2) {
      if (this.charging) {
        this.releaseThrow();
      }
      this.rightDown = false;
      this.charging = false;
      this.store.setThrowCharge(0);
    }
  }
  private onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ===== slot selection (consumable use) =====
  private onSlotSelected(index: number) {
    if (index < 0) return;
    if (this.screen !== "playing") return;
    const inv = this.store.inventory;
    const slot = inv[index];
    if (!slot || !slot.kind) return;
    // weapons handled in store.useSlot (equipped). Here handle consumables.
    if (
      slot.kind === "speed" ||
      slot.kind === "invis" ||
      slot.kind === "noise" ||
      slot.kind === "combo" ||
      slot.kind === "keyboard" ||
      slot.kind === "smoke"
    ) {
      this.useConsumable(slot.kind as ConsumableKind, index);
    }
  }

  private useConsumable(kind: ConsumableKind, slotIndex: number) {
    // decrement inventory
    const inv = [...this.store.inventory];
    const slot = inv[slotIndex];
    if (!slot || slot.count <= 0) return;
    slot.count -= 1;
    if (slot.count <= 0) {
      inv[slotIndex] = { kind: null, count: 0 };
      // if was selected, clear selection
      if (this.store.selectedSlot === slotIndex) {
        this.store.setSelectedSlot(-1);
      }
    }
    this.store.setInventory(inv);
    // mark that an item was used this level (for no_items achievement)
    this.usedItemsThisLevel = true;

    const def = CONSUMABLES[kind];
    audio.pickup();
    this.store.pushToast(`使用了 ${def.name}`, "good");

    if (kind === "speed") this.tSpeed = def.duration;
    else if (kind === "invis") this.tInvis = def.duration;
    else if (kind === "combo") this.tCombo = def.duration;
    else if (kind === "keyboard") {
      this.tShield = def.duration;
      this.shieldUsedThisCycle = false;
      this.showShieldMesh(true);
    } else if (kind === "noise") {
      // spawn noise at player position → distract boss
      this.boss.triggerDistracted(new THREE.Vector3(this.px, 0, this.pz));
      this.spawnNoiseBurst();
    } else if (kind === "smoke") {
      // create smoke cloud at player position
      this.spawnSmokeCloud(this.px, this.pz, def.duration);
    }
  }

  // ===== Smoke cloud =====
  private smokeClouds: { group: THREE.Group; x: number; z: number; radius: number; life: number; maxLife: number }[] = [];

  private spawnSmokeCloud(x: number, z: number, duration: number) {
    const group = new THREE.Group();
    // multiple puffs (more, larger, more opaque for visibility)
    for (let i = 0; i < 28; i++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.5 + Math.random() * 0.4, 8, 6),
        new THREE.MeshStandardMaterial({
          color: 0xcccccc,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
          roughness: 1,
          flatShading: true,
        })
      );
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * 1.8;
      puff.position.set(Math.cos(ang) * r, 0.6 + Math.random() * 1.6, Math.sin(ang) * r);
      group.add(puff);
    }
    // dark base ring
    const base = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 28),
      new THREE.MeshBasicMaterial({
        color: 0x555555,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    base.rotation.x = -Math.PI / 2;
    base.position.y = 0.05;
    group.add(base);
    // central column marker (visible from afar)
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 2.0, 2.4, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xaaaaaa,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    col.position.y = 1.2;
    group.add(col);
    group.position.set(x, 0, z);
    this.scene.add(group);
    this.smokeClouds.push({ group, x, z, radius: 2.4, life: duration, maxLife: duration });
    this.store.pushToast("烟雾弹！老板无法透过烟雾检测", "good");
  }

  private updateSmokeClouds(dt: number) {
    for (let i = this.smokeClouds.length - 1; i >= 0; i--) {
      const s = this.smokeClouds[i];
      s.life -= dt;
      const t = Math.max(0, s.life / s.maxLife);
      // animate puffs (drift upward + swirl + fade)
      s.group.children.forEach((child, idx) => {
        if (idx < 28) {
          // puff
          child.position.y += dt * 0.12;
          child.rotation.y += dt * 0.3;
          const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          mat.opacity = 0.75 * t;
        }
      });
      // base ring (index 28) and column (index 29) fade
      const baseMat = (s.group.children[28] as THREE.Mesh)?.material as THREE.MeshBasicMaterial;
      if (baseMat) baseMat.opacity = 0.4 * t;
      const colMat = (s.group.children[29] as THREE.Mesh)?.material as THREE.MeshBasicMaterial;
      if (colMat) colMat.opacity = 0.35 * t;
      if (s.life <= 0) {
        this.scene.remove(s.group);
        s.group.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            (o.material as THREE.Material).dispose();
          }
        });
        this.smokeClouds.splice(i, 1);
      }
    }
  }

  // check if line-of-sight from boss to player is blocked by smoke
  private isPlayerObscuredBySmoke(): boolean {
    for (const s of this.smokeClouds) {
      // smoke blocks if either boss or player is inside, OR the segment boss→player passes through the cloud circle
      const bx = this.boss.x;
      const bz = this.boss.z;
      // distance from cloud center to the line segment boss→player
      const dx = this.px - bx;
      const dz = this.pz - bz;
      const lenSq = dx * dx + dz * dz;
      if (lenSq < 0.001) return true;
      const t = Math.max(0, Math.min(1, ((s.x - bx) * dx + (s.z - bz) * dz) / lenSq));
      const cx = bx + t * dx;
      const cz = bz + t * dz;
      const dToCloud = Math.sqrt((cx - s.x) ** 2 + (cz - s.z) ** 2);
      if (dToCloud < s.radius) return true;
      // also if player is inside smoke
      const dPlayer = Math.sqrt((this.px - s.x) ** 2 + (this.pz - s.z) ** 2);
      if (dPlayer < s.radius) return true;
    }
    return false;
  }

  private showShieldMesh(show: boolean) {
    if (show && !this.shieldMesh) {
      const g = new THREE.Group();
      const kb = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.18, 0.15),
        this.mat(0x222222, { emissive: 0x442200, emissiveIntensity: 0.3 })
      );
      // keys (rows of small cubes)
      const keyMat = this.mat(0xeeeeee);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 8; c++) {
          const k = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.04), keyMat);
          k.position.set(-0.21 + c * 0.06, 0.04 - r * 0.06, 0.08);
          kb.add(k);
        }
      }
      g.add(kb);
      // position in front of player
      g.position.set(0, 1.2, 0.3);
      this.playerGroup.add(g);
      this.shieldMesh = g;
    } else if (!show && this.shieldMesh) {
      this.playerGroup.remove(this.shieldMesh);
      this.shieldMesh.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      this.shieldMesh = null;
    }
  }

  private spawnNoiseBurst() {
    // ring particles at player position
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.2, 0.3, 16),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
      );
      mesh.position.set(this.px, 1, this.pz);
      mesh.rotation.x = -Math.PI / 2;
      this.scene.add(mesh);
      const ang = (i / 12) * Math.PI * 2;
      this.particles.push({
        mesh: mesh as unknown as THREE.Mesh,
        vel: new THREE.Vector3(Math.cos(ang) * 0.5, 0.5, Math.sin(ang) * 0.5),
        life: 0.8,
        maxLife: 0.8,
      });
    }
  }

  // hit impact particles at boss position (kick/swing/throw landed)
  private spawnHitParticles() {
    const bx = this.boss.x;
    const bz = this.boss.z;
    // impact ring (white-yellow)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.45, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    ring.position.set(bx, 1.2, bz);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    this.particles.push({
      mesh: ring as unknown as THREE.Mesh,
      vel: new THREE.Vector3(),
      life: 0.4,
      maxLife: 0.4,
    });
    // spark burst
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.06, 0.06),
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xffcc44 : 0xff6644, transparent: true, opacity: 1 })
      );
      mesh.position.set(bx, 1.3, bz);
      this.scene.add(mesh);
      const ang = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 3;
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(ang) * sp, 2 + Math.random() * 2, Math.sin(ang) * sp),
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8,
      });
    }
    // "POW!" text sprite
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.font = "bold 64px sans-serif";
    ctx.fillStyle = "#ffcc00";
    ctx.strokeStyle = "#cc2200";
    ctx.lineWidth = 8;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText("POW!", 128, 64);
    ctx.fillText("POW!", 128, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.position.set(bx, 2.4, bz);
    sprite.scale.set(1.2, 0.6, 1);
    this.scene.add(sprite);
    this.particles.push({
      mesh: sprite as unknown as THREE.Mesh,
      vel: new THREE.Vector3(0, 1.5, 0),
      life: 0.6,
      maxLife: 0.6,
    });
  }

  // ===== attack =====
  private tryAttack() {
    if (this.kickCd > 0 && this.tCombo <= 0) {
      this.store.pushToast("攻击冷却中", "warn");
      return;
    }
    if (this.attackAnim > 0) return;
    const w = this.store.equippedWeapon;
    if (w) {
      // swing weapon
      this.attackType = "swing";
      this.attackAnimDur = WEAPONS[w].swingTime;
      this.attackAnim = this.attackAnimDur;
      this.attackWeapon = w;
      this.attackHasHit = false;
      audio.kickMiss();
    } else {
      // kick
      this.attackType = "kick";
      this.attackAnimDur = 0.3;
      this.attackAnim = this.attackAnimDur;
      this.attackWeapon = null;
      this.attackHasHit = false;
      audio.kickMiss();
    }
    if (this.tCombo <= 0) {
      this.kickCd = WORLD.kickCooldown;
    }
  }

  private releaseThrow() {
    const w = this.store.equippedWeapon;
    if (!w || !WEAPONS[w].throwable) {
      this.store.pushToast("当前武器不可投掷", "warn");
      return;
    }
    audio.throwRelease();
    this.usedWeaponThisLevel = true;
    // spawn projectile
    const def = WEAPONS[w];
    const mesh = this.makeWeaponMesh(w);
    mesh.position.set(this.px, 1.2, this.pz);
    // direction: player facing
    const dir = new THREE.Vector3(Math.sin(this.pfacing), 0, Math.cos(this.pfacing));
    const speed = (0.3 + this.chargeVal * 0.7) * 18;
    this.scene.add(mesh);
    this.projectiles.push({
      mesh,
      vel: dir.multiplyScalar(speed),
      weapon: w,
      life: 3,
    });
    // consume the weapon
    this.consumeEquippedWeapon();
    this.store.pushToast(`投掷了 ${def.name}！`, "good");
  }

  private makeWeaponMesh(w: WeaponKind): THREE.Mesh {
    const def = WEAPONS[w];
    let geo: THREE.BufferGeometry;
    if (w === "mace") {
      geo = new THREE.Group() as unknown as THREE.BufferGeometry;
      // mace: handle + spiked ball
      const g = new THREE.Group();
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6),
        this.mat(0x6a4a2a)
      );
      handle.rotation.z = Math.PI / 2;
      g.add(handle);
      const ball = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.18, 0),
        this.mat(0x444444, { metalness: 0.4 })
      );
      ball.position.x = 0.5;
      g.add(ball);
      // spikes
      for (let i = 0; i < 6; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), this.mat(0x222222));
        const ang = (i / 6) * Math.PI * 2;
        spike.position.set(0.5 + Math.cos(ang) * 0.18, Math.sin(ang) * 0.18, 0);
        spike.rotation.z = ang - Math.PI / 2;
        g.add(spike);
      }
      this.scene.add(g);
      return g as unknown as THREE.Mesh;
    }
    if (w === "bat") {
      geo = new THREE.CylinderGeometry(0.05, 0.08, 0.9, 8);
    } else if (w === "pan") {
      const g = new THREE.Group();
      const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12), this.mat(def.color, { metalness: 0.5 }));
      g.add(pan);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), this.mat(0x6a4a2a));
      handle.position.set(0.3, 0.05, 0);
      handle.rotation.z = Math.PI / 2;
      g.add(handle);
      this.scene.add(g);
      return g as unknown as THREE.Mesh;
    } else {
      // ruler
      geo = new THREE.BoxGeometry(0.7, 0.04, 0.1);
    }
    const mesh = new THREE.Mesh(geo, this.mat(def.color, { metalness: 0.3 }));
    mesh.castShadow = true;
    return mesh;
  }

  private consumeEquippedWeapon() {
    const w = this.store.equippedWeapon;
    if (!w) return;
    const inv = [...this.store.inventory];
    const idx = this.store.selectedSlot;
    if (idx < 0) return;
    const slot = inv[idx];
    if (!slot || slot.kind !== w) return;
    slot.count -= 1;
    if (slot.count <= 0) {
      inv[idx] = { kind: null, count: 0 };
      this.store.setSelectedSlot(-1);
      this.store.setEquippedWeapon(null);
      this.updateWeaponInHand();
    }
    this.store.setInventory(inv);
  }

  // update weapon mesh in player's hand based on equipped
  private updateWeaponInHand() {
    if (this.weaponInHand) {
      this.playerRightArm.remove(this.weaponInHand);
      this.weaponInHand.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      this.weaponInHand = null;
    }
    const w = this.store.equippedWeapon;
    if (!w) return;
    const g = new THREE.Group();
    const def = WEAPONS[w];
    if (w === "mace") {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), this.mat(0x6a4a2a));
      handle.position.set(0, -0.3, 0);
      g.add(handle);
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), this.mat(0x444444, { metalness: 0.4 }));
      ball.position.set(0, -0.6, 0);
      g.add(ball);
    } else if (w === "bat") {
      const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.7, 8), this.mat(def.color));
      bat.position.set(0, -0.4, 0);
      bat.rotation.z = 0.1;
      g.add(bat);
    } else if (w === "pan") {
      const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 12), this.mat(def.color, { metalness: 0.5 }));
      pan.position.set(0, -0.5, 0);
      pan.rotation.x = Math.PI / 2;
      g.add(pan);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), this.mat(0x6a4a2a));
      handle.position.set(0.22, -0.45, 0);
      handle.rotation.z = Math.PI / 2;
      g.add(handle);
    } else {
      const ruler = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.08), this.mat(def.color));
      ruler.position.set(0, -0.45, 0);
      g.add(ruler);
    }
    g.position.set(0, -0.45, 0.1);
    this.playerRightArm.add(g);
    this.weaponInHand = g;
  }

  // ===== boss event banner =====
  private pushBossEventBanner(state: string) {
    const banners: Record<string, { text: string; icon: string; color: string }> = {
      Patrol: { text: "老板开始巡逻！", icon: "⚠️", color: "bg-red-700/90 border-red-400" },
      Meeting: { text: "老板开会中（攻击无效）", icon: "📅", color: "bg-purple-700/90 border-purple-400" },
      LookingBack: { text: "老板回头看！", icon: "👀", color: "bg-amber-600/90 border-amber-300" },
      Attacked: { text: "老板被惊动！", icon: "😡", color: "bg-red-600/90 border-red-300" },
      Stunned: { text: "老板眩晕中！", icon: "💫", color: "bg-yellow-500/90 border-yellow-200" },
      Distracted: { text: "老板被噪音吸引", icon: "❓", color: "bg-pink-600/90 border-pink-300" },
      PhoneFlashing: { text: "老板手机响了", icon: "📱", color: "bg-sky-600/90 border-sky-300" },
      Normal: { text: "", icon: "", color: "" },
    };
    const b = banners[state];
    if (b && b.text) {
      this.store.pushEventBanner(b.text, b.icon, b.color);
    }
    // variant-specific one-shot sounds on state changes
    const variant = this.boss.variant;
    if (variant === "glasses" && (state === "LookingBack" || state === "Attacked")) {
      // glasses boss "flashes" reflection when looking around
      audio.glassesGlare();
    } else if (variant === "coffee" && state === "Meeting") {
      // boss sips coffee during meeting
      audio.coffeeSip();
    } else if (variant === "headphones" && state === "Patrol") {
      // boss grooves to the beat when patrolling
      audio.headphoneBeat();
    } else if (variant === "rage" && state === "Attacked") {
      // rage boss roars when attacked
      audio.rageRoar();
    }
  }

  // ===== detection callback =====
  private onPlayerDetected(amount: number, line: string) {
    if (this.screen !== "playing") return;
    audio.detected();
    this.detectFlashTimer = 0.6;
    // track stats
    this.store.incDetection();
    this.store.incDamage(amount);
    // detection breaks combo
    this.store.setCombo(0);
    const newHp = Math.max(0, this.store.hp - amount);
    this.store.setHp(newHp);
    this.store.setDeathDialogue(line);
    this.store.pushToast(`被发现！-${amount} 血`, "danger");
    if (newHp <= 0) {
      this.triggerGameOver();
    }
  }

  private triggerGameOver() {
    if (this.screen !== "playing") return;
    audio.gameOver();
    audio.stopVariantAmbient();
    this.screen = "game-over";
    setTimeout(() => {
      this.store.setScreen("game-over");
    }, 3000); // 3s delay per design
    this.paused = true;
  }

  private triggerLevelComplete() {
    if (this.screen !== "playing") return;
    audio.levelComplete();
    audio.stopVariantAmbient();
    this.screen = "level-transition";
    this.paused = true;
    // record best time for this level
    this.store.setBestTime(this.store.level, this.levelTime);
    // compute star rating
    const stars = this.computeStars();
    this.store.setStars(this.store.level, stars);
    // accumulate total kicks + max level reached (persisted)
    this.store.addKicksTotal(this.store.kicks);
    this.store.setMaxLevelReached(Math.max(this.store.level + 1, this.store.level));
    // build last level result
    this.store.setLastLevelResult({
      level: this.store.level,
      stars,
      time: this.levelTime,
      detections: this.store.detectionsThisLevel,
      damage: this.store.damageThisLevel,
    });
    // check achievements
    this.checkAchievements(stars);
    if (this.store.level >= LEVELS.length) {
      // victory
      audio.victory();
      this.store.unlockAchievement("level7", "通关大吉");
      this.screen = "victory";
      this.store.setScreen("victory");
    } else {
      this.store.setScreen("level-transition");
    }
  }

  // Star rating: 3 stars = no damage + no detection; 2 stars = ≤1 detection or damage; 1 star = completed
  private computeStars(): number {
    const dmg = this.store.damageThisLevel;
    const det = this.store.detectionsThisLevel;
    if (dmg === 0 && det === 0) return 3;
    if (det <= 1 && dmg <= 1) return 2;
    return 1;
  }

  private checkAchievements(stars: number) {
    const s = this.store;
    // first blood — first successful kick (already done in performHitCheck)
    // perfect — 3 stars on any level
    if (stars === 3) s.unlockAchievement("perfect", "完美通关：零伤害零发现");
    // stealth — completed a level with 0 detections
    if (s.detectionsThisLevel === 0) s.unlockAchievement("stealth", "潜行达人：零发现");
    // speedrun — level 1 under 30s
    if (s.level === 1 && this.levelTime < 30) s.unlockAchievement("speedrun", "速通达人：30秒内通关");
    // combo achievements
    if (s.comboMax >= 5) s.unlockAchievement("combo5", "连击5次");
    if (s.comboMax >= 10) s.unlockAchievement("combo10", "连击大师：10连击");
    // pacifist_kick — completed a level using only kicks (no weapons used)
    // tracked via this.usedWeaponThisLevel flag
    if (!this.usedWeaponThisLevel) s.unlockAchievement("pacifist_kick", "徒手行者：全程只用脚踹");
    // no_items — completed a level using 0 consumable items
    if (!this.usedItemsThisLevel) s.unlockAchievement("no_items", "极简主义者：全程不用道具");
    // surviver — reached level 5
    if (s.level >= 5) s.unlockAchievement("surviver", "职场幸存者：到达第5关");
    // kicker_100 — total kicks across run reaches 100 (approximate via comboMax + level)
    if (s.kicks >= 50) s.unlockAchievement("kicker_100", "踹击狂人：单关50+踹击");
  }
  private usedWeaponThisLevel = false;
  private usedItemsThisLevel = false;
  private wasEnragedLastFrame = false;

  // ===== screen change from store (buttons) =====
  private onScreenChange(screen: string) {
    if (screen === "playing" && this.screen !== "playing") {
      // start / next level / restart
      this.startLevel(this.store.level);
    } else if (screen === "fps") {
      this.enterFPS();
    }
  }

  startGame() {
    this.store.resetRun();
    this.startLevel(1);
    this.store.setScreen("playing");
  }

  // Boss variant per level: 1-2 normal, 3-4 glasses, 5 coffee, 6 headphones, 7 rage
  private variantForLevel(level: number): "normal" | "glasses" | "coffee" | "headphones" | "rage" {
    if (level >= 7) return "rage";
    if (level >= 6) return "headphones";
    if (level === 5) return "coffee";
    if (level >= 3) return "glasses";
    return "normal";
  }

  // Boss max HP per level: 1-2 → 1, 3-4 → 2, 5-6 → 3, 7 → 4
  private bossMaxHpForLevel(level: number): number {
    if (level >= 7) return 4;
    if (level >= 5) return 3;
    if (level >= 3) return 2;
    return 1;
  }

  private startLevel(level: number) {
    // reset player
    this.px = WORLD.playerStart.x;
    this.pz = WORLD.playerStart.z;
    this.pfacing = Math.PI;
    this.ptargetFacing = Math.PI;
    this.pvel.set(0, 0, 0);
    this.kickCd = 0;
    this.attackAnim = 0;
    this.attackType = null;
    this.attackWeapon = null;
    this.charging = false;
    this.tSpeed = 0;
    this.tInvis = 0;
    this.tCombo = 0;
    this.levelTime = 0;
    this.levelStartTime = performance.now() / 1000;
    this.screenShake = 0;
    this.hitFlashTimer = 0;
    this.usedWeaponThisLevel = false;
    this.usedItemsThisLevel = false;
    this.wasEnragedLastFrame = false;
    // reset run stats
    this.store.resetRunStats();
    this.hitFlashLight.intensity = 0;
    this.tShield = 0;
    this.showShieldMesh(false);
    // clear items
    for (const it of this.items) {
      this.scene.remove(it.mesh);
      it.mesh.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    }
    this.items = [];
    this.itemSpawnTimer = ITEM_SPAWN.interval;
    // clear projectiles
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.projectiles = [];
    // clear smoke clouds
    for (const s of this.smokeClouds) {
      this.scene.remove(s.group);
      s.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    }
    this.smokeClouds = [];
    // boss reset with difficulty scaling + variant + HP (higher levels = faster boss + different variants)
    this.boss.setDifficulty(level);
    const variant = this.variantForLevel(level);
    this.boss.setVariant(variant);
    this.boss.bossMaxHP = this.bossMaxHpForLevel(level);
    this.boss.bossHP = this.boss.bossMaxHP;
    this.boss.reset(level);
    // store
    this.store.setKicks(0);
    this.store.setHp(MAX_HP);
    this.store.setStatus({
      hidden: false,
      invisible: false,
      spedUp: false,
      combo: false,
      shieldActive: false,
      patrolWarn: false,
    });
    this.store.setBossDialogue(null);
    this.screen = "playing";
    this.paused = false;
    audio.startBgMusic();
    // apply user settings
    audio.setVolume(this.store.settings.volume);
    audio.setEnabled(this.store.soundOn);
    // start variant-specific ambient sound + first-time tutorial
    if (variant !== "normal") {
      audio.setVariantAmbient(variant);
      if (!this.store.seenVariants[variant]) {
        // defer to next tick so React can mount the playing screen first
        setTimeout(() => {
          this.store.showVariantTutorial({ variant } as { variant: "glasses" | "coffee" | "headphones" | "rage" });
          audio.uiPopup();
        }, 600);
        this.store.markVariantSeen(variant);
      }
    } else {
      audio.setVariantAmbient("normal");
    }
  }

  restartGame() {
    this.store.resetRun();
    this.startLevel(1);
    this.store.setScreen("playing");
  }

  nextLevel() {
    const next = this.store.level + 1;
    this.store.setLevel(next);
    this.startLevel(next);
    this.store.setScreen("playing");
  }

  // start a specific level (for level select / replay)
  startAtLevel(level: number) {
    this.store.resetRun();
    this.store.setLevel(level);
    this.startLevel(level);
    this.store.setScreen("playing");
  }

  // ===== FPS =====
  private enterFPS() {
    this.paused = true;
    this.screen = "fps";
    audio.stopBgMusic();
    this.fpsMode = new FPSMode(this.renderer, this.renderer.domElement, {
      onTimeChange: (t) => this.store.setFps({ timeLeft: t }),
      onWeaponChange: (w) => this.store.setFps({ weapon: w }),
      onScoreChange: (s) => this.store.setFps({ score: s }),
      onBossLine: (line) => {
        this.store.setBossDialogue(line);
        setTimeout(() => this.store.setBossDialogue(null), 1800);
      },
      onEnd: () => this.exitFPS(),
    });
    this.fpsMode.start();
  }

  private exitFPS() {
    if (this.fpsMode) {
      this.fpsMode.stop();
      this.fpsMode = null;
    }
    // return to level transition
    this.store.setBossDialogue(null);
    this.store.setScreen("level-transition");
    this.screen = "level-transition";
    audio.startBgMusic();
  }

  // ===== items =====
  private spawnItem() {
    if (this.items.length >= ITEM_SPAWN.maxItems) return;
    const kind = rollItemKind();
    // random position not too close to boss or player
    let x = 0,
      z = 0,
      tries = 0;
    do {
      x = (Math.random() * 2 - 1) * (WORLD.half - 1.5);
      z = (Math.random() * 2 - 1) * (WORLD.half - 1.5);
      tries++;
      const dbx = x - this.boss.x;
      const dbz = z - this.boss.z;
      const dpx = x - this.px;
      const dpz = z - this.pz;
      if (dbx * dbx + dbz * dbz > 9 && dpx * dpx + dpz * dpz > 4) break;
    } while (tries < 20);
    const group = new THREE.Group();
    const color = itemColor(kind);
    // base platform
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.4, 0.12, 12),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.8,
        flatShading: true,
      })
    );
    base.position.y = 0.06;
    group.add(base);
    // beam
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.2, 0.5, 8),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.25,
      })
    );
    beam.position.y = 0.35;
    group.add(beam);
    // emoji sprite (icon)
    const sprite = makeEmojiSprite(itemIcon(kind), 128);
    sprite.position.set(0, 0.7, 0);
    sprite.scale.set(0.55, 0.55, 1);
    group.add(sprite);
    group.position.set(x, ITEM_SPAWN.yFloat, z);
    this.scene.add(group);
    this.items.push({ kind, mesh: group, baseY: ITEM_SPAWN.yFloat, phase: Math.random() * Math.PI * 2 });
  }

  private tryPickupNearby() {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      const dx = it.mesh.position.x - this.px;
      const dz = it.mesh.position.z - this.pz;
      if (dx * dx + dz * dz < WORLD.pickupRange * WORLD.pickupRange) {
        const ok = this.store.addItem(it.kind, 1);
        if (ok) {
          audio.pickup();
          this.store.pushToast(`拾取了 ${itemName(it.kind)}`, "good");
          this.scene.remove(it.mesh);
          it.mesh.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.geometry.dispose();
              (o.material as THREE.Material).dispose();
            }
          });
          this.items.splice(i, 1);
        } else {
          this.store.pushToast("背包已满", "warn");
        }
      }
    }
  }

  // ===== collision =====
  private collidesAt(x: number, z: number): boolean {
    const r = WORLD.playerRadius;
    for (const c of this.office.colliders) {
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
        return true;
      }
    }
    return false;
  }

  // ===== main loop =====
  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());

    if (!this.paused && this.screen === "playing") {
      this.updatePlayer(dt);
      this.updateAttack(dt);
      this.updateThrow(dt);
      this.updateItems(dt);
      this.updateProjectiles(dt);
      this.updateParticles(dt);
      this.updateSmokeClouds(dt);
      this.updateBoss(dt);
      this.updateStatusEffects(dt);
      this.updateHUD(dt);
      this.updateCamera(dt);
      this.updateHitFlash(dt);
      this.updateLevelTimer(dt);
      this.updateMinimap();
    }
    // always render (so fps mode overlay transitions are clean) — but fps mode renders itself
    if (this.screen !== "fps") {
      this.renderer.render(this.scene, this.camera);
    }
  };

  private updatePlayer(dt: number) {
    // movement — W = forward (up screen, toward boss = -Z), S = back (+Z)
    let mx = 0;
    let mz = 0;
    if (this.keys["w"]) mz -= 1;
    if (this.keys["s"]) mz += 1;
    if (this.keys["a"]) mx -= 1;
    if (this.keys["d"]) mx += 1;
    const len = Math.sqrt(mx * mx + mz * mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
      let speed = WORLD.playerSpeed;
      if (this.tSpeed > 0) speed *= 2;
      // movement in world space (camera is iso, but WASD = world axes for simplicity)
      const dx = mx * speed * dt;
      const dz = mz * speed * dt;
      // collision with sliding
      let nx = this.px + dx;
      let nz = this.pz + dz;
      if (this.collidesAt(nx, this.pz)) nx = this.px;
      if (this.collidesAt(nx, nz)) nz = this.pz;
      // bounds
      nx = Math.max(-WORLD.half + 0.6, Math.min(WORLD.half - 0.6, nx));
      nz = Math.max(-WORLD.half + 0.6, Math.min(WORLD.half - 0.6, nz));
      this.px = nx;
      this.pz = nz;
      // facing = movement direction
      this.ptargetFacing = Math.atan2(mx, mz);
      // walk anim
      this.walkPhase += dt * 10;
    } else {
      // idle — ease legs
      this.walkPhase += dt * 2;
    }
    // smooth facing
    const diff = this.angleDiff(this.ptargetFacing, this.pfacing);
    this.pfacing += diff * Math.min(1, dt * 12);
    this.playerGroup.rotation.y = this.pfacing;
    this.playerGroup.position.x = this.px;
    this.playerGroup.position.z = this.pz;

    // walk anim
    const swing = Math.sin(this.walkPhase) * (len > 0 ? 0.5 : 0.05);
    this.playerLeftLeg.rotation.x = swing;
    this.playerRightLeg.rotation.x = -swing;
    if (this.attackAnim <= 0) {
      this.playerLeftArm.rotation.x = -swing * 0.6;
      // right arm controlled by attack anim or idle
      if (this.attackType === null) {
        this.playerRightArm.rotation.x = swing * 0.4;
      }
    }

    // pickup auto
    this.tryPickupNearby();
  }

  private angleDiff(target: number, current: number): number {
    let d = target - current;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  private updateAttack(dt: number) {
    if (this.attackAnim > 0) {
      this.attackAnim -= dt;
      const t = 1 - this.attackAnim / this.attackAnimDur; // 0..1 progress
      if (this.attackType === "kick") {
        // right leg kicks forward
        this.playerRightLeg.rotation.x = -Math.sin(t * Math.PI) * 1.2;
        // small body lean
        this.playerGroup.rotation.x = -Math.sin(t * Math.PI) * 0.15;
      } else if (this.attackType === "swing" && this.attackWeapon) {
        // right arm swings weapon over arc
        const swing = Math.sin(t * Math.PI);
        this.playerRightArm.rotation.x = -swing * 1.6;
        this.playerRightArm.rotation.z = swing * 0.4;
      }
      // hit detection at mid-swing
      if (!this.attackHasHit && t >= 0.4 && t <= 0.8) {
        this.performHitCheck();
        this.attackHasHit = true;
      }
      if (this.attackAnim <= 0) {
        // end
        this.playerGroup.rotation.x = 0;
        if (this.attackType === "swing") {
          this.playerRightArm.rotation.x = 0;
          this.playerRightArm.rotation.z = 0;
        }
        this.attackType = null;
        this.attackWeapon = null;
      }
    }
    // cooldown
    if (this.kickCd > 0) this.kickCd -= dt;
  }

  private performHitCheck() {
    const range = this.attackWeapon ? WEAPONS[this.attackWeapon].range : WORLD.kickRange;
    const dx = this.boss.x - this.px;
    const dz = this.boss.z - this.pz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > range + WORLD.bossRadius) return;
    // also require roughly in front
    const fwd = new THREE.Vector3(Math.sin(this.pfacing), 0, Math.cos(this.pfacing));
    const toBoss = new THREE.Vector3(dx, 0, dz).normalize();
    if (fwd.dot(toBoss) < 0.3) return; // not in front enough

    if (this.attackType === "kick") {
      audio.kickHit();
      const ok = this.boss.triggerAttacked(1, 0, this.makeBossCtx());
      if (ok) {
        this.store.setKicks(this.store.kicks + 1);
        this.store.incCombo();
        // combo audio (pitch rises with combo)
        audio.kickHitCombo(this.store.currentCombo);
        // first blood achievement
        this.store.unlockAchievement("first_blood", "初次踹击：开门红");
        this.checkLevelComplete();
      }
    } else if (this.attackType === "swing" && this.attackWeapon) {
      const def = WEAPONS[this.attackWeapon];
      audio.kickHit();
      this.usedWeaponThisLevel = true;
      // swing hit: stun time if not 0 (we use def.stun for stun-from-swing)
      const ok = this.boss.triggerAttacked(def.hits, 0, this.makeBossCtx());
      if (ok) {
        // award hits count
        this.store.setKicks(this.store.kicks + def.hits);
        this.store.incCombo();
        audio.kickHitCombo(this.store.currentCombo);
        // weapon master — used a weapon successfully
        this.store.unlockAchievement("weapon_master", "武器行者：使用武器命中");
        this.checkLevelComplete();
      }
    }
  }

  private checkLevelComplete() {
    if (this.store.kicks >= this.store.target) {
      this.triggerLevelComplete();
    }
  }

  private updateThrow(dt: number) {
    if (this.charging) {
      // sinusoidal oscillation 0..1
      this.chargeVal += this.chargeDir * dt * 1.5;
      if (this.chargeVal >= 1) {
        this.chargeVal = 1;
        this.chargeDir = -1;
      } else if (this.chargeVal <= 0) {
        this.chargeVal = 0;
        this.chargeDir = 1;
      }
      this.store.setThrowCharge(this.chargeVal);
      if (Math.random() < 0.3) audio.throwCharge();
    }
  }

  private updateItems(dt: number) {
    this.itemSpawnTimer -= dt;
    if (this.itemSpawnTimer <= 0) {
      this.itemSpawnTimer = ITEM_SPAWN.interval;
      this.spawnItem();
    }
    for (const it of this.items) {
      it.phase += dt * 2;
      it.mesh.position.y = it.baseY + Math.sin(it.phase) * 0.2;
      it.mesh.rotation.y += dt * 1.5;
      // magnet effect: when player within 2.5u, drift item toward player
      const dx = this.px - it.mesh.position.x;
      const dz = this.pz - it.mesh.position.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 2.5 && d > 0.01) {
        const pull = (1 - d / 2.5) * 2.5 * dt; // stronger when closer
        it.mesh.position.x += (dx / d) * pull;
        it.mesh.position.z += (dz / d) * pull;
      }
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.mesh.rotation.z += dt * 8;
      p.life -= dt;
      // hit boss?
      const dx = p.mesh.position.x - this.boss.x;
      const dz = p.mesh.position.z - this.boss.z;
      const dy = p.mesh.position.y - 1.2;
      const d = Math.sqrt(dx * dx + dz * dz + dy * dy);
      if (d < WORLD.bossRadius + 0.4) {
        const def = WEAPONS[p.weapon];
        audio.stun();
        const ok = this.boss.triggerAttacked(def.hits, def.stun, this.makeBossCtx());
        if (ok) {
          this.store.setKicks(this.store.kicks + def.hits);
          this.checkLevelComplete();
        }
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(i, 1);
        continue;
      }
      // out of bounds or life
      if (p.life <= 0 || Math.abs(p.mesh.position.x) > WORLD.half + 2 || Math.abs(p.mesh.position.z) > WORLD.half + 2 || p.mesh.position.y < 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vel.y -= 5 * dt;
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.life -= dt;
      const t = p.life / p.maxLife;
      // sprite vs mesh handling
      if (p.mesh instanceof THREE.Sprite) {
        const mat = p.mesh.material as THREE.SpriteMaterial;
        if (mat) mat.opacity = Math.max(0, t);
        // grow slightly then shrink
        const s = 0.8 + (1 - t) * 0.4;
        p.mesh.scale.set(1.2 * s, 0.6 * s, 1);
      } else {
        const mat = p.mesh.material as THREE.MeshBasicMaterial;
        if (mat) mat.opacity = Math.max(0, t);
        const geo = p.mesh.geometry as THREE.BufferGeometry;
        if (geo instanceof THREE.RingGeometry) {
          const s = 1 + (1 - t) * 4;
          p.mesh.scale.set(s, s, s);
        }
      }
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        if (!(p.mesh instanceof THREE.Sprite)) p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  private updateBoss(dt: number) {
    const ctx = this.makeBossCtx(dt);
    this.boss.update(ctx);
  }

  private makeBossCtx(dt = 0) {
    const hidden = this.isPlayerHidden();
    const invisible = this.tInvis > 0;
    const shield = this.tShield > 0;
    const obscured = this.isPlayerObscuredBySmoke();
    return {
      playerPos: new THREE.Vector3(this.px, 0, this.pz),
      playerHidden: hidden,
      playerInvisible: invisible,
      playerShield: shield,
      playerShieldUsed: this.shieldUsedThisCycle,
      playerObscuredBySmoke: obscured,
      isPlayerAttacking: this.attackAnim > 0,
      dt: dt,
      time: performance.now() / 1000,
      colliders: this.office.colliders,
    };
  }

  private isPlayerHidden(): boolean {
    return this.boss.isPlayerHiddenAt(new THREE.Vector3(this.px, 0, this.pz));
  }

  private updateStatusEffects(dt: number) {
    if (this.tSpeed > 0) this.tSpeed -= dt;
    if (this.tInvis > 0) this.tInvis -= dt;
    if (this.tCombo > 0) this.tCombo -= dt;
    if (this.tShield > 0) {
      this.tShield -= dt;
      if (this.tShield <= 0) this.showShieldMesh(false);
    }
    // update store status
    this.store.setStatus({
      hidden: this.isPlayerHidden(),
      invisible: this.tInvis > 0,
      spedUp: this.tSpeed > 0,
      combo: this.tCombo > 0,
      shieldActive: this.tShield > 0,
      patrolWarn: this.boss.state === "Patrol",
    });
    // invisibility visual
    const opacity = this.tInvis > 0
      ? this.tInvis < 1.5
        ? (Math.floor(this.tInvis * 8) % 2 === 0 ? 0.4 : 0.8)
        : 0.4
      : 1;
    this.playerGroup.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const mat = o.material as THREE.MeshStandardMaterial;
        mat.transparent = opacity < 1;
        mat.opacity = opacity;
      }
    });
    // status icon
    this.updateStatusIcon();
    // weapon in hand when equipped changes
    const w = this.store.equippedWeapon;
    const hasWeapon = this.weaponInHand !== null;
    if ((w && !hasWeapon) || (!w && hasWeapon) || (w && hasWeapon && this.lastEquipped !== w)) {
      this.updateWeaponInHand();
      this.lastEquipped = w;
    }
  }
  private lastEquipped: WeaponKind | null = null;

  private updateStatusIcon() {
    const mat = this.statusIcon.material as THREE.SpriteMaterial;
    let emoji = "";
    if (this.tInvis > 0) emoji = "🧪";
    else if (this.tSpeed > 0) emoji = "👟";
    else if (this.tCombo > 0) emoji = "🥊";
    else if (this.tShield > 0) emoji = "⌨️";
    if (emoji) {
      if (this.currentStatusEmoji !== emoji) {
        if (mat.map) mat.map.dispose();
        mat.map = (makeEmojiSprite(emoji, 128).material as THREE.SpriteMaterial).map;
        mat.needsUpdate = true;
        this.currentStatusEmoji = emoji;
      }
      mat.opacity = 0.95;
    } else {
      mat.opacity = 0;
    }
  }
  private currentStatusEmoji = "";

  private updateHUD(dt: number) {
    // cooldown bar (0..1, 1 = ready)
    const cd = this.tCombo > 0 ? 1 : Math.max(0, 1 - this.kickCd / WORLD.kickCooldown);
    const ready = cd >= 1;
    this.cooldownBar.scale.x = Math.max(0.001, cd);
    this.cooldownBar.position.x = -(1 - this.cooldownBar.scale.x) * 0.5;
    (this.cooldownBar.material as THREE.MeshBasicMaterial).color.set(
      ready ? 0x4ade80 : 0xf87171
    );
    // show bar only when not ready
    const showBar = !ready;
    this.cooldownBar.visible = showBar;
    this.cooldownBarBg.visible = showBar;
    // store cooldown mirror
    this.store.setKickCooldown(cd);
    // detect flash
    if (this.detectFlashTimer > 0) {
      this.detectFlashTimer -= dt;
    }
  }

  private updateCamera(dt: number) {
    const target = new THREE.Vector3(
      this.px + this.camOffset.x,
      this.camOffset.y,
      this.pz + this.camOffset.z
    );
    this.camera.position.lerp(target, Math.min(1, dt * 5));
    // screen shake
    const sh = this.screenShake;
    this.screenShake = Math.max(0, this.screenShake - dt * 2.5);
    const lookX = this.px + (Math.random() - 0.5) * sh * 0.4;
    const lookY = 1 + (Math.random() - 0.5) * sh * 0.4;
    const lookZ = this.pz + (Math.random() - 0.5) * sh * 0.4;
    this.camera.lookAt(lookX, lookY, lookZ);
  }

  private updateHitFlash(dt: number) {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      // pulse intensity (fade out)
      const t = Math.max(0, this.hitFlashTimer / 0.35);
      this.hitFlashLight.intensity = t * 4;
    } else {
      this.hitFlashLight.intensity = 0;
    }
  }

  private updateLevelTimer(dt: number) {
    this.levelTime += dt;
  }

  private updateMinimap() {
    // build minimap data from current engine state
    const items = this.items.map((it) => ({
      x: it.mesh.position.x,
      z: it.mesh.position.z,
      kind: it.kind,
    }));
    const hidingSpots = HIDING_SPOTS.map((s) => ({
      x: s.x,
      z: s.z,
      w: s.w,
      d: s.d,
      id: s.id,
    }));
    // determine vision data
    let patrolCone: { range: number; angleDeg: number } | undefined;
    let halfRange: number | undefined;
    const bs = this.boss.state;
    if (bs === "Patrol" && (this.boss.phaseName === "p_patrol" || this.boss.phaseName === "p_return")) {
      patrolCone = { range: 7, angleDeg: 80 };
    } else if (bs === "Normal") {
      halfRange = 5;
    } else if (bs === "LookingBack" && this.boss.phaseName === "observe") {
      halfRange = 6;
    } else if (bs === "Attacked" && this.boss.phaseName === "a_observe") {
      halfRange = 5;
    }
    this.store.setMinimap({
      px: this.px,
      pz: this.pz,
      pfacing: this.pfacing,
      bx: this.boss.x,
      bz: this.boss.z,
      bfacing: this.boss.facingY,
      bossLookDir: this.boss.targetFacingY,
      bossState: bs,
      bossVariant: this.boss.variant,
      bossHP: this.boss.bossHP,
      bossMaxHP: this.boss.bossMaxHP,
      bossEnraged: this.boss.isEnraged(),
      suspicion: this.boss.suspicion,
      patrolCone,
      halfRange,
      items,
      hidingSpots,
      levelTime: this.levelTime,
    });
    // tense music when boss is alert (suspicion high, or in LookingBack/Attacked/Patrol states)
    const isTense =
      this.boss.suspicion > 0.5 ||
      this.boss.state === "LookingBack" ||
      this.boss.state === "Attacked" ||
      this.boss.state === "Patrol";
    audio.setTense(isTense);
    // rage enrage-state transition: play roar when entering enrage
    const isEnragedNow = this.boss.isEnraged();
    if (isEnragedNow && !this.wasEnragedLastFrame) {
      audio.rageRoar();
      this.store.pushEventBanner("老板暴怒了！立即躲藏！", "🔥", "bg-red-800/95 border-red-300 animate-pulse");
    }
    this.wasEnragedLastFrame = isEnragedNow;
  }

  // ===== cleanup =====
  dispose() {
    cancelAnimationFrame(this.raf);
    if (this.fpsMode) this.fpsMode.stop();
    window.removeEventListener("keydown", this.boundKeyDown);
    window.removeEventListener("keyup", this.boundKeyUp);
    window.removeEventListener("keydown", this.boundNumKey);
    window.removeEventListener("mouseup", this.boundMouseUp);
    window.removeEventListener("resize", this.boundResize);
    this.renderer.domElement.removeEventListener("mousedown", this.boundMouseDown);
    this.renderer.domElement.removeEventListener("contextmenu", this.boundContextMenu);
    if (this.unsubStore) this.unsubStore();
    audio.stopBgMusic();
    audio.stopVariantAmbient();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
