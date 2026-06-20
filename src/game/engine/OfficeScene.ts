import * as THREE from "three";
import { WORLD, HIDING_SPOTS } from "../constants";

export interface Collider {
  // axis-aligned box in XZ plane (we treat as 2D for movement collision)
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class OfficeScene {
  group: THREE.Group;
  colliders: Collider[] = [];
  // references to dynamic elements
  bossChair: THREE.Group | null = null;
  plantLeaves: THREE.Mesh | null = null;

  constructor() {
    this.group = new THREE.Group();
    this.build();
  }

  private addCollider(c: Collider) {
    this.colliders.push(c);
  }

  private mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
      ...opts,
    });
  }

  private build() {
    const H = WORLD.half;
    // ===== Floor =====
    const floorGeo = new THREE.PlaneGeometry(H * 2, H * 2, 1, 1);
    const floorMat = this.mat(0xb8a890, { roughness: 0.95 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // floor grid (subtle tiles)
    const grid = new THREE.GridHelper(H * 2, 20, 0x9a8a70, 0xa89878);
    (grid.material as THREE.Material).opacity = 0.35;
    (grid.material as THREE.Material).transparent = true;
    grid.position.y = 0.01;
    this.group.add(grid);

    // ===== Walls =====
    const wallMat = this.mat(0xded3c0);
    const wallH = WORLD.wallHeight;
    const t = 0.4; // wall thickness
    // back (z = -H)
    this.addWall(0, -H, H * 2, t, wallH, wallMat);
    // front (z = +H) — leave a gap as "door" visually
    this.addWall(-H / 2 - 2, H, H - 4, t, wallH, wallMat);
    this.addWall(H / 2 + 2, H, H - 4, t, wallH, wallMat);
    // left (x = -H)
    this.addWall(-H, 0, t, H * 2, wallH, wallMat);
    // right (x = +H)
    this.addWall(H, 0, t, H * 2, wallH, wallMat);

    // baseboard accent (dark strip)
    const baseMat = this.mat(0x6b5d4a);
    const baseH = 0.15;
    const baseGeoX = new THREE.BoxGeometry(H * 2, baseH, 0.05);
    const b1 = new THREE.Mesh(baseGeoX, baseMat);
    b1.position.set(0, baseH / 2, -H + t / 2 + 0.03);
    this.group.add(b1);
    const b2 = new THREE.Mesh(baseGeoX, baseMat);
    b2.position.set(0, baseH / 2, H - t / 2 - 0.03);
    this.group.add(b2);
    const baseGeoZ = new THREE.BoxGeometry(0.05, baseH, H * 2);
    const b3 = new THREE.Mesh(baseGeoZ, baseMat);
    b3.position.set(-H + t / 2 + 0.03, baseH / 2, 0);
    this.group.add(b3);
    const b4 = new THREE.Mesh(baseGeoZ, baseMat);
    b4.position.set(H - t / 2 - 0.03, baseH / 2, 0);
    this.group.add(b4);

    // ===== Boss desk (at back center) =====
    this.buildDesk(0, -6.8, 3.2, 1.4, 0x8b5a2b, true);

    // Boss chair at boss's sitting position (boss sits in front of desk, facing -Z)
    const chair = this.buildChair(0, -5.8, 0x333333);
    this.group.add(chair);

    // ===== Player's cubicle desk (off to the side so center path is clear) =====
    this.buildDesk(-4.5, 3, 2.4, 1.0, 0x9a6b3f, false);
    this.group.add(this.buildChair(-4.5, 4.1, 0x222222));

    // ===== Side furniture: filing cabinets =====
    this.buildCabinet(-7.5, -2, 0x4a4a4a);
    this.buildCabinet(-7.5, 0, 0x4a4a4a);
    this.buildCabinet(7.5, 4, 0x3a3a3a);

    // ===== Coffee table + water cooler =====
    this.buildCoffeeTable(6, -2);
    this.buildWaterCooler(-2, 6.5);

    // ===== Hiding spots (with colliders) =====
    for (const spot of HIDING_SPOTS) {
      if (spot.id === "plant") {
        const plant = this.buildPlant(spot.x, spot.z);
        this.group.add(plant);
      } else if (spot.id === "shelf") {
        const shelf = this.buildShelf(spot.x, spot.z);
        this.group.add(shelf);
      } else if (spot.id === "sofa") {
        const sofa = this.buildSofa(spot.x, spot.z);
        this.group.add(sofa);
      }
      // collider for hiding spot
      this.addCollider({
        minX: spot.x - spot.w / 2,
        maxX: spot.x + spot.w / 2,
        minZ: spot.z - spot.d / 2,
        maxZ: spot.z + spot.d / 2,
      });
    }

    // ===== Decorative rug =====
    const rugGeo = new THREE.PlaneGeometry(6, 4);
    const rugMat = this.mat(0x9c3a3a, { roughness: 1 });
    const rug = new THREE.Mesh(rugGeo, rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.02, -1);
    this.group.add(rug);

    // ===== Wall art (back wall) =====
    this.buildWallArt(0, 1.6, -H + t + 0.05);
    // ===== Window on left wall =====
    this.buildWindow(-H + t + 0.06, 1.6, 0);

    // ===== Ceiling lights (visual only) =====
    this.buildCeilingLight(-3, -2);
    this.buildCeilingLight(3, 2);
  }

  private addWall(
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    mat: THREE.Material
  ) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.addCollider({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    });
  }

  private buildDesk(
    x: number,
    z: number,
    w: number,
    d: number,
    color: number,
    isBoss: boolean
  ) {
    const g = new THREE.Group();
    const topMat = this.mat(color);
    const legMat = this.mat(0x3a2a1a);
    const h = 1.1;
    // top
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), topMat);
    top.position.y = h;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);
    // legs
    const legGeo = new THREE.BoxGeometry(0.1, h, 0.1);
    const offsets = [
      [-w / 2 + 0.1, -d / 2 + 0.1],
      [w / 2 - 0.1, -d / 2 + 0.1],
      [-w / 2 + 0.1, d / 2 - 0.1],
      [w / 2 - 0.1, d / 2 - 0.1],
    ];
    for (const [lx, lz] of offsets) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, h / 2, lz);
      g.add(leg);
    }
    // boss desk extras: monitor + keyboard
    if (isBoss) {
      const monBase = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.05, 0.4),
        this.mat(0x222222)
      );
      monBase.position.set(0, h + 0.04, -0.1);
      g.add(monBase);
      const monStand = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.3, 0.08),
        this.mat(0x222222)
      );
      monStand.position.set(0, h + 0.2, -0.1);
      g.add(monStand);
      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.6, 0.05),
        new THREE.MeshStandardMaterial({
          color: 0x1a1a2a,
          emissive: 0x1133aa,
          emissiveIntensity: 0.4,
          flatShading: true,
        })
      );
      screen.position.set(0, h + 0.55, -0.1);
      g.add(screen);
      const kb = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.04, 0.25),
        this.mat(0x1a1a1a)
      );
      kb.position.set(0, h + 0.06, 0.25);
      g.add(kb);
    } else {
      // player cubicle: laptop
      const laptopBase = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.04, 0.5),
        this.mat(0x2a2a2a)
      );
      laptopBase.position.set(0, h + 0.04, 0);
      g.add(laptopBase);
      const laptopScreen = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.45, 0.03),
        new THREE.MeshStandardMaterial({
          color: 0x1a1a2a,
          emissive: 0x2a4a8a,
          emissiveIntensity: 0.3,
          flatShading: true,
        })
      );
      laptopScreen.position.set(0, h + 0.27, -0.22);
      laptopScreen.rotation.x = -0.2;
      g.add(laptopScreen);
    }
    g.position.set(x, 0, z);
    this.group.add(g);
    this.addCollider({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    });
  }

  private buildChair(x: number, z: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const mat = this.mat(color);
    const h = 0.5;
    // seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.6), mat);
    seat.position.y = h;
    g.add(seat);
    // back
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.1), mat);
    back.position.set(0, h + 0.4, -0.25);
    g.add(back);
    // post
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, h, 6),
      this.mat(0x222222)
    );
    post.position.y = h / 2;
    g.add(post);
    // base (5-star)
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.06, 0.08),
        this.mat(0x222222)
      );
      leg.position.set(Math.cos(ang) * 0.2, 0.04, Math.sin(ang) * 0.2);
      leg.rotation.y = ang;
      g.add(leg);
    }
    g.position.set(x, 0, z);
    return g;
  }

  private buildCabinet(x: number, z: number, color: number) {
    const g = new THREE.Group();
    const mat = this.mat(color);
    const w = 1.0,
      h = 1.8,
      d = 0.5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.position.y = h / 2;
    body.castShadow = true;
    g.add(body);
    // drawers
    const drawerMat = this.mat(0x6a6a6a);
    for (let i = 0; i < 3; i++) {
      const dr = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.9, 0.45, 0.04),
        drawerMat
      );
      dr.position.set(0, 0.35 + i * 0.55, d / 2 + 0.01);
      g.add(dr);
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.04, 0.03),
        this.mat(0x222222)
      );
      handle.position.set(0, 0.35 + i * 0.55, d / 2 + 0.04);
      g.add(handle);
    }
    g.position.set(x, 0, z);
    this.group.add(g);
    this.addCollider({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    });
  }

  private buildCoffeeTable(x: number, z: number) {
    const g = new THREE.Group();
    const mat = this.mat(0x5a3a2a);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 12), mat);
    top.position.y = 0.5;
    g.add(top);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.5, 6),
      this.mat(0x3a2a1a)
    );
    post.position.y = 0.25;
    g.add(post);
    // mug
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.08, 0.18, 8),
      this.mat(0xcc4444)
    );
    mug.position.set(0.15, 0.63, 0.1);
    g.add(mug);
    g.position.set(x, 0, z);
    this.group.add(g);
    this.addCollider({
      minX: x - 0.7,
      maxX: x + 0.7,
      minZ: z - 0.7,
      maxZ: z + 0.7,
    });
  }

  private buildWaterCooler(x: number, z: number) {
    const g = new THREE.Group();
    const bodyMat = this.mat(0x4a90c4, { transparent: true, opacity: 0.7 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.0, 12), bodyMat);
    body.position.y = 0.5;
    g.add(body);
    const jug = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 8),
      this.mat(0x88c4ee, { transparent: true, opacity: 0.6 })
    );
    jug.position.y = 1.2;
    g.add(jug);
    const tap = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.15, 0.1),
      this.mat(0x222222)
    );
    tap.position.set(0, 0.4, 0.35);
    g.add(tap);
    g.position.set(x, 0, z);
    this.group.add(g);
    this.addCollider({
      minX: x - 0.4,
      maxX: x + 0.4,
      minZ: z - 0.4,
      maxZ: z + 0.4,
    });
  }

  private buildPlant(x: number, z: number): THREE.Group {
    const g = new THREE.Group();
    // pot
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.4, 0.6, 8),
      this.mat(0x8a5a3a)
    );
    pot.position.y = 0.3;
    pot.castShadow = true;
    g.add(pot);
    // leaves — big sphere of low-poly
    const leafMat = this.mat(0x2f8f4e);
    const leaves = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.0, 1),
      leafMat
    );
    leaves.position.y = 1.4;
    leaves.scale.set(1, 1.2, 1);
    leaves.castShadow = true;
    g.add(leaves);
    // a few accent leaves
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2;
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.7, 4),
        leafMat
      );
      leaf.position.set(Math.cos(ang) * 0.7, 1.7, Math.sin(ang) * 0.7);
      leaf.rotation.z = Math.cos(ang) * 0.4;
      leaf.rotation.x = Math.sin(ang) * 0.4;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    this.plantLeaves = leaves;
    return g;
  }

  private buildShelf(x: number, z: number): THREE.Group {
    const g = new THREE.Group();
    const mat = this.mat(0x6b4423);
    const w = 3,
      h = 2,
      d = 1;
    // frame
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), mat);
    back.position.set(0, h / 2, -d / 2 + 0.04);
    g.add(back);
    // shelves
    for (let i = 0; i <= 3; i++) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), mat);
      sh.position.set(0, 0.1 + i * 0.55, 0);
      g.add(sh);
    }
    // books
    const bookColors = [0xcc3333, 0x3366cc, 0x33aa55, 0xccaa33, 0x8833aa];
    for (let row = 0; row < 3; row++) {
      let xpos = -w / 2 + 0.15;
      while (xpos < w / 2 - 0.2) {
        const bw = 0.12 + Math.random() * 0.18;
        const bh = 0.3 + Math.random() * 0.18;
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(bw, bh, 0.5),
          this.mat(bookColors[Math.floor(Math.random() * bookColors.length)])
        );
        book.position.set(xpos + bw / 2, 0.16 + row * 0.55 + bh / 2, 0);
        g.add(book);
        xpos += bw + 0.03;
        if (Math.random() < 0.15) xpos += 0.15; // gap
      }
    }
    g.position.set(x, 0, z);
    return g;
  }

  private buildSofa(x: number, z: number): THREE.Group {
    const g = new THREE.Group();
    const mat = this.mat(0x8b5cf6);
    const baseMat = this.mat(0x5a3a8a);
    // base
    const base = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 2), baseMat);
    base.position.y = 0.3;
    base.castShadow = true;
    g.add(base);
    // seat cushions
    for (let i = 0; i < 2; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 1.6), mat);
      c.position.set(-0.95 + i * 1.9, 0.62, 0);
      g.add(c);
    }
    // back
    const back = new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 0.3), mat);
    back.position.set(0, 0.9, -0.85);
    g.add(back);
    // arms
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 2), mat);
      arm.position.set(sx * 1.85, 0.65, 0);
      g.add(arm);
    }
    g.position.set(x, 0, z);
    return g;
  }

  private buildWallArt(x: number, y: number, z: number) {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.4, 0.08),
      this.mat(0x4a3a2a)
    );
    g.add(frame);
    const canvas = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0xf0e6d2,
        roughness: 0.9,
        flatShading: true,
      })
    );
    canvas.position.z = 0.05;
    g.add(canvas);
    // simple "art" — colored triangles
    const artMat1 = this.mat(0xe07a5f);
    const tri1 = new THREE.Mesh(new THREE.CircleGeometry(0.4, 3), artMat1);
    tri1.position.set(-0.4, 0.1, 0.06);
    g.add(tri1);
    const artMat2 = this.mat(0x3d5a80);
    const tri2 = new THREE.Mesh(new THREE.CircleGeometry(0.35, 3), artMat2);
    tri2.position.set(0.3, -0.15, 0.06);
    tri2.rotation.z = 1.0;
    g.add(tri2);
    g.position.set(x, y, z);
    this.group.add(g);
  }

  private buildWindow(x: number, y: number, z: number) {
    const g = new THREE.Group();
    const frameMat = this.mat(0xf0f0f0);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 3.0), frameMat);
    g.add(frame);
    // glass
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 1.6),
      new THREE.MeshStandardMaterial({
        color: 0x88ccee,
        transparent: true,
        opacity: 0.35,
        emissive: 0x4477aa,
        emissiveIntensity: 0.2,
      })
    );
    glass.rotation.y = Math.PI / 2;
    g.add(glass);
    // cross frame
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 2.8), frameMat);
    g.add(cross1);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.6, 0.08), frameMat);
    g.add(cross2);
    g.position.set(x, y, z);
    this.group.add(g);
  }

  private buildCeilingLight(x: number, z: number) {
    const g = new THREE.Group();
    const fixture = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.5, 0.15, 8),
      this.mat(0xeeeeee, { emissive: 0xfff4dd, emissiveIntensity: 0.6 })
    );
    fixture.position.y = WORLD.wallHeight - 0.1;
    g.add(fixture);
    g.position.set(x, 0, z);
    this.group.add(g);
  }
}
