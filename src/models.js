import * as THREE from '../vendor/three.module.js';

const OUTLINE_MAT = new THREE.MeshBasicMaterial({
  color: '#05050a',
  side: THREE.BackSide,
});

function mesh(geometry, material, outline = false, outlineScale = 1.045) {
  const group = new THREE.Group();
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  if (outline) {
    const o = new THREE.Mesh(geometry, OUTLINE_MAT);
    o.scale.setScalar(outlineScale);
    group.add(o);
  }
  return group;
}

function toon(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.72,
    metalness: opts.metalness ?? 0.08,
    emissive: opts.emissive ?? '#000000',
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    flatShading: opts.flat ?? true,
    ...opts.extra,
  });
}

function glowSprite(color, scale, opacity = 0.85) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 1, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex,
    color: '#ffffff',
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

/* ------------------------------------------------------------------ */
/*  Hero — Yuji-inspired sorcerer                                      */
/* ------------------------------------------------------------------ */

export function createHero() {
  const root = new THREE.Group();
  const rig = { root };

  const skin = toon('#d6a07f', { flat: false });
  const uniform = toon('#252b47', { roughness: 0.8 });
  const uniformDark = toon('#15182a');
  const red = toon('#a51d33', { roughness: 0.68, emissive: '#31040c', emissiveIntensity: 0.45 });
  const redBright = toon('#d32944', { emissive: '#5c0a18', emissiveIntensity: 0.75 });
  const hair = toon('#6b2b3b', { roughness: 0.9 });
  const white = toon('#f1e8dc', { flat: false });
  const black = toon('#0a0a10');
  const shoe = toon('#d8d3ca', { roughness: 0.65 });

  // hips
  const pelvis = mesh(new THREE.CylinderGeometry(0.35, 0.31, 0.34, 8), uniformDark, true);
  pelvis.position.y = 0.97;
  root.add(pelvis);

  // torso group
  const torso = new THREE.Group();
  torso.position.y = 1.13;
  root.add(torso);
  rig.torso = torso;

  const jacket = mesh(new THREE.CylinderGeometry(0.44, 0.34, 0.78, 8), uniform, true);
  jacket.position.y = 0.36;
  torso.add(jacket);
  const chest = mesh(new THREE.BoxGeometry(0.52, 0.28, 0.22), red, true, 1.07);
  chest.position.set(0, 0.48, 0.33);
  chest.rotation.x = -0.08;
  torso.add(chest);
  const zip = mesh(new THREE.BoxGeometry(0.045, 0.72, 0.05), black);
  zip.position.set(0, 0.36, 0.445);
  torso.add(zip);
  const collar = mesh(new THREE.TorusGeometry(0.26, 0.09, 5, 12, Math.PI * 1.65), redBright, true);
  collar.rotation.x = Math.PI / 2;
  collar.rotation.z = 0.36;
  collar.position.y = 0.79;
  torso.add(collar);
  const belt = mesh(new THREE.BoxGeometry(0.7, 0.1, 0.56), black);
  belt.position.y = -0.04;
  torso.add(belt);

  // hood hanging on back
  const hood = mesh(new THREE.SphereGeometry(0.28, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.7), red, false);
  hood.position.set(0, 0.62, -0.34);
  hood.rotation.x = 0.7;
  hood.scale.set(1.3, 0.9, 0.6);
  torso.add(hood);

  // head
  const head = new THREE.Group();
  head.position.y = 2.0;
  root.add(head);
  rig.head = head;
  const neck = mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.18, 8), skin);
  neck.position.y = -0.08;
  head.add(neck);
  const face = mesh(new THREE.SphereGeometry(0.29, 12, 10), skin, true, 1.05);
  face.scale.set(0.92, 1.04, 0.9);
  face.position.y = 0.18;
  head.add(face);
  const hairCap = mesh(new THREE.SphereGeometry(0.305, 9, 7, 0, Math.PI * 2, 0, Math.PI * 0.58), hair, true, 1.05);
  hairCap.position.y = 0.28;
  head.add(hairCap);

  // spiky hair cones
  const spikeGeo = new THREE.ConeGeometry(0.105, 0.36, 5);
  const spikeData = [
    [-0.2, 0.48, -0.06, 0.3, 0, -0.4],
    [-0.08, 0.55, -0.15, 0.1, 0, -0.1],
    [0.08, 0.55, -0.13, -0.1, 0, 0.1],
    [0.21, 0.48, -0.05, -0.3, 0, 0.4],
    [-0.25, 0.36, 0.06, 0.15, 0, -0.9],
    [0.25, 0.36, 0.06, -0.15, 0, 0.9],
    [0, 0.54, 0.04, 0, 0, 0],
    [-0.13, 0.5, 0.17, -0.2, 0, -0.2],
    [0.14, 0.5, 0.17, 0.2, 0, 0.2],
  ];
  for (const [x, y, z, rx, ry, rz] of spikeData) {
    const s = new THREE.Mesh(spikeGeo, hair);
    s.position.set(x, y, z);
    s.rotation.set(rx, ry, rz);
    s.castShadow = true;
    head.add(s);
  }
  // fringe
  const fringe = mesh(new THREE.ConeGeometry(0.12, 0.28, 5), hair);
  fringe.position.set(-0.05, 0.38, 0.24);
  fringe.rotation.x = 1.15;
  head.add(fringe);

  // eyes + face marks
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.045, 7, 5), white, false);
    eye.position.set(side * 0.105, 0.19, 0.255);
    eye.scale.set(1, 0.75, 0.4);
    head.add(eye);
    const pupil = mesh(new THREE.SphereGeometry(0.022, 6, 4), black, false);
    pupil.position.set(side * 0.105, 0.185, 0.283);
    head.add(pupil);
    const brow = mesh(new THREE.BoxGeometry(0.12, 0.024, 0.02), hair);
    brow.position.set(side * 0.1, 0.25, 0.27);
    brow.rotation.z = side * 0.18;
    head.add(brow);
  }
  const mouth = mesh(new THREE.BoxGeometry(0.11, 0.018, 0.02), toon('#6b3b3b'));
  mouth.position.set(0, 0.075, 0.268);
  head.add(mouth);

  // arms
  const makeArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.5, 1.63, 0);
    root.add(shoulder);
    const upper = mesh(new THREE.CapsuleGeometry(0.115, 0.3, 3, 7), uniform, true);
    upper.position.y = -0.23;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.43;
    shoulder.add(elbow);
    const fore = mesh(new THREE.CapsuleGeometry(0.1, 0.27, 3, 7), skin, true);
    fore.position.y = -0.21;
    elbow.add(fore);
    const cuff = mesh(new THREE.CylinderGeometry(0.125, 0.115, 0.12, 7), red);
    cuff.position.y = -0.06;
    elbow.add(cuff);
    const fist = mesh(new THREE.SphereGeometry(0.14, 7, 5), skin, true);
    fist.position.y = -0.43;
    fist.scale.set(0.9, 1, 0.9);
    elbow.add(fist);
    return { shoulder, elbow, upper, fore, fist };
  };
  rig.leftArm = makeArm(-1);
  rig.rightArm = makeArm(1);

  // legs
  const makeLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.22, 0.98, 0);
    root.add(hip);
    const thigh = mesh(new THREE.CapsuleGeometry(0.145, 0.3, 3, 7), uniform, true);
    thigh.position.y = -0.24;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.48;
    hip.add(knee);
    const shin = mesh(new THREE.CapsuleGeometry(0.12, 0.29, 3, 7), uniform, true);
    shin.position.y = -0.23;
    knee.add(shin);
    const sneaker = mesh(new THREE.BoxGeometry(0.25, 0.15, 0.42), shoe, true, 1.06);
    sneaker.position.set(0, -0.49, 0.09);
    knee.add(sneaker);
    const sole = mesh(new THREE.BoxGeometry(0.26, 0.06, 0.44), red);
    sole.position.set(0, -0.57, 0.09);
    knee.add(sole);
    return { hip, knee, thigh, shin, sneaker };
  };
  rig.leftLeg = makeLeg(-1);
  rig.rightLeg = makeLeg(1);

  // cursed aura
  const aura = glowSprite('rgba(255,35,67,0.9)', 3.2, 0.35);
  aura.position.y = 1.1;
  root.add(aura);
  rig.aura = aura;
  const auraRing = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1.1, 32),
    new THREE.MeshBasicMaterial({
      color: '#ff2a4b', transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
    })
  );
  auraRing.rotation.x = -Math.PI / 2;
  auraRing.position.y = 0.06;
  root.add(auraRing);
  rig.auraRing = auraRing;

  // soft key + rim so the sorcerer reads against the dark street
  const heroKey = new THREE.PointLight('#ffd7c8', 4.2, 5.5, 2);
  heroKey.position.set(0.3, 2.4, 1.4);
  root.add(heroKey);
  const heroRim = new THREE.PointLight('#ff284c', 3.4, 4.5, 2);
  heroRim.position.set(-0.4, 1.8, -1.1);
  root.add(heroRim);
  rig.heroKey = heroKey;
  rig.heroRim = heroRim;

  // Jujutsu high crest on the back of the jacket
  const crest = mesh(new THREE.TorusGeometry(0.13, 0.022, 4, 16), white);
  crest.position.set(0, 0.45, -0.355);
  crest.rotation.y = Math.PI;
  torso.add(crest);
  const crestBar = mesh(new THREE.BoxGeometry(0.025, 0.2, 0.02), white);
  crestBar.position.set(0, 0.45, -0.37);
  torso.add(crestBar);

  rig.height = 2.3;
  root.userData.rig = rig;
  return root;
}

/* ------------------------------------------------------------------ */
/*  Cursed spirits                                                     */
/* ------------------------------------------------------------------ */

function makeMask(scale = 1, color = '#e9e1ce') {
  const group = new THREE.Group();
  const maskMat = toon(color, { roughness: 0.45, emissive: '#241a20', emissiveIntensity: 0.2, flat: false });
  const face = mesh(new THREE.SphereGeometry(0.42 * scale, 14, 12), maskMat, true, 1.055);
  face.scale.set(1, 1.18, 0.34);
  group.add(face);

  const eyeMat = new THREE.MeshBasicMaterial({ color: '#08060b' });
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.085 * scale, 8, 5), eyeMat);
    eye.position.set(side * 0.16 * scale, 0.08 * scale, 0.15 * scale);
    eye.scale.set(1.35, 0.55, 0.4);
    eye.rotation.z = side * -0.18;
    group.add(eye);
    const glint = glowSprite('rgba(255,35,55,0.9)', 0.15 * scale, 0.8);
    glint.position.set(side * 0.17 * scale, 0.09 * scale, 0.19 * scale);
    group.add(glint);
    // heavy, angled brow ridges give the mask a hostile, sunken stare
    const brow = mesh(new THREE.BoxGeometry(0.23 * scale, 0.05 * scale, 0.035 * scale), eyeMat);
    brow.position.set(side * 0.155 * scale, 0.235 * scale, 0.152 * scale);
    brow.rotation.z = side * -0.34;
    group.add(brow);
  }
  const mouth = mesh(new THREE.BoxGeometry(0.36 * scale, 0.045 * scale, 0.02), eyeMat);
  mouth.position.set(0, -0.17 * scale, 0.15 * scale);
  mouth.rotation.z = 0.06;
  group.add(mouth);
  // jagged teeth biting through the seam
  const toothMat = new THREE.MeshBasicMaterial({ color: '#d8cbb1' });
  for (let i = 0; i < 6; i++) {
    const tooth = mesh(new THREE.ConeGeometry(0.027 * scale, 0.105 * scale, 4), toothMat);
    tooth.position.set((-0.145 + i * 0.058) * scale, -0.195 * scale, 0.157 * scale);
    tooth.rotation.x = Math.PI;
    tooth.rotation.z = (i - 2.5) * 0.035;
    group.add(tooth);
  }
  // stitched cracks
  const stitchMat = new THREE.MeshBasicMaterial({ color: '#5b2635' });
  for (let i = 0; i < 3; i++) {
    const s = mesh(new THREE.BoxGeometry(0.025 * scale, 0.15 * scale, 0.01), stitchMat);
    s.position.set((-0.12 + i * 0.12) * scale, -0.29 * scale, 0.145 * scale);
    s.rotation.z = (-0.5 + i * 0.5);
    group.add(s);
  }
  // hairline fracture across the forehead
  const crack = mesh(new THREE.BoxGeometry(0.018 * scale, 0.2 * scale, 0.01), stitchMat);
  crack.position.set(0.21 * scale, 0.1 * scale, 0.145 * scale);
  crack.rotation.z = 0.55;
  group.add(crack);
  return group;
}

export function createGrunt(variant = 0) {
  const root = new THREE.Group();
  const rig = { root, variant };
  root.userData.rig = rig;

  const palette = [
    { body: '#21142e', glow: '#ff3155', eye: '#ff2545' },
    { body: '#14212b', glow: '#43d9ff', eye: '#65eaff' },
    { body: '#2a1a20', glow: '#ff8d48', eye: '#ff9944' },
  ][variant % 3];
  const bodyMat = toon(palette.body, {
    roughness: 0.9, emissive: palette.body, emissiveIntensity: 0.15, flat: true,
  });
  const fleshMat = toon('#3a2339', {
    roughness: 0.95, emissive: palette.glow, emissiveIntensity: 0.08,
  });
  const flashMats = [bodyMat, fleshMat];

  // floating core body
  const body = mesh(new THREE.IcosahedronGeometry(0.66, 1), bodyMat, true, 1.06);
  body.scale.set(1.04, 1.28, 0.96);
  root.add(body);
  rig.body = body;

  // shoulder tumor
  const lump = mesh(new THREE.IcosahedronGeometry(0.32, 1), fleshMat, false);
  lump.position.set(0.35, 0.34, -0.12);
  root.add(lump);

  // long grasping arms
  const limbMat = toon('#2a172b', { emissive: palette.glow, emissiveIntensity: 0.2, roughness: 1 });
  flashMats.push(limbMat);
  const gArms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.52, 0.18, 0);
    shoulder.rotation.z = side * 0.32;
    root.add(shoulder);
    const upper = mesh(new THREE.CapsuleGeometry(0.075, 0.5, 3, 6), limbMat, true);
    upper.position.y = -0.28;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.58;
    shoulder.add(elbow);
    const fore = mesh(new THREE.CapsuleGeometry(0.06, 0.48, 3, 6), limbMat, true);
    fore.position.y = -0.27;
    elbow.add(fore);
    for (let c = 0; c < 3; c++) {
      const claw = mesh(new THREE.ConeGeometry(0.035, 0.28, 4), toon('#b4a68d', { roughness: 0.6 }));
      claw.position.set((c - 1) * 0.055, -0.57, 0);
      claw.rotation.x = Math.PI;
      claw.rotation.z = (c - 1) * 0.18;
      elbow.add(claw);
    }
    gArms.push({ shoulder, elbow });
  }
  rig.gArms = gArms;

  // tendrils
  const tendrilMat = toon('#2a172b', { emissive: palette.glow, emissiveIntensity: 0.25, roughness: 1 });
  flashMats.push(tendrilMat);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const t = new THREE.Group();
    t.position.set(Math.cos(a) * 0.35, -0.28, Math.sin(a) * 0.35);
    const seg = mesh(new THREE.ConeGeometry(0.1, 0.8, 5), tendrilMat);
    seg.position.y = -0.4;
    seg.rotation.z = Math.cos(a) * 0.35;
    seg.rotation.x = Math.sin(a) * 0.35;
    t.add(seg);
    root.add(t);
  }

  const face = makeMask(1, '#cdbfa8');
  face.position.set(0, 0.05, 0.59);
  root.add(face);
  rig.face = face;
  const tongue = mesh(new THREE.CapsuleGeometry(0.026, 0.22, 2, 5), toon('#8d1530', { emissive: '#3c0710', emissiveIntensity: 0.5 }));
  tongue.position.set(0.03, -0.31, 0.155);
  tongue.rotation.z = 0.35;
  tongue.rotation.x = 0.4;
  face.add(tongue);

  // horns
  const hornMat = toon('#b7aa93', { roughness: 0.5, flat: true });
  for (const side of [-1, 1]) {
    const horn = mesh(new THREE.ConeGeometry(0.11, 0.55, 5), hornMat, true);
    horn.position.set(side * 0.28, 0.58, 0.3);
    horn.rotation.z = side * -0.55;
    horn.rotation.x = 0.25;
    root.add(horn);
  }

  const aura = glowSprite(palette.glow.replace(')', ',0.9)').replace('rgb', 'rgba'), 2.8, 0.22);
  aura.position.y = 0.2;
  root.add(aura);
  rig.aura = aura;

  const light = new THREE.PointLight(palette.glow, 2.4, 4.5, 2);
  light.position.set(0, 0.15, 0.7);
  root.add(light);
  rig.light = light;

  rig.flashMats = flashMats;
  rig.baseEmissive = flashMats.map((m) => m.emissive.clone());
  rig.baseIntensity = flashMats.map((m) => m.emissiveIntensity);
  rig.floatBase = 1.05 + Math.random() * 0.3;
  rig.phase = Math.random() * 8;
  rig.height = 1.5;
  return root;
}

export function createBrute() {
  const root = new THREE.Group();
  const rig = { root };
  root.userData.rig = rig;

  const bodyMat = toon('#24162c', { roughness: 0.9, emissive: '#3d0b27', emissiveIntensity: 0.25 });
  const fleshMat = toon('#4f263e', { roughness: 0.9, emissive: '#bd1e47', emissiveIntensity: 0.16 });
  const flashMats = [bodyMat, fleshMat];

  const torso = new THREE.Group();
  torso.position.y = 2.1;
  root.add(torso);
  const trunk = mesh(new THREE.CapsuleGeometry(0.58, 1.0, 3, 8), bodyMat, true, 1.04);
  trunk.scale.set(1, 1, 0.72);
  torso.add(trunk);

  const ribs = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const r = mesh(new THREE.TorusGeometry(0.5 - i * 0.03, 0.035, 4, 10, Math.PI * 1.3), fleshMat);
    r.rotation.x = Math.PI / 2;
    r.rotation.z = Math.PI * 0.85;
    r.position.y = 0.42 - i * 0.24;
    ribs.add(r);
  }
  torso.add(ribs);

  const head = new THREE.Group();
  head.position.set(0, 1.0, 0.12);
  torso.add(head);
  const face = makeMask(1.32, '#d6c9b6');
  face.position.set(0, 0, 0.32);
  head.add(face);
  rig.head = head;

  // giant bone horns
  const hornMat = toon('#c2b49b', { roughness: 0.55 });
  for (const side of [-1, 1]) {
    const horn = mesh(new THREE.ConeGeometry(0.15, 1.0, 5), hornMat, true);
    horn.position.set(side * 0.42, 0.55, 0.18);
    horn.rotation.z = side * -0.65;
    horn.rotation.x = 0.15;
    head.add(horn);
  }

  const makeArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.62, 0.55, 0);
    torso.add(shoulder);
    const upper = mesh(new THREE.CapsuleGeometry(0.17, 0.8, 3, 7), bodyMat, true);
    upper.position.y = -0.5;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.95;
    shoulder.add(elbow);
    const fore = mesh(new THREE.CapsuleGeometry(0.145, 0.85, 3, 7), fleshMat, true);
    fore.position.y = -0.48;
    elbow.add(fore);
    const claw = new THREE.Group();
    claw.position.y = -0.98;
    for (let i = 0; i < 3; i++) {
      const c = mesh(new THREE.ConeGeometry(0.05, 0.32, 4), hornMat);
      c.position.x = (i - 1) * 0.11;
      c.rotation.x = Math.PI;
      c.rotation.z = (i - 1) * 0.2;
      claw.add(c);
    }
    elbow.add(claw);
    return { shoulder, elbow };
  };
  rig.leftArm = makeArm(-1);
  rig.rightArm = makeArm(1);

  const makeLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.33, 1.38, 0);
    root.add(hip);
    const thigh = mesh(new THREE.CapsuleGeometry(0.2, 0.65, 3, 7), bodyMat, true);
    thigh.position.y = -0.4;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.85;
    hip.add(knee);
    const shin = mesh(new THREE.CapsuleGeometry(0.15, 0.6, 3, 7), bodyMat, true);
    shin.position.y = -0.34;
    knee.add(shin);
    const foot = mesh(new THREE.BoxGeometry(0.36, 0.2, 0.6), fleshMat);
    foot.position.set(0, -0.69, 0.15);
    knee.add(foot);
    return { hip, knee };
  };
  rig.leftLeg = makeLeg(-1);
  rig.rightLeg = makeLeg(1);

  const aura = glowSprite('rgba(255,30,80,0.85)', 4.5, 0.28);
  aura.position.y = 1.9;
  root.add(aura);
  rig.aura = aura;

  const light = new THREE.PointLight('#ff2c58', 5, 7, 2);
  light.position.set(0, 2, 0.8);
  root.add(light);
  rig.light = light;

  rig.flashMats = flashMats;
  rig.baseEmissive = flashMats.map((m) => m.emissive.clone());
  rig.baseIntensity = flashMats.map((m) => m.emissiveIntensity);
  rig.floatBase = 0;
  rig.phase = Math.random() * 8;
  rig.height = 3.2;
  return root;
}

export function createBoss() {
  const root = new THREE.Group();
  const rig = { root };
  root.userData.rig = rig;

  const bodyMat = toon('#1c1027', { roughness: 0.92, emissive: '#43052a', emissiveIntensity: 0.4 });
  const fleshMat = toon('#4c1935', { roughness: 0.82, emissive: '#a30b35', emissiveIntensity: 0.32 });
  const boneMat = toon('#d5c5aa', { roughness: 0.45, emissive: '#452222', emissiveIntensity: 0.1 });
  const flashMats = [bodyMat, fleshMat, boneMat];

  const torso = new THREE.Group();
  torso.position.y = 2.8;
  root.add(torso);
  rig.torso = torso;
  const trunk = mesh(new THREE.CapsuleGeometry(0.95, 1.7, 4, 9), bodyMat, true, 1.03);
  trunk.scale.set(1, 1, 0.65);
  torso.add(trunk);

  // exposed rib cage
  for (let i = 0; i < 5; i++) {
    const rib = mesh(new THREE.TorusGeometry(0.86 - i * 0.04, 0.055, 5, 14, Math.PI * 1.25), boneMat);
    rib.rotation.x = Math.PI / 2;
    rib.rotation.z = Math.PI * 0.875;
    rib.position.y = 0.68 - i * 0.26;
    torso.add(rib);
  }

  // mask cluster
  const faces = new THREE.Group();
  faces.position.set(0, 1.5, 0.34);
  torso.add(faces);
  const mainFace = makeMask(1.9, '#e6d8c1');
  faces.add(mainFace);
  rig.mainFace = mainFace;
  for (const [x, y, s] of [[-0.75, 0.28, 0.72], [0.8, 0.15, 0.62], [0.05, 0.8, 0.5]]) {
    const f = makeMask(s, '#cdbb9f');
    f.position.set(x, y, -0.04);
    f.rotation.z = x * 0.22;
    faces.add(f);
  }

  // crown of horns
  for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * Math.PI * 1.4;
    const horn = mesh(new THREE.ConeGeometry(0.13, 1.3 + Math.random() * 0.5, 5), boneMat, true);
    horn.position.set(Math.sin(a) * 0.95, 0.8 + Math.cos(a) * 0.35, -0.05);
    horn.rotation.z = -a * 0.7;
    horn.rotation.x = -0.25;
    faces.add(horn);
  }

  // four massive arms
  const armRoots = [];
  const makeArm = (side, lower) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * (lower ? 0.72 : 0.98), lower ? 1.05 : 1.38, 0);
    torso.add(shoulder);
    const upper = mesh(new THREE.CapsuleGeometry(0.23, 1.1, 3, 7), bodyMat, true);
    upper.position.y = -0.66;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -1.32;
    shoulder.add(elbow);
    const fore = mesh(new THREE.CapsuleGeometry(0.2, 1.1, 3, 7), fleshMat, true);
    fore.position.y = -0.6;
    elbow.add(fore);
    const hand = new THREE.Group();
    hand.position.y = -1.28;
    for (let i = 0; i < 4; i++) {
      const c = mesh(new THREE.ConeGeometry(0.07, 0.55, 4), boneMat);
      c.position.x = (i - 1.5) * 0.13;
      c.rotation.x = Math.PI;
      c.rotation.z = (i - 1.5) * 0.12;
      hand.add(c);
    }
    elbow.add(hand);
    armRoots.push({ shoulder, elbow });
    return { shoulder, elbow };
  };
  rig.arms = [
    makeArm(-1, false), makeArm(1, false),
    makeArm(-1, true), makeArm(1, true),
  ];
  rig.leftArm = rig.arms[0];
  rig.rightArm = rig.arms[1];

  // legs
  const makeLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.48, 2.18, 0);
    root.add(hip);
    const thigh = mesh(new THREE.CapsuleGeometry(0.28, 0.9, 3, 7), bodyMat, true);
    thigh.position.y = -0.55;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -1.12;
    hip.add(knee);
    const shin = mesh(new THREE.CapsuleGeometry(0.22, 0.85, 3, 7), bodyMat, true);
    shin.position.y = -0.48;
    knee.add(shin);
    const foot = mesh(new THREE.BoxGeometry(0.5, 0.25, 0.9), fleshMat);
    foot.position.set(0, -0.96, 0.2);
    knee.add(foot);
    return { hip, knee };
  };
  rig.leftLeg = makeLeg(-1);
  rig.rightLeg = makeLeg(1);

  const aura = glowSprite('rgba(255,15,55,0.95)', 9, 0.4);
  aura.position.y = 2.6;
  root.add(aura);
  rig.aura = aura;

  const aura2 = glowSprite('rgba(145,35,255,0.8)', 6, 0.3);
  aura2.position.y = 3.2;
  root.add(aura2);
  rig.aura2 = aura2;

  const light = new THREE.PointLight('#ff1747', 15, 14, 2);
  light.position.set(0, 3, 1.4);
  root.add(light);
  rig.light = light;

  rig.flashMats = flashMats;
  rig.baseEmissive = flashMats.map((m) => m.emissive.clone());
  rig.baseIntensity = flashMats.map((m) => m.emissiveIntensity);
  rig.floatBase = 0;
  rig.phase = 0;
  rig.height = 5.8;
  return root;
}

/* ------------------------------------------------------------------ */
/*  Animation                                                          */
/* ------------------------------------------------------------------ */

const lerp = THREE.MathUtils.lerp;

export function animateHero(rig, state, dt) {
  const t = state.time;
  const run = state.moving ? 1 : 0;
  const speedFactor = Math.min(1, state.speed / 8);
  const breathe = Math.sin(t * 2.1) * 0.02;
  const runBob = Math.abs(Math.sin(t * (9 + speedFactor * 4))) * 0.08 * run;

  rig.root.position.y = runBob + (state.dash ? 0.12 : 0);
  rig.torso.rotation.x = lerp(rig.torso.rotation.x, run * 0.12 + breathe, dt * 10);
  rig.torso.rotation.z = lerp(rig.torso.rotation.z, (state.strafe || 0) * -0.05, dt * 8);
  rig.head.rotation.x = lerp(rig.head.rotation.x, state.dash ? -0.18 : 0, dt * 8);

  const stride = Math.sin(t * (10 + speedFactor * 3)) * run;
  rig.leftLeg.hip.rotation.x = lerp(rig.leftLeg.hip.rotation.x, stride * 0.75, dt * 16);
  rig.rightLeg.hip.rotation.x = lerp(rig.rightLeg.hip.rotation.x, -stride * 0.75, dt * 16);
  rig.leftLeg.knee.rotation.x = lerp(rig.leftLeg.knee.rotation.x, Math.max(0, -stride) * 0.9 + run * 0.1, dt * 16);
  rig.rightLeg.knee.rotation.x = lerp(rig.rightLeg.knee.rotation.x, Math.max(0, stride) * 0.9 + run * 0.1, dt * 16);

  // arms
  let rArmX = -stride * 0.7 * run;
  let lArmX = stride * 0.7 * run;
  let rArmZ = -0.1;
  let lArmZ = 0.1;
  let rElbow = -0.15;
  let lElbow = -0.15;

  if (state.attack) {
    const p = state.attackProgress;
    if (state.attackKind === 'heavy') {
      rArmX = -1.3 - Math.sin(p * Math.PI) * 1.15;
      rArmZ = -0.5;
      rElbow = -0.15 - Math.sin(p * Math.PI) * 0.25;
      lArmX = 0.5;
      lArmZ = 0.4;
    } else {
      const swing = Math.sin(p * Math.PI);
      rArmX = -0.6 - swing * 1.5;
      rArmZ = -0.3 - swing * 0.35;
      rElbow = -0.4 + swing * 0.15;
      lArmX = 0.2 + swing * 0.6;
      lArmZ = 0.3;
    }
    rig.torso.rotation.y = lerp(rig.torso.rotation.y, -Math.sin(p * Math.PI) * 0.55, dt * 20);
  } else {
    rig.torso.rotation.y = lerp(rig.torso.rotation.y, 0, dt * 12);
  }

  if (state.dash) {
    rArmX = 0.45; lArmX = 0.45;
    rArmZ = -0.45; lArmZ = 0.45;
    rElbow = -0.9; lElbow = -0.9;
  }

  rig.rightArm.shoulder.rotation.x = lerp(rig.rightArm.shoulder.rotation.x, rArmX, dt * 18);
  rig.leftArm.shoulder.rotation.x = lerp(rig.leftArm.shoulder.rotation.x, lArmX, dt * 18);
  rig.rightArm.shoulder.rotation.z = lerp(rig.rightArm.shoulder.rotation.z, rArmZ, dt * 16);
  rig.leftArm.shoulder.rotation.z = lerp(rig.leftArm.shoulder.rotation.z, lArmZ, dt * 16);
  rig.rightArm.elbow.rotation.x = lerp(rig.rightArm.elbow.rotation.x, rElbow, dt * 18);
  rig.leftArm.elbow.rotation.x = lerp(rig.leftArm.elbow.rotation.x, lElbow, dt * 18);

  const auraStrength = state.blackFlash ? 1 : state.energy / 100;
  rig.aura.material.opacity = 0.16 + auraStrength * 0.2 + (state.blackFlash ? Math.sin(t * 24) * 0.12 : 0);
  rig.auraRing.material.opacity = 0.12 + auraStrength * 0.28;
  rig.auraRing.scale.setScalar(1 + Math.sin(t * 2.4) * 0.06);
}

export function animateEnemy(rig, dt, time, state = {}) {
  const phase = rig.phase || 0;
  if (rig.variant !== undefined) {
    // grunt floats
    const bob = Math.sin(time * 2 + phase) * 0.18;
    rig.root.position.y = rig.floatBase + bob;
    rig.root.rotation.z = Math.sin(time * 1.4 + phase) * 0.04;
    rig.face.rotation.y = Math.sin(time * 0.8 + phase) * 0.12;
    rig.body.rotation.y += dt * 0.3;
    rig.gArms?.forEach((arm, i) => {
      arm.shoulder.rotation.x = -0.5 + Math.sin(time * 1.4 + i * 2.1 + phase) * 0.18;
      arm.shoulder.rotation.z = (i === 0 ? -1 : 1) * (0.32 + Math.sin(time * 1.1 + i) * 0.05);
      arm.elbow.rotation.x = -0.55 + Math.cos(time * 1.7 + i + phase) * 0.18;
    });
    if (rig.light) rig.light.intensity = 2.1 + Math.sin(time * 7 + phase) * 0.6;
  } else if (rig.arms) {
    // boss
    const breathe = Math.sin(time * 1.4) * 0.03;
    rig.root.position.y = 0;
    rig.arms.forEach((arm, i) => {
      const base = i < 2 ? -0.4 : -0.2;
      arm.shoulder.rotation.x = base + Math.sin(time * 1.2 + i * 1.7) * 0.12;
      arm.shoulder.rotation.z = (i % 2 === 0 ? 1 : -1) * (0.22 + Math.sin(time + i) * 0.04);
      arm.elbow.rotation.x = -0.35 + Math.cos(time * 1.4 + i) * 0.1;
    });
    rig.torso.rotation.z = breathe;
    rig.mainFace.rotation.y = Math.sin(time * 0.6) * 0.1;
    rig.aura.scale.setScalar(8.4 + Math.sin(time * 2.2) * 0.7);
    rig.aura2.scale.setScalar(5.6 + Math.cos(time * 1.6) * 0.5);
    if (rig.light) rig.light.intensity = 13 + Math.sin(time * 5) * 4;
  } else {
    // brute
    const walk = Math.sin(time * 4.2 + phase) * (state.moving ? 1 : 0.2);
    rig.leftLeg.hip.rotation.x = walk * 0.55;
    rig.rightLeg.hip.rotation.x = -walk * 0.55;
    rig.leftArm.shoulder.rotation.x = -walk * 0.35 - 0.2;
    rig.rightArm.shoulder.rotation.x = walk * 0.35 - 0.2;
    rig.leftArm.shoulder.rotation.z = 0.18;
    rig.rightArm.shoulder.rotation.z = -0.18;
    rig.head.rotation.y = Math.sin(time * 0.9) * 0.12;
    rig.aura.material.opacity = 0.22 + Math.sin(time * 2.4) * 0.07;
    if (rig.light) rig.light.intensity = 4.4 + Math.sin(time * 4) * 1.3;
  }
}

export function setFlash(rig, amount) {
  if (!rig.flashMats) return;
  rig.flashMats.forEach((m, i) => {
    m.emissive.setStyle(amount > 0 ? '#ff4055' : '#' + rig.baseEmissive[i].getHexString());
    m.emissiveIntensity = amount > 0 ? 1.7 : rig.baseIntensity[i];
    m.color.offsetHSL(0, 0, 0);
  });
}

export function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (m.map && m.map.dispose) m.map.dispose();
        m.dispose();
      });
    }
  });
}

export { glowSprite };
