import * as THREE from "three";
import { FPS_MODE, BOSS_LINES } from "../constants";
import { audio } from "../audio/AudioManager";

type FpsWeaponKind = "laser" | "rocket" | "grenade";

interface FpsCallbacks {
  onTimeChange: (t: number) => void;
  onWeaponChange: (w: FpsWeaponKind) => void;
  onScoreChange: (s: number) => void;
  onEnd: () => void;
  onBossLine: (line: string) => void;
}

interface Bullet {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  kind: FpsWeaponKind;
  life: number;
  trail?: THREE.Mesh;
}

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  fade: boolean;
  spin: number;
}

export class FPSMode {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private cb: FpsCallbacks;
  private canvas: HTMLCanvasElement;

  private weapon: FpsWeaponKind;
  private timeLeft = FPS_MODE.duration;
  private score = 0;
  private running = false;
  private raf = 0;
  private lastTime = 0;

  // camera look
  private yaw = 0;
  private pitch = 0;
  private targetYaw = 0;
  private targetPitch = 0;

  // shooting
  private lastShot = 0;
  private bullets: Bullet[] = [];
  private particles: Particle[] = [];

  // boss
  private bossGroup: THREE.Group;
  private bossX = -6;
  private bossDir = 1;
  private bossSpeed = 2.5;
  private bossStun = 0;
  private bossShake = 0;
  private bossJumpV = 0;
  private bossY = 0;
  private bossHead: THREE.Group;
  private bossBody: THREE.Mesh;

  // right hand + weapon
  private handGroup: THREE.Group;
  private weaponMesh: THREE.Group;
  private handRecoil = 0;
  private handSwayX = 0;
  private handSwayY = 0;

  // crosshair handled in DOM
  // listeners
  private onMouseMove: (e: MouseEvent) => void;
  private onMouseDown: (e: MouseEvent) => void;
  private onPointerLockChange: () => void;
  private onKey: (e: KeyboardEvent) => void;

  // grenade aim arc
  private aimLine: THREE.Line | null = null;
  private aimDot: THREE.Mesh | null = null;
  private grenadeArc = 0.5; // 0..1 controlled by mouse Y while charging

  // screen shake
  private shakeAmount = 0;

  // bound
  private boundLoop: (t: number) => void;

  constructor(
    renderer: THREE.WebGLRenderer,
    canvas: HTMLCanvasElement,
    cb: FpsCallbacks
  ) {
    this.renderer = renderer;
    this.canvas = canvas;
    this.cb = cb;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2a);
    this.scene.fog = new THREE.Fog(0x1a1a2a, 10, 40);
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(
      FPS_MODE.playerPos.x,
      FPS_MODE.playerPos.y,
      FPS_MODE.playerPos.z
    );

    // random weapon
    const kinds: FpsWeaponKind[] = ["laser", "rocket", "grenade"];
    this.weapon = kinds[Math.floor(Math.random() * kinds.length)];
    this.cb.onWeaponChange(this.weapon);

    this.bossGroup = new THREE.Group();
    this.bossHead = new THREE.Group();
    this.bossBody = new THREE.Mesh();
    this.handGroup = new THREE.Group();
    this.weaponMesh = new THREE.Group();
    this.boundLoop = this.loop.bind(this);

    this.onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== this.canvas) return;
      const sens = 0.0025;
      this.targetYaw -= e.movementX * sens;
      this.targetPitch -= e.movementY * sens;
      this.targetPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.targetPitch));
      // grenade arc control
      if (this.weapon === "grenade") {
        this.grenadeArc = 0.5 + (this.targetPitch / (Math.PI / 2));
        this.grenadeArc = Math.max(0.1, Math.min(0.9, this.grenadeArc));
      }
    };
    this.onMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock();
        return;
      }
      if (e.button === 0) this.tryShoot();
    };
    this.onPointerLockChange = () => {
      // could pause; we keep going
    };
    this.onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        document.exitPointerLock();
      }
    };
  }

  start() {
    this.running = true;
    this.buildScene();
    this.buildBoss();
    this.buildHand();
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    window.addEventListener("keydown", this.onKey);
    this.canvas.requestPointerLock();
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.boundLoop);
    audio.startBgMusic();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    window.removeEventListener("keydown", this.onKey);
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
    // dispose
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material?.dispose();
      }
    });
  }

  private mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.1,
      flatShading: true,
      ...opts,
    });
  }

  private buildScene() {
    // lights
    const amb = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 5);
    this.scene.add(dir);
    const fill = new THREE.PointLight(0xff8844, 0.6, 30);
    fill.position.set(0, 4, -5);
    this.scene.add(fill);

    // floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      this.mat(0x3a2a4a, { roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    // grid
    const grid = new THREE.GridHelper(40, 40, 0x6a4a8a, 0x4a3a6a);
    this.scene.add(grid);

    // back wall
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(20, 6, 0.4),
      this.mat(0x4a3a5a)
    );
    wall.position.set(0, 3, -8);
    this.scene.add(wall);
    // side walls
    const wL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 20), this.mat(0x4a3a5a));
    wL.position.set(-10, 3, 0);
    this.scene.add(wL);
    const wR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 20), this.mat(0x4a3a5a));
    wR.position.set(10, 3, 0);
    this.scene.add(wR);

    // some cover boxes
    for (let i = 0; i < 5; i++) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        this.mat(0x5a4a6a)
      );
      box.position.set(
        -8 + i * 4,
        0.5,
        -3 + (i % 2) * -1
      );
      box.castShadow = true;
      this.scene.add(box);
    }

    // countdown 3D text-ish (use a sprite)
    this.buildCountdownSprite();

    // aim line for grenade
    const aimGeo = new THREE.BufferGeometry();
    aimGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Array(60 * 3).fill(0), 3));
    const aimMat = new THREE.LineBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.7 });
    this.aimLine = new THREE.Line(aimGeo, aimMat);
    this.aimLine.visible = false;
    this.scene.add(this.aimLine);
    const dotGeo = new THREE.RingGeometry(0.3, 0.5, 24);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    this.aimDot = new THREE.Mesh(dotGeo, dotMat);
    this.aimDot.rotation.x = -Math.PI / 2;
    this.aimDot.visible = false;
    this.scene.add(this.aimDot);
  }

  private countdownSprite: THREE.Sprite | null = null;
  private buildCountdownSprite() {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.font = "bold 80px sans-serif";
    ctx.fillStyle = "#ffcc00";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 6;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText("30", 256, 64);
    ctx.fillText("30", 256, 64);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    this.countdownSprite = new THREE.Sprite(mat);
    this.countdownSprite.position.set(0, 4, -6);
    this.countdownSprite.scale.set(3, 0.75, 1);
    this.scene.add(this.countdownSprite);
  }

  private updateCountdownSprite(t: number) {
    if (!this.countdownSprite) return;
    const c = this.countdownSprite.material.map!.image as HTMLCanvasElement;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.font = "bold 80px sans-serif";
    ctx.fillStyle = t <= 5 ? "#ff4444" : "#ffcc00";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 6;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const txt = String(Math.ceil(t));
    ctx.strokeText(txt, 256, 64);
    ctx.fillText(txt, 256, 64);
    this.countdownSprite.material.map!.needsUpdate = true;
  }

  private buildBoss() {
    const g = new THREE.Group();
    const suitMat = this.mat(0x2a3a5a);
    const skinMat = this.mat(0xf2c9a0);
    const hairMat = this.mat(0x2a1a0a);
    const shoeMat = this.mat(0x111111);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.45), suitMat);
    torso.position.y = 1.3;
    torso.castShadow = true;
    g.add(torso);
    const belly = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), suitMat);
    belly.position.y = 0.9;
    g.add(belly);
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.02), this.mat(0xcc2222));
    tie.position.set(0, 1.35, 0.23);
    g.add(tie);

    const headGroup = new THREE.Group();
    headGroup.position.y = 2.0;
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.45), skinMat);
    headGroup.add(headMesh);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), hairMat);
    hair.position.y = 0.23;
    headGroup.add(hair);
    for (const sx of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.02), this.mat(0x111111));
      eye.position.set(sx, 0.02, 0.24);
      headGroup.add(eye);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.02), this.mat(0x6a3a2a));
    mouth.position.set(0, -0.15, 0.24);
    headGroup.add(mouth);
    this.bossHead = headGroup;
    g.add(headGroup);

    // arms
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(sx * 0.5, 1.65, 0);
      const ua = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.22), suitMat);
      ua.position.y = -0.28;
      arm.add(ua);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.2), skinMat);
      hand.position.y = -0.62;
      arm.add(hand);
      g.add(arm);
    }
    // legs
    for (const sx of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(sx * 0.2, 0.65, 0);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.55, 0.26), suitMat);
      thigh.position.y = -0.27;
      leg.add(thigh);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.24), suitMat);
      shin.position.y = -0.78;
      leg.add(shin);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.13, 0.36), shoeMat);
      shoe.position.set(0, -1.05, 0.06);
      leg.add(shoe);
      g.add(leg);
    }
    this.bossBody = torso;
    g.position.set(this.bossX, 0, -5);
    this.bossGroup = g;
    this.scene.add(g);
  }

  private buildHand() {
    const g = new THREE.Group();
    // arm
    const armMat = this.mat(0xf2c9a0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.8), armMat);
    arm.position.set(0, -0.1, -0.4);
    g.add(arm);
    // sleeve
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), this.mat(0x2a3a5a));
    sleeve.position.set(0, -0.1, -0.1);
    g.add(sleeve);
    // weapon mesh (rebuilt per weapon)
    this.rebuildWeaponMesh();
    g.add(this.weaponMesh);
    // attach to camera
    this.camera.add(g);
    this.scene.add(this.camera);
    g.position.set(0.45, -0.4, -0.6);
    this.handGroup = g;
  }

  private rebuildWeaponMesh() {
    // clear
    while (this.weaponMesh.children.length) {
      const c = this.weaponMesh.children[0];
      this.weaponMesh.remove(c);
      if (c instanceof THREE.Mesh) {
        c.geometry.dispose();
        (c.material as THREE.Material).dispose();
      }
    }
    if (this.weapon === "laser") {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 0.6),
        this.mat(0x444444, { metalness: 0.6 })
      );
      body.position.set(0, 0, -0.4);
      this.weaponMesh.add(body);
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8),
        this.mat(0x222222)
      );
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0, -0.7);
      this.weaponMesh.add(barrel);
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        this.mat(0x00ffff, { emissive: 0x00ffff, emissiveIntensity: 1 })
      );
      tip.position.set(0, 0, -0.9);
      this.weaponMesh.add(tip);
    } else if (this.weapon === "rocket") {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.2, 0.7),
        this.mat(0x554433, { metalness: 0.5 })
      );
      body.position.set(0, 0, -0.4);
      this.weaponMesh.add(body);
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8),
        this.mat(0x333333)
      );
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0, -0.75);
      this.weaponMesh.add(barrel);
    } else {
      // grenade (just holding a ball)
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 12, 12),
        this.mat(0x3a3a3a, { metalness: 0.4 })
      );
      ball.position.set(0, 0, -0.35);
      this.weaponMesh.add(ball);
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8),
        this.mat(0x666666)
      );
      top.position.set(0, 0.16, -0.35);
      this.weaponMesh.add(top);
    }
  }

  setWeapon(w: FpsWeaponKind) {
    this.weapon = w;
    this.rebuildWeaponMesh();
    this.cb.onWeaponChange(w);
  }

  private tryShoot() {
    const now = performance.now() / 1000;
    const def = FPS_MODE.weapons[this.weapon];
    const interval = 1 / def.fireRate;
    if (now - this.lastShot < interval) return;
    this.lastShot = now;
    this.handRecoil = 1;
    if (this.weapon === "laser") {
      this.shootLaser();
      audio.laserShot();
    } else if (this.weapon === "rocket") {
      this.shootRocket();
      audio.rocketShot();
    } else {
      this.shootGrenade();
      audio.grenadeThrow();
    }
  }

  private getShootDir(): THREE.Vector3 {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return dir;
  }

  private shootLaser() {
    // hitscan with visual tracer
    const origin = this.camera.position.clone();
    const dir = this.getShootDir();
    // tracer bullet (fast)
    const geo = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: FPS_MODE.weapons.laser.color,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin).add(dir.clone().multiplyScalar(0.5));
    mesh.lookAt(origin.clone().add(dir));
    mesh.rotateX(Math.PI / 2);
    this.scene.add(mesh);
    const bullet: Bullet = {
      mesh,
      vel: dir.clone().multiplyScalar(FPS_MODE.weapons.laser.bulletSpeed),
      kind: "laser",
      life: 2,
    };
    this.bullets.push(bullet);
  }

  private shootRocket() {
    const origin = this.camera.position.clone();
    const dir = this.getShootDir();
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.12, 0.4, 4, 8),
      this.mat(0x884422, { emissive: 0x442200, emissiveIntensity: 0.4 })
    );
    mesh.position.copy(origin).add(dir.clone().multiplyScalar(0.6));
    mesh.lookAt(origin.clone().add(dir));
    mesh.rotateX(Math.PI / 2);
    this.scene.add(mesh);
    this.bullets.push({
      mesh,
      vel: dir.clone().multiplyScalar(FPS_MODE.weapons.rocket.bulletSpeed),
      kind: "rocket",
      life: 4,
    });
  }

  private shootGrenade() {
    const origin = this.camera.position.clone();
    const dir = this.getShootDir();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 12, 12),
      this.mat(0x3a3a3a, { metalness: 0.4 })
    );
    mesh.position.copy(origin).add(dir.clone().multiplyScalar(0.6));
    this.scene.add(mesh);
    // add upward arc based on grenadeArc
    const up = new THREE.Vector3(0, 1, 0);
    const vel = dir
      .clone()
      .multiplyScalar(FPS_MODE.weapons.grenade.bulletSpeed)
      .add(up.multiplyScalar(this.grenadeArc * 8));
    this.bullets.push({
      mesh,
      vel,
      kind: "grenade",
      life: 5,
    });
  }

  private explode(pos: THREE.Vector3, radius: number, stun: number) {
    audio.explosion();
    this.shakeAmount = 1;
    // damage boss if within radius
    const bx = this.bossGroup.position.x;
    const by = this.bossGroup.position.y + 1;
    const bz = this.bossGroup.position.z;
    const d = Math.sqrt(
      (pos.x - bx) ** 2 + (pos.y - by) ** 2 + (pos.z - bz) ** 2
    );
    if (d < radius) {
      this.hitBoss("explosion", stun);
    }
    // particles: fire, smoke, sparks, shockwave, flash
    this.spawnExplosionParticles(pos);
  }

  private spawnExplosionParticles(pos: THREE.Vector3) {
    // fire
    for (let i = 0; i < 30; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.12 + Math.random() * 0.12, 6, 6),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.05 + Math.random() * 0.05, 1, 0.5),
          transparent: true,
          opacity: 1,
        })
      );
      mesh.position.copy(pos);
      this.scene.add(mesh);
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();
      this.particles.push({
        mesh,
        vel: dir.multiplyScalar(2 + Math.random() * 4),
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1,
        gravity: -2,
        fade: true,
        spin: 0,
      });
    }
    // smoke
    for (let i = 0; i < 15; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.2 + Math.random() * 0.2, 6, 6),
        new THREE.MeshBasicMaterial({
          color: 0x666666,
          transparent: true,
          opacity: 0.7,
        })
      );
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          1 + Math.random() * 2,
          (Math.random() - 0.5) * 1.5
        ),
        life: 1.2 + Math.random() * 0.6,
        maxLife: 1.8,
        gravity: -0.5,
        fade: true,
        spin: 0,
      });
    }
    // sparks
    for (let i = 0; i < 20; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, 0.05),
        new THREE.MeshBasicMaterial({ color: 0xffff44 })
      );
      mesh.position.copy(pos);
      this.scene.add(mesh);
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();
      this.particles.push({
        mesh,
        vel: dir.multiplyScalar(5 + Math.random() * 5),
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        gravity: -5,
        fade: true,
        spin: 10,
      });
    }
    // shockwave (expanding ring)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.3, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffaa44,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      })
    );
    ring.position.copy(pos);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    this.particles.push({
      mesh: ring as unknown as THREE.Mesh,
      vel: new THREE.Vector3(),
      life: 0.5,
      maxLife: 0.5,
      gravity: 0,
      fade: true,
      spin: 0,
    });
    // flash
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffff88, transparent: true, opacity: 1 })
    );
    flash.position.copy(pos);
    this.scene.add(flash);
    this.particles.push({
      mesh: flash,
      vel: new THREE.Vector3(),
      life: 0.15,
      maxLife: 0.15,
      gravity: 0,
      fade: true,
      spin: 0,
    });
  }

  private hitBoss(kind: "bullet" | "explosion", stun: number) {
    this.score++;
    this.cb.onScoreChange(this.score);
    const line = BOSS_LINES.fps[Math.floor(Math.random() * BOSS_LINES.fps.length)];
    this.cb.onBossLine(line);
    if (kind === "bullet") {
      this.bossShake = 0.5;
      this.bossStun = Math.max(this.bossStun, 0.5);
    } else {
      this.bossStun = Math.max(this.bossStun, stun);
      this.bossJumpV = 5; // bounce up
    }
  }

  private updateBoss(dt: number) {
    if (this.bossStun > 0) {
      this.bossStun -= dt;
      // shake
      this.bossGroup.rotation.z = Math.sin(performance.now() * 0.02) * 0.15;
      // jump (parabolic)
      this.bossJumpV -= 15 * dt;
      this.bossY += this.bossJumpV * dt;
      if (this.bossY < 0) {
        this.bossY = 0;
        this.bossJumpV = 0;
      }
      this.bossGroup.position.y = this.bossY;
      // head spin
      this.bossHead.rotation.y += dt * 8;
    } else {
      this.bossGroup.rotation.z = 0;
      this.bossHead.rotation.y = 0;
      this.bossGroup.position.y = 0;
      this.bossY = 0;
      // walk back and forth
      this.bossX += this.bossDir * this.bossSpeed * dt;
      if (this.bossX > FPS_MODE.bossXRange) {
        this.bossX = FPS_MODE.bossXRange;
        this.bossDir = -1;
      } else if (this.bossX < -FPS_MODE.bossXRange) {
        this.bossX = -FPS_MODE.bossXRange;
        this.bossDir = 1;
      }
      this.bossGroup.position.x = this.bossX;
      // face player direction (face +Z toward player)
      this.bossGroup.rotation.y = 0;
    }
    // bullet shake
    if (this.bossShake > 0) {
      this.bossShake -= dt;
      this.bossGroup.position.x += (Math.random() - 0.5) * 0.1;
    }
  }

  private updateBullets(dt: number) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (b.kind === "grenade") {
        b.vel.y -= 15 * dt; // gravity
      }
      b.mesh.position.add(b.vel.clone().multiplyScalar(dt));
      b.life -= dt;
      // rocket trail
      if (b.kind === "rocket") {
        // smoke trail particle
        const smoke = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 4, 4),
          new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.6 })
        );
        smoke.position.copy(b.mesh.position);
        this.scene.add(smoke);
        this.particles.push({
          mesh: smoke,
          vel: new THREE.Vector3(0, 0.5, 0),
          life: 0.4,
          maxLife: 0.4,
          gravity: 0,
          fade: true,
          spin: 0,
        });
      }
      // hit boss?
      const bx = this.bossGroup.position.x;
      const by = this.bossGroup.position.y + 1;
      const bz = this.bossGroup.position.z;
      const d = b.mesh.position.distanceTo(new THREE.Vector3(bx, by, bz));
      const hitR = b.kind === "laser" ? 0.7 : 0.9;
      if (d < hitR) {
        if (b.kind === "laser") {
          this.hitBoss("bullet", 0.5);
        } else if (b.kind === "rocket") {
          this.explode(b.mesh.position, 2.5, 3);
        } else {
          // grenade
          this.explode(b.mesh.position, 2.0, 3);
        }
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
        this.bullets.splice(i, 1);
        continue;
      }
      // hit ground (grenade)
      if (b.kind === "grenade" && b.mesh.position.y <= 0.1) {
        // bounce then explode after small delay (simplified: explode immediately)
        this.explode(b.mesh.position, 2.0, 3);
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
        this.bullets.splice(i, 1);
        continue;
      }
      // out of bounds / life
      if (b.life <= 0 || Math.abs(b.mesh.position.x) > 15 || b.mesh.position.z < -12 || b.mesh.position.z > 8) {
        if (b.kind === "rocket") {
          this.explode(b.mesh.position, 2.5, 3);
        }
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
        this.bullets.splice(i, 1);
      }
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vel.y += p.gravity * dt;
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.life -= dt;
      const t = p.life / p.maxLife;
      if (p.fade) {
        const mat = p.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, t);
        mat.transparent = true;
      }
      if (p.spin) p.mesh.rotation.x += p.spin * dt;
      // shockwave (ring) grows
      if (p.mesh.geometry instanceof THREE.RingGeometry) {
        const s = 1 + (1 - t) * 6;
        p.mesh.scale.set(s, s, s);
      }
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  private updateGrenadeAim() {
    if (this.weapon !== "grenade") {
      if (this.aimLine) this.aimLine.visible = false;
      if (this.aimDot) this.aimDot.visible = false;
      return;
    }
    // predict arc
    this.camera.updateMatrixWorld();
    const origin = this.camera.position.clone();
    const dir = this.getShootDir();
    if (!isFinite(dir.x) || !isFinite(dir.y) || !isFinite(dir.z)) return;
    const up = new THREE.Vector3(0, 1, 0);
    const vel = dir
      .clone()
      .multiplyScalar(FPS_MODE.weapons.grenade.bulletSpeed)
      .add(up.multiplyScalar(this.grenadeArc * 8));
    const pts: THREE.Vector3[] = [];
    let p = origin.clone();
    let v = vel.clone();
    let landed: THREE.Vector3 | null = null;
    const step = 0.05;
    for (let i = 0; i < 60; i++) {
      pts.push(p.clone());
      v.y -= 15 * step;
      p.add(v.clone().multiplyScalar(step));
      if (p.y <= 0.05) {
        landed = p.clone();
        break;
      }
    }
    if (this.aimLine && pts.length > 0) {
      this.aimLine.geometry.setFromPoints(pts);
      this.aimLine.geometry.computeBoundingSphere();
      this.aimLine.visible = true;
    }
    if (this.aimDot && landed) {
      this.aimDot.position.set(landed.x, 0.05, landed.z);
      this.aimDot.visible = true;
    } else if (this.aimDot) {
      this.aimDot.visible = false;
    }
  }

  private loop = (t: number) => {
    if (!this.running) return;
    const dt = Math.min(0.05, (t - this.lastTime) / 1000);
    this.lastTime = t;
    try {
      this.timeLeft -= dt;
      this.cb.onTimeChange(Math.max(0, this.timeLeft));
      this.updateCountdownSprite(this.timeLeft);

      // smooth camera look
      this.yaw += (this.targetYaw - this.yaw) * Math.min(1, dt * 12);
      this.pitch += (this.targetPitch - this.pitch) * Math.min(1, dt * 12);
      // screen shake
      const sh = this.shakeAmount;
      this.shakeAmount = Math.max(0, this.shakeAmount - dt * 3);
      this.camera.rotation.set(
        this.pitch + (Math.random() - 0.5) * sh * 0.1,
        this.yaw + (Math.random() - 0.5) * sh * 0.1,
        0,
        "YXZ"
      );

      // hand sway + recoil
      this.handSwayX += ((-this.targetYaw * 0.5) - this.handSwayX) * Math.min(1, dt * 5);
      this.handSwayY += ((this.targetPitch * 0.5) - this.handSwayY) * Math.min(1, dt * 5);
      this.handRecoil = Math.max(0, this.handRecoil - dt * 5);
      this.handGroup.position.set(
        0.45 + this.handSwayX * 0.3,
        -0.4 + this.handSwayY * 0.2 + this.handRecoil * 0.05,
        -0.6 + this.handRecoil * 0.15
      );
      this.handGroup.rotation.x = -this.handRecoil * 0.4;

      this.updateBoss(dt);
      this.updateBullets(dt);
      this.updateParticles(dt);
      this.updateGrenadeAim();

      this.renderer.render(this.scene, this.camera);
    } catch (err) {
      console.error("[FPS loop]", err);
    }

    if (this.timeLeft <= 0) {
      this.running = false;
      this.cb.onEnd();
      return;
    }
    this.raf = requestAnimationFrame(this.boundLoop);
  };
}
