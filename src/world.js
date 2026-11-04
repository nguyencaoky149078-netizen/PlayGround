import * as THREE from '../vendor/three.module.js';

/* ------------------------------------------------------------------ */
/*  Procedural texture helpers                                         */
/* ------------------------------------------------------------------ */

function canvasTexture(size, draw, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.22, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

function asphaltTexture() {
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#12131a';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2400; i++) {
      const v = 14 + Math.random() * 28;
      ctx.fillStyle = `rgba(${v},${v + 2},${v + 8},${0.16 + Math.random() * 0.35})`;
      const r = Math.random() * 2.4;
      ctx.beginPath();
      ctx.arc(Math.random() * s, Math.random() * s, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(70,72,92,.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      let x = Math.random() * s;
      let y = Math.random() * s;
      ctx.moveTo(x, y);
      for (let j = 0; j < 8; j++) {
        x += (Math.random() - 0.5) * 70;
        y += Math.random() * 36;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, 8, 8);
}

function windowTexture() {
  return canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = '#090b14';
    ctx.fillRect(0, 0, s, s);
    for (let y = 8; y < s - 8; y += 18) {
      for (let x = 8; x < s - 8; x += 14) {
        const on = Math.random() > 0.38;
        ctx.fillStyle = on
          ? (Math.random() > 0.7 ? 'rgba(255,112,74,.95)' : 'rgba(255,214,146,.8)')
          : 'rgba(12,15,24,1)';
        ctx.fillRect(x, y, 8, 11);
      }
    }
  }, 2, 3);
}

function signTexture(text, color = '#ff3e5f', sub = '') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#09070c';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.strokeRect(14, 14, c.width - 28, c.height - 28);
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 92px "Noto Sans JP", "Rajdhani", sans-serif';
  const chars = [...text];
  chars.forEach((ch, i) => {
    ctx.fillText(ch, c.width / 2, 100 + i * 104);
  });
  if (sub) {
    ctx.shadowBlur = 8;
    ctx.font = '600 26px Rajdhani, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sub, c.width / 2, c.height - 58);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function sealTexture() {
  return canvasTexture(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(255,42,68,.9)';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#ff2a44';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, 92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, 72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = '700 66px serif';
    ctx.fillStyle = 'rgba(255,52,74,.92)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('呪', s / 2, s / 2 + 2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(s / 2 + Math.cos(a) * 76, s / 2 + Math.sin(a) * 76);
      ctx.lineTo(s / 2 + Math.cos(a) * 88, s / 2 + Math.sin(a) * 88);
      ctx.stroke();
    }
  });
}

/* ------------------------------------------------------------------ */
/*  World                                                              */
/* ------------------------------------------------------------------ */

export function createWorld(scene, renderer) {
  const root = new THREE.Group();
  scene.add(root);

  const ambiance = {
    dust: null,
    embers: null,
    lanterns: [],
    flickers: [],
    seals: [],
    time: 0,
    torii: null,
  };

  // ---- Sky ----------------------------------------------------------
  const skyGeo = new THREE.SphereGeometry(230, 40, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color('#04060f') },
      mid: { value: new THREE.Color('#14142c') },
      bottom: { value: new THREE.Color('#4a1625') },
      glow: { value: new THREE.Color('#ff4b5f') },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 glow;
      varying vec3 vPos;
      void main() {
        float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
        vec3 c = mix(bottom, mid, smoothstep(0.47, 0.62, h));
        c = mix(c, top, smoothstep(0.63, 1.0, h));
        float horizon = exp(-pow((h - 0.49) * 9.0, 2.0));
        c += glow * horizon * 0.23;
        float u = atan(normalize(vPos).z, normalize(vPos).x);
        c += glow * 0.02 * pow(max(0.0, sin(u * 8.0 + 1.0)), 8.0) * horizon;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  root.add(new THREE.Mesh(skyGeo, skyMat));

  // ---- Moon ---------------------------------------------------------
  const glowTex = makeGlowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: '#ffb3b3', transparent: true, opacity: 0.38,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  moonGlow.scale.set(40, 40, 1);
  moonGlow.position.set(48, 72, -140);
  root.add(moonGlow);
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(9, 48),
    new THREE.MeshBasicMaterial({ color: '#ffd9d2', transparent: true, opacity: 0.92 })
  );
  moon.position.set(48, 72, -141);
  root.add(moon);
  const moonShade = new THREE.Mesh(
    new THREE.CircleGeometry(9, 48),
    new THREE.MeshBasicMaterial({ color: '#c98d8d', transparent: true, opacity: 0.22 })
  );
  moonShade.position.set(51, 74, -140.6);
  moonShade.scale.set(0.38, 0.26, 1);
  root.add(moonShade);

  // ---- Stars --------------------------------------------------------
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 700; i++) {
    const r = 160 + Math.random() * 60;
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.random() * 0.55;
    starPos.push(
      Math.cos(phi) * Math.cos(theta) * r,
      Math.sin(theta) * r + 12,
      Math.sin(phi) * Math.cos(theta) * r
    );
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  root.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: '#dfe6ff', size: 0.55, transparent: true, opacity: 0.7,
    sizeAttenuation: true, depthWrite: false,
  })));

  // ---- Lighting -----------------------------------------------------
  const hemi = new THREE.HemisphereLight('#6879bc', '#22101b', 1.75);
  scene.add(hemi);

  const moonLight = new THREE.DirectionalLight('#c3ceff', 2.65);
  moonLight.position.set(18, 34, -22);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  moonLight.shadow.camera.left = -36;
  moonLight.shadow.camera.right = 36;
  moonLight.shadow.camera.top = 36;
  moonLight.shadow.camera.bottom = -36;
  moonLight.shadow.camera.near = 1;
  moonLight.shadow.camera.far = 95;
  moonLight.shadow.bias = -0.0015;
  scene.add(moonLight);

  const rim = new THREE.DirectionalLight('#ff3d62', 1.55);
  rim.position.set(-24, 10, 18);
  scene.add(rim);

  scene.fog = new THREE.FogExp2('#11101e', 0.0115);

  const arenaKey = new THREE.SpotLight('#aebeff', 95, 58, 1.02, 0.88, 1.45);
  arenaKey.position.set(0, 26, 10);
  arenaKey.target.position.set(0, 0, -2);
  scene.add(arenaKey);
  scene.add(arenaKey.target);

  const arenaRim = new THREE.PointLight('#ff2d54', 18, 36, 2);
  arenaRim.position.set(-8, 5, -10);
  scene.add(arenaRim);

  const centerGlow = new THREE.PointLight('#b54dff', 10, 25, 2);
  centerGlow.position.set(0, 3, 2);
  scene.add(centerGlow);

  // ---- Ground -------------------------------------------------------
  const groundTex = asphaltTexture();
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(42, 96),
    new THREE.MeshStandardMaterial({
      map: groundTex, color: '#b3b5c4', roughness: 0.3, metalness: 0.48,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  // Arena rings & markings
  const ringMat = new THREE.MeshBasicMaterial({
    color: '#ff334f', transparent: true, opacity: 0.22,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  for (const [radius, opacity] of [[31.5, 0.28], [23, 0.12], [15.5, 0.08]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.12, 128), ringMat.clone());
    ring.material.opacity = opacity;
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    root.add(ring);
  }

  const laneMat = new THREE.MeshBasicMaterial({
    color: '#f5cda2', transparent: true, opacity: 0.35, depthWrite: false,
  });
  for (let i = -2; i <= 2; i++) {
    for (let z = -24; z <= 24; z += 4.5) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 2.5), laneMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(i * 3.1 + 0.4, 0.013, z);
      root.add(line);
    }
  }

  // reflective looking puddles
  const puddleMat = new THREE.MeshStandardMaterial({
    color: '#35405f', roughness: 0.04, metalness: 0.88,
    emissive: '#141c34', emissiveIntensity: 0.65,
    transparent: true, opacity: 0.52,
  });
  for (let i = 0; i < 16; i++) {
    const r = 1.3 + Math.random() * 3.8;
    const p = new THREE.Mesh(new THREE.CircleGeometry(r, 26), puddleMat);
    p.rotation.x = -Math.PI / 2;
    p.scale.y = 0.45 + Math.random() * 0.5;
    p.position.set((Math.random() - 0.5) * 52, 0.018, (Math.random() - 0.5) * 52);
    root.add(p);
  }

  // ---- Cursed seal in center ----------------------------------------
  const seal = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 13),
    new THREE.MeshBasicMaterial({
      map: sealTexture(), transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, color: '#ff5b72',
    })
  );
  seal.rotation.x = -Math.PI / 2;
  seal.position.set(0, 0.025, -1);
  root.add(seal);
  ambiance.seals.push(seal);

  // ---- City ---------------------------------------------------------
  const city = new THREE.Group();
  root.add(city);
  const winTex = windowTexture();
  const buildingPalettes = ['#0f1424', '#151628', '#1a1423', '#111927', '#1c182a'];
  for (let i = 0; i < 27; i++) {
    const angle = (i / 27) * Math.PI * 2 + 0.08;
    const radius = 48 + Math.random() * 10;
    const w = 6 + Math.random() * 9;
    const d = 5 + Math.random() * 8;
    const h = 8 + Math.random() * 28;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color: buildingPalettes[i % buildingPalettes.length],
        map: winTex,
        roughness: 0.8,
        metalness: 0.2,
        emissive: '#2b2233',
        emissiveIntensity: 0.16,
      })
    );
    base.position.set(x, h / 2 - 0.2, z);
    base.rotation.y = -angle + Math.PI / 2;
    base.receiveShadow = true;
    city.add(base);

    // rooftop antennas
    if (Math.random() > 0.5) {
      const ant = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.09, 4 + Math.random() * 4, 5),
        new THREE.MeshBasicMaterial({ color: '#3d4160' })
      );
      ant.position.set(x, h + 2, z);
      city.add(ant);
      const blink = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: '#ff3048', transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      blink.scale.set(1.1, 1.1, 1);
      blink.position.set(x, h + 4.5, z);
      city.add(blink);
      ambiance.flickers.push({ sprite: blink, speed: 0.5 + Math.random() * 2, phase: Math.random() * 9 });
    }
  }

  // ---- Neon signs ---------------------------------------------------
  const signData = [
    { text: '呪術', sub: 'JUJUTSU', color: '#ff3b5c', pos: [-20, 11, -25], rot: 0.15, scale: [5, 10] },
    { text: '渋谷', sub: 'SHIBUYA', color: '#ff9d4d', pos: [22, 9, -28], rot: -0.18, scale: [4, 8] },
    { text: '祓', sub: 'EXORCISE', color: '#6de7ff', pos: [-28, 7, 14], rot: 1.45, scale: [3.4, 6.8] },
    { text: '領域', sub: 'DOMAIN', color: '#c26bff', pos: [29, 14, 11], rot: -1.5, scale: [4.2, 8.4] },
  ];
  for (const sd of signData) {
    const mat = new THREE.MeshBasicMaterial({
      map: signTexture(sd.text, sd.color, sd.sub), transparent: true,
      side: THREE.DoubleSide, toneMapped: false,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(sd.scale[0], sd.scale[1]), mat);
    sign.position.set(...sd.pos);
    sign.rotation.y = sd.rot;
    city.add(sign);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: sd.color, transparent: true, opacity: 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.scale.set(sd.scale[0] * 3, sd.scale[1] * 1.5, 1);
    halo.position.copy(sign.position);
    city.add(halo);
    ambiance.flickers.push({ sprite: halo, speed: 2 + Math.random() * 6, phase: Math.random() * 20 });
  }

  // ---- Torii gate ---------------------------------------------------
  const torii = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: '#9e1b29', roughness: 0.55, metalness: 0.2, emissive: '#2a0308', emissiveIntensity: 0.5 });
  const darkRed = new THREE.MeshStandardMaterial({ color: '#4b0b14', roughness: 0.75 });
  for (const x of [-7.4, 7.4]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.82, 12, 10), red);
    pillar.position.set(x, 6, 0);
    pillar.castShadow = true;
    torii.add(pillar);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.12, 0.7, 10), darkRed);
    base.position.set(x, 0.35, 0);
    torii.add(base);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(20.5, 0.7, 1.4), red);
  top.position.y = 11.7;
  torii.add(top);
  const topCap = new THREE.Mesh(new THREE.BoxGeometry(23, 0.5, 1.9), darkRed);
  topCap.position.y = 12.2;
  torii.add(topCap);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(17.2, 0.6, 1.1), darkRed);
  beam.position.y = 9.45;
  torii.add(beam);
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 3),
    new THREE.MeshBasicMaterial({ map: signTexture('呪', '#f0c47b'), transparent: true })
  );
  plaque.position.set(0, 10.2, 0.62);
  torii.add(plaque);
  torii.position.set(0, 0, -31);
  torii.rotation.y = 0;
  city.add(torii);
  ambiance.torii = torii;

  // lantern glow at torii
  for (const x of [-6, 6]) {
    const lant = new THREE.PointLight('#ff4f62', 18, 18, 2);
    lant.position.set(x, 6, -30);
    root.add(lant);
  }

  // ---- Street props -------------------------------------------------
  const drawCar = (x, z, rot, color) => {
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.65 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.65, 4.2), bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    car.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.62, 2.1), new THREE.MeshStandardMaterial({
      color: '#101527', roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.85,
    }));
    cabin.position.set(0, 1.13, -0.15);
    car.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.25, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#07080c', roughness: 0.9 });
    for (const wx of [-1.05, 1.05]) {
      for (const wz of [-1.3, 1.3]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.33, wz);
        car.add(w);
      }
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.06), new THREE.MeshBasicMaterial({ color: '#ff233b' }));
    tail.position.set(0, 0.72, 2.11);
    car.add(tail);
    car.position.set(x, 0, z);
    car.rotation.y = rot;
    root.add(car);
  };
  drawCar(-18, 4, 0.35, '#262c46');
  drawCar(19, -3, -0.25, '#3e1927');
  drawCar(15, 16, 1.2, '#191e2b');
  drawCar(-17, -15, -0.8, '#252036');

  // Vending machines (glowing panels)
  for (const [x, z, rot] of [[-24, -6, 0.4], [25, 7, -0.5], [-10, 20, 0.1]]) {
    const vend = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 1.1), new THREE.MeshStandardMaterial({
      color: '#171a25', roughness: 0.5, metalness: 0.5,
    }));
    box.position.y = 1.2;
    box.castShadow = true;
    vend.add(box);
    const glowPanel = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.35), new THREE.MeshBasicMaterial({
      color: '#7fe5ff', transparent: true, opacity: 0.82, toneMapped: false,
    }));
    glowPanel.position.set(0, 1.55, 0.559);
    vend.add(glowPanel);
    const vlight = new THREE.PointLight('#6de7ff', 6, 5, 2);
    vlight.position.set(0, 1.4, 1);
    vend.add(vlight);
    vend.position.set(x, 0, z);
    vend.rotation.y = rot;
    root.add(vend);
  }

  // scattered barriers / rubble
  const rubbleMat = new THREE.MeshStandardMaterial({ color: '#22232e', roughness: 0.9 });
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 20 + Math.random() * 13;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.25 + Math.random() * 0.8, 0.18 + Math.random() * 0.4, 0.25 + Math.random() * 0.9),
      rubbleMat
    );
    box.position.set(Math.cos(a) * r, 0.15, Math.sin(a) * r);
    box.rotation.set(Math.random(), Math.random() * 6, Math.random());
    box.castShadow = true;
    root.add(box);
  }

  // ---- Cursed veil --------------------------------------------------
  const veilMat = new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      varying vec3 vWorld; varying vec3 vNormal;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec3 vWorld; varying vec3 vNormal;
      void main() {
        float a = atan(vWorld.z, vWorld.x);
        float bands = smoothstep(0.72, 1.0, sin(a * 18.0 + time * 0.15) * 0.5 + 0.5);
        float h = clamp(vWorld.y / 36.0, 0.0, 1.0);
        float glow = bands * (1.0 - h) * 0.12 + pow(1.0 - h, 3.0) * 0.045;
        vec3 col = mix(vec3(0.42, 0.1, 0.95), vec3(1.0, 0.11, 0.32), bands);
        gl_FragColor = vec4(col, glow);
      }
    `,
  });
  const veil = new THREE.Mesh(new THREE.CylinderGeometry(38, 39, 40, 72, 1, true), veilMat);
  veil.position.y = 18;
  root.add(veil);
  ambiance.veil = veil;

  const veilRing = new THREE.Mesh(
    new THREE.TorusGeometry(37.8, 0.16, 8, 128),
    new THREE.MeshBasicMaterial({ color: '#a44dff', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  veilRing.rotation.x = Math.PI / 2;
  veilRing.position.y = 1.6;
  root.add(veilRing);
  ambiance.veilRing = veilRing;

  // ---- Floating particles ------------------------------------------
  const emberCount = 220;
  const emberGeo = new THREE.BufferGeometry();
  const emberPositions = new Float32Array(emberCount * 3);
  const emberSeeds = [];
  for (let i = 0; i < emberCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 5 + Math.random() * 31;
    emberSeeds.push({
      a, r, y: Math.random() * 14, speed: 0.2 + Math.random() * 0.9,
      drift: (Math.random() - 0.5) * 0.4, size: 0.04 + Math.random() * 0.12,
    });
    emberPositions[i * 3] = Math.cos(a) * r;
    emberPositions[i * 3 + 1] = Math.random() * 14;
    emberPositions[i * 3 + 2] = Math.sin(a) * r;
  }
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
  const emberMat = new THREE.PointsMaterial({
    map: glowTex, color: '#ff596e', size: 0.26, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  ambiance.embers = new THREE.Points(emberGeo, emberMat);
  root.add(ambiance.embers);

  const dustCount = 420;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 70;
    dustPos[i * 3 + 1] = Math.random() * 18;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  ambiance.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    map: glowTex, color: '#b8c6ff', size: 0.07, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  root.add(ambiance.dust);

  // ---- Paper talismans ---------------------------------------------
  const paperMat = new THREE.MeshBasicMaterial({ color: '#f4e6c8', side: THREE.DoubleSide });
  for (let i = 0; i < 14; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.8), paperMat);
    p.position.set((Math.random() - 0.5) * 50, 2 + Math.random() * 9, (Math.random() - 0.5) * 50);
    p.rotation.set(Math.random(), Math.random(), Math.random());
    root.add(p);
    ambiance.seals.push(p);
  }

  function update(dt, elapsed) {
    ambiance.time += dt;
    const t = ambiance.time;

    skyMat.uniforms.glow.value.setHSL((0.97 + Math.sin(t * 0.05) * 0.015) % 1, 0.75, 0.55);
    seal.rotation.z = t * 0.04;
    seal.material.opacity = 0.34 + Math.sin(t * 1.2) * 0.09;
    veilMat.uniforms.time.value = t;
    veilRing.material.opacity = 0.4 + Math.sin(t * 1.7) * 0.16;

    for (const f of ambiance.flickers) {
      const v = 0.55 + Math.sin(t * f.speed + f.phase) * 0.22 + Math.sin(t * f.speed * 4.3 + f.phase) * 0.1;
      f.sprite.material.opacity = Math.max(0.06, v);
    }

    // embers rise
    const pos = ambiance.embers.geometry.attributes.position;
    for (let i = 0; i < emberCount; i++) {
      const s = emberSeeds[i];
      s.y += s.speed * dt;
      s.a += s.drift * dt * 0.12;
      if (s.y > 18) s.y = 0.2;
      pos.setXYZ(i, Math.cos(s.a) * s.r, s.y, Math.sin(s.a) * s.r);
    }
    pos.needsUpdate = true;

    const dpos = ambiance.dust.geometry.attributes.position;
    for (let i = 0; i < dustCount; i++) {
      let y = dpos.getY(i) + dt * 0.12;
      if (y > 18) y = 0;
      dpos.setY(i, y);
      dpos.setX(i, dpos.getX(i) + Math.sin(t + i) * dt * 0.05);
    }
    dpos.needsUpdate = true;

    for (let i = 0; i < ambiance.seals.length; i++) {
      const p = ambiance.seals[i];
      if (p === seal) continue;
      p.rotation.y += dt * 0.3;
      p.position.y += Math.sin(t + i) * dt * 0.12;
    }

    // lantern sway
    for (const l of ambiance.lanterns) {
      l.rotation.z = Math.sin(t * 1.2 + l.userData.phase) * 0.08;
    }
  }

  return {
    root,
    update,
    glowTex,
    ground,
    bounds: 33,
    skyMaterial: skyMat,
  };
}
