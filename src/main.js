import * as THREE from '../vendor/three.module.js';
import { EffectComposer } from '../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/jsm/postprocessing/OutputPass.js';
import { createWorld, makeGlowTexture } from './world.js';
import {
  createHero, createGrunt, createBrute, createBoss,
  animateHero, animateEnemy, setFlash, glowSprite,
} from './models.js';
import { SoundEngine } from './audio.js';

/* ------------------------------------------------------------------ */
/*  DOM                                                                */
/* ------------------------------------------------------------------ */

const $ = (s) => document.querySelector(s);
const canvas = $('#game-canvas');
const ui = {
  menu: $('#menu'),
  hud: $('#hud'),
  pause: $('#pause'),
  result: $('#result'),
  how: $('#how'),
  loader: $('#loader'),
  waveBanner: $('#wave-banner'),
  wbKicker: $('#wb-kicker'),
  wbTitle: $('#wb-title'),
  wbSub: $('#wb-sub'),
  announcement: $('#announcement'),
  healthFill: $('#health-fill'),
  healthText: $('#health-text'),
  energyFill: $('#energy-fill'),
  energyText: $('#energy-text'),
  ultimate: $('#ultimate-ready'),
  combo: $('#combo'),
  comboCount: $('#combo-count'),
  comboRank: $('#combo-rank'),
  score: $('#score'),
  waveNum: $('#wave-num'),
  waveFill: $('#wave-fill'),
  objectiveTitle: $('#objective-title'),
  objectiveText: $('#objective-text'),
  bossPanel: $('#boss-panel'),
  bossHealth: $('#boss-health'),
  damage: $('#damage-overlay'),
  flash: $('#flash-overlay'),
  domain: $('#domain-overlay'),
  floating: $('#floating-layer'),
  killFeed: $('#kill-feed'),
  mute: $('#mute-btn'),
  mobileUlt: $('#m-ultimate'),
  bossName: $('#boss-name'),
};

/* ------------------------------------------------------------------ */
/*  Renderer / scene                                                   */
/* ------------------------------------------------------------------ */

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const gl = renderer.getContext();
const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
const gpuName = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
const softwareGPU = /swiftshader|llvmpipe|software rasterizer/i.test(String(gpuName));
const urlParams = new URLSearchParams(location.search);
const forceQuality = urlParams.get('quality');
const lowQuality = forceQuality === 'low' || (softwareGPU && forceQuality !== 'high');
renderer.shadowMap.enabled = !lowQuality;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
if (lowQuality) renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1) * 0.72);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(57, window.innerWidth / window.innerHeight, 0.1, 420);
camera.position.set(10, 5, 14);

const world = createWorld(scene, renderer);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.72, 0.55, 0.72
);
bloom.enabled = !lowQuality;
composer.addPass(bloom);
composer.addPass(new OutputPass());

const audio = new SoundEngine();
const glowTex = makeGlowTexture();

/* ------------------------------------------------------------------ */
/*  Game state                                                         */
/* ------------------------------------------------------------------ */

const WAVES = [
  {
    kicker: 'WAVE I', title: 'THE VEIL THICKENS', sub: 'Cursed remnants are converging',
    objective: 'EXORCISE THE CURSED', desc: 'Clear the crossing. Stay alive.',
    groups: [['grunt', 5]],
  },
  {
    kicker: 'WAVE II', title: 'CROSSING OF THE DAMNED', sub: 'The city exhales curses',
    objective: 'HOLD THE CROSSING', desc: 'More spirits crawl out of the dark.',
    groups: [['grunt', 7], ['brute', 1]],
  },
  {
    kicker: 'WAVE III', title: 'BLOOD ON THE PAVEMENT', sub: 'Something larger stirs',
    objective: 'BREAK THE HORDE', desc: 'Brutes are pushing through the veil.',
    groups: [['grunt', 8], ['brute', 3]],
  },
  {
    kicker: 'WAVE IV', title: 'THE CURTAIN SCREAMS', sub: 'Cursed energy is spiking',
    objective: 'SURVIVE THE SURGE', desc: 'The final veil is tearing open.',
    groups: [['grunt', 10], ['brute', 4]],
  },
  {
    kicker: 'FINAL WAVE', title: 'THE PATCHWORK CURSE', sub: 'Special grade manifestation',
    objective: 'EXORCISE THE SPECIAL GRADE', desc: 'End this. Land the Black Flash.',
    groups: [['boss', 1], ['grunt', 3]], boss: true,
  },
];

const game = {
  mode: 'menu',
  wave: 0,
  waveActive: false,
  spawnQueue: [],
  spawnTimer: 0,
  intermission: 0,
  score: 0,
  kills: 0,
  maxCombo: 0,
  elapsed: 0,
  hitStop: 0,
  shake: 0,
  damageFlash: 0,
  menuAngle: 0.72,
  tutorialTip: false,
};

const player = {
  group: createHero(),
  rig: null,
  pos: new THREE.Vector3(0, 0, 10),
  facing: Math.PI,
  health: 100,
  maxHealth: 100,
  energy: 0,
  speed: 8.2,
  invuln: 0,
  hurtTimer: 0,
  dashTimer: 0,
  dashCooldown: 0,
  dashDir: new THREE.Vector3(0, 0, -1),
  attack: null,
  attackChain: 0,
  lastAttackTime: -10,
  cooldown: 0,
  combo: 0,
  comboTimer: 0,
  blackFlash: null,
  moving: false,
  strafe: 0,
  dead: false,
  deathT: 0,
};
player.rig = player.group.userData.rig;
scene.add(player.group);
player.group.position.set(4.9, 0, 0.3);
player.group.rotation.y = 0.72;
player.pos.set(4.9, 0, 0.3);
player.facing = 0.72;

const enemies = [];
const effects = [];
const projectiles = [];
const pickups = [];
const floatTexts = [];
const menuEnemies = [];

// Menu ambience: a few silhouettes for depth.
function buildMenuEnemies() {
  const spots = [
    [-5.4, -2.5, 0.3],
    [6.2, -6.5, -0.2],
    [2.5, -11.5, 0.1],
  ];
  for (const [x, z, r] of spots) {
    const g = createGrunt(Math.floor(Math.random() * 3));
    g.position.set(x, 0, z);
    g.rotation.y = r;
    g.scale.setScalar(0.9);
    scene.add(g);
    menuEnemies.push(g);
  }
  const brute = createBrute();
  brute.position.set(-8.5, 0, -12);
  brute.rotation.y = 0.5;
  brute.scale.setScalar(0.85);
  scene.add(brute);
  menuEnemies.push(brute);
}
buildMenuEnemies();

/* ------------------------------------------------------------------ */
/*  Input                                                              */
/* ------------------------------------------------------------------ */

const keys = Object.create(null);
const joystick = { x: 0, y: 0, active: false };
const cameraState = { yaw: 0, pitch: 0.09, distance: 7.6 };
let dragging = false;
let dragPointer = null;
let lookTouch = null;

function isPlaying() { return game.mode === 'playing'; }

function moveInput() {
  let x = 0;
  let y = 0;
  if (keys['w'] || keys['arrowup']) y += 1;
  if (keys['s'] || keys['arrowdown']) y -= 1;
  if (keys['d'] || keys['arrowright']) x += 1;
  if (keys['a'] || keys['arrowleft']) x -= 1;
  if (joystick.active) {
    x += joystick.x;
    y += -joystick.y;
  }
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y };
}

function cameraForward(yaw = cameraState.yaw) {
  return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
}
function cameraRight(yaw = cameraState.yaw) {
  return new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
}
function shortestAngle(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function requestLook(event) {
  if (event.pointerType === 'mouse' && document.pointerLockElement !== canvas && isPlaying() && canvas.requestPointerLock) {
    try { canvas.requestPointerLock(); } catch {}
  }
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (game.mode === 'paused' && (k === 'escape' || k === 'p')) {
    resumeGame();
    return;
  }
  if (!isPlaying()) {
    if (k === 'escape') {
      if (ui.how.classList.contains('is-visible')) closeHow();
    }
    return;
  }
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if (k === 'j') tryAttack('light');
  if (k === 'k') tryAttack('heavy');
  if (k === 'e') triggerBlackFlash();
  if (k === 'shift' || k === ' ') dash();
  if (k === 'escape' || k === 'p') pauseGame();
}, { passive: false });

window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => {
  for (const k of Object.keys(keys)) keys[k] = false;
  if (isPlaying()) pauseGame();
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (!isPlaying()) return;
  e.preventDefault();
  requestLook(e);
  if (e.button === 0) tryAttack('light');
  if (e.button === 2) tryAttack('heavy');
});
canvas.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) {
    cameraState.yaw -= e.movementX * 0.0023;
    cameraState.pitch = THREE.MathUtils.clamp(cameraState.pitch + e.movementY * 0.0018, -0.16, 0.72);
  } else if (dragging) {
    cameraState.yaw -= e.movementX * 0.004;
    cameraState.pitch = THREE.MathUtils.clamp(cameraState.pitch + e.movementY * 0.003, -0.16, 0.72);
  }
});
canvas.addEventListener('mousedown', (e) => {
  if (e.pointerType === 'mouse' && document.pointerLockElement !== canvas) {
    dragging = true;
    dragPointer = e.pointerId;
  }
});
window.addEventListener('mouseup', () => { dragging = false; dragPointer = null; });
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch' && isPlaying()) {
    lookTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch' && lookTouch && lookTouch.id === e.pointerId) {
    const dx = e.clientX - lookTouch.x;
    const dy = e.clientY - lookTouch.y;
    cameraState.yaw -= dx * 0.006;
    cameraState.pitch = THREE.MathUtils.clamp(cameraState.pitch + dy * 0.004, -0.16, 0.72);
    lookTouch.x = e.clientX;
    lookTouch.y = e.clientY;
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (lookTouch && lookTouch.id === e.pointerId) lookTouch = null;
});
canvas.addEventListener('pointercancel', () => { lookTouch = null; });

// Joystick
const joyEl = $('#joystick');
const joyKnob = $('#joystick-knob');
let joyId = null;
function updateJoystick(e) {
  const r = joyEl.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  let dx = e.clientX - cx;
  let dy = e.clientY - cy;
  const max = r.width * 0.34;
  const len = Math.hypot(dx, dy);
  if (len > max) { dx = dx / len * max; dy = dy / len * max; }
  joystick.x = dx / max;
  joystick.y = dy / max;
  joystick.active = true;
  joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}
joyEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  joyId = e.pointerId;
  joyEl.setPointerCapture(e.pointerId);
  updateJoystick(e);
  audio.init();
});
joyEl.addEventListener('pointermove', (e) => {
  if (joyId === e.pointerId) updateJoystick(e);
});
joyEl.addEventListener('pointerup', (e) => {
  if (joyId !== e.pointerId) return;
  joyId = null;
  joystick.x = 0; joystick.y = 0; joystick.active = false;
  joyKnob.style.transform = 'translate(-50%, -50%)';
});
joyEl.addEventListener('pointercancel', () => {
  joyId = null;
  joystick.x = 0; joystick.y = 0; joystick.active = false;
  joyKnob.style.transform = 'translate(-50%, -50%)';
});

document.querySelectorAll('[data-action]').forEach((btn) => {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    btn.classList.add('down');
    audio.init();
    const action = btn.dataset.action;
    if (action === 'attack') tryAttack('light');
    if (action === 'heavy') tryAttack('heavy');
    if (action === 'dash') dash();
    if (action === 'ultimate') triggerBlackFlash();
  });
  btn.addEventListener('pointerup', () => btn.classList.remove('down'));
  btn.addEventListener('pointercancel', () => btn.classList.remove('down'));
});

/* ------------------------------------------------------------------ */
/*  Combat                                                             */
/* ------------------------------------------------------------------ */

function tryAttack(kind) {
  if (!isPlaying() || player.dead || player.blackFlash) return;
  if (player.cooldown > 0) return;
  if (player.attack && player.attack.t < player.attack.hitAt * 0.92) return;

  const dir = cameraForward();
  player.facing = Math.atan2(dir.x, dir.z);
  player.group.rotation.y = player.facing;

  let duration = 0.35;
  let hitAt = 0.14;
  let chain = 0;
  if (kind === 'heavy') {
    duration = 0.72;
    hitAt = 0.32;
    player.cooldown = 0.12;
    player.attackChain = 0;
  } else {
    const within = game.elapsed - player.lastAttackTime < 0.85;
    chain = within ? (player.attackChain + 1) % 3 : 0;
    player.attackChain = chain;
    if (chain === 2) {
      duration = 0.46;
      hitAt = 0.19;
      player.cooldown = 0.05;
    } else {
      duration = 0.33;
      hitAt = 0.12;
      player.cooldown = 0.02;
    }
  }
  player.lastAttackTime = game.elapsed;
  player.attack = { kind, t: 0, duration, hitAt, didHit: false, chain, dir };
  audio.whoosh(kind === 'heavy' ? 0.58 : 0.9 + chain * 0.15);
}

function damageEnemy(enemy, amount, crit, fromPos, knockback = 0) {
  if (enemy.dead) return;
  enemy.hp -= amount;
  enemy.flash = 0.13;
  enemy.hitStun = crit ? 0.24 : 0.11;
  setFlash(enemy.rig, 1);
  const dir = new THREE.Vector3(enemy.pos.x - fromPos.x, 0, enemy.pos.z - fromPos.z);
  if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);
  dir.normalize();
  enemy.knock.addScaledVector(dir, knockback);

  const hitPos = new THREE.Vector3(enemy.pos.x, 1.3 + (enemy.type === 'boss' ? 2.3 : 0), enemy.pos.z);
  spawnHitSpark(hitPos, crit ? '#ffd48a' : '#ff405d', crit ? 22 : 12);
  spawnFloatingNumber(hitPos, Math.round(amount), crit);
  player.energy = Math.min(100, player.energy + (crit ? 14 : 7));
  player.combo += 1;
  player.comboTimer = 2.6;
  game.maxCombo = Math.max(game.maxCombo, player.combo);
  const mult = 1 + Math.min(2, player.combo * 0.045);
  game.score += Math.round((crit ? 170 : 70) * mult);
  game.shake = Math.max(game.shake, crit ? 0.85 : 0.32);
  game.hitStop = Math.max(game.hitStop, crit ? 0.075 : 0.035);
  audio.hit(crit);

  if (enemy.hp <= 0) killEnemy(enemy);
}

function meleeHit(kind) {
  const dir = player.attack.dir;
  const heavy = kind === 'heavy';
  const range = heavy ? 4.7 : 3.15;
  const arc = heavy ? 0.12 : 0.28;
  const origin = player.pos.clone();
  const forward = dir.clone().normalize();
  const center = new THREE.Vector3(
    player.pos.x + forward.x * (heavy ? 2.3 : 1.5),
    0,
    player.pos.z + forward.z * (heavy ? 2.3 : 1.5)
  );
  spawnSlash(center, player.facing, heavy ? '#ff6b52' : '#bff5ff', heavy ? 6.4 : 4.4, heavy);
  spawnShockwave(player.pos, heavy ? '#ff533f' : '#81e8ff', heavy ? 5.2 : 2.8, heavy ? 0.48 : 0.28);
  if (heavy) audio.hit(true);

  let hits = 0;
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.pos.x - player.pos.x;
    const dz = e.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > range + e.radius) continue;
    const dot = (dx / Math.max(0.001, d)) * forward.x + (dz / Math.max(0.001, d)) * forward.z;
    if (dot < arc) continue;
    const damage = heavy ? (68 + player.combo * 1.2) : (26 + player.attack.chain * 8);
    damageEnemy(e, damage, heavy, player.pos, heavy ? 9 : 3.4);
    hits++;
    if (!heavy && hits >= 2) break;
  }

  if (hits === 0) {
    // small unsatisfying whiff dust
    spawnHitSpark(new THREE.Vector3(center.x, 1.1, center.z), '#7fdbff', 4);
  }
}

function dash() {
  if (!isPlaying() || player.dead || player.blackFlash) return;
  if (player.dashCooldown > 0) return;
  const mv = moveInput();
  let dir;
  if (mv.x || mv.y) {
    dir = cameraForward().multiplyScalar(mv.y).add(cameraRight().multiplyScalar(mv.x)).normalize();
  } else {
    dir = cameraForward();
  }
  player.dashDir.copy(dir);
  player.dashTimer = 0.18;
  player.dashCooldown = 0.85;
  player.invuln = Math.max(player.invuln, 0.36);
  player.facing = Math.atan2(dir.x, dir.z);
  player.group.rotation.y = player.facing;
  audio.dash();
  spawnShockwave(player.pos, '#ff5e79', 2.2, 0.22);
  spawnAfterimage();
}

function triggerBlackFlash() {
  if (!isPlaying() || player.dead || player.blackFlash) return;
  if (player.energy < 100) {
    announce('CURSED ENERGY INSUFFICIENT');
    return;
  }
  player.energy = 0;
  player.blackFlash = { t: 0, hit: false };
  player.invuln = 2.4;
  player.attack = null;
  player.cooldown = 0.2;
  audio.blackFlash();
  ui.domain.classList.remove('on');
  void ui.domain.offsetWidth;
  ui.domain.classList.add('on');
  game.shake = 0.75;
  spawnBlackFlashAura();
  setTimeout(() => ui.domain.classList.remove('on'), 2100);
}

function doBlackFlashHit() {
  const center = player.pos.clone();
  game.hitStop = 0.1;
  game.shake = 2.2;
  flashScreen('red', 0.36);
  audio.blackFlash();
  spawnShockwave(center, '#ff1738', 11.5, 0.9);
  spawnShockwave(center, '#ffffff', 7.5, 0.55);
  spawnLightning(center, 16);
  spawnHitSpark(new THREE.Vector3(center.x, 2.1, center.z), '#ff314c', 70);
  spawnBlackFlashPillar(center);

  let hitCount = 0;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.pos.x - center.x, e.pos.z - center.z);
    if (d > 9.5 + e.radius) continue;
    const dmg = e.type === 'boss' ? 460 : 520;
    damageEnemy(e, dmg, true, center, 16);
    hitCount++;
  }
  if (hitCount > 0) {
    announce('BLACK FLASH // SPACE DISTORTED');
  } else {
    announce('BLACK FLASH // NO TARGET');
  }
  player.combo += 1;
  player.comboTimer = 3;
  game.score += 1500;
}

function damagePlayer(amount, sourcePos) {
  if (!isPlaying() || player.dead) return;
  if (player.invuln > 0 || player.dashTimer > 0) return;
  player.health = Math.max(0, player.health - amount);
  player.invuln = 0.7;
  player.hurtTimer = 0.35;
  player.combo = 0;
  player.comboTimer = 0;
  game.damageFlash = 0.65;
  game.shake = Math.max(game.shake, 0.7);
  audio.hurt();
  flashScreen('red', 0.14);
  spawnFloatingNumber(new THREE.Vector3(player.pos.x, 2.5, player.pos.z), amount, false, '#ff2646');
  if (player.health <= 0) endGame(false);
}

function killEnemy(enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  enemy.deathT = 0;
  enemy.telegraph?.removeFromParent();
  enemy.telegraph = null;
  game.kills += 1;
  const value = enemy.type === 'boss' ? 10000 : enemy.type === 'brute' ? 650 : 260;
  game.score += value;
  player.energy = Math.min(100, player.energy + (enemy.type === 'boss' ? 35 : 13));
  audio.enemyDie();
  spawnHitSpark(new THREE.Vector3(enemy.pos.x, 1.5, enemy.pos.z), enemy.type === 'brute' ? '#ff9b57' : '#ff2f55', enemy.type === 'boss' ? 65 : 26);
  spawnShockwave(enemy.pos, '#ff2448', enemy.type === 'boss' ? 8 : 2.8, 0.45);

  if (enemy.type === 'boss') {
    game.shake = 2.5;
    game.hitStop = 0.25;
    flashScreen('white', 0.5);
    announce('SPECIAL GRADE EXORCISED');
  } else if (enemy.type === 'brute') {
    flashScreen('black', 0.16);
  }

  if (Math.random() < 0.2 || enemy.type === 'boss') {
    spawnPickup(enemy.pos.clone(), enemy.type === 'boss' ? 50 : 14);
  }
  addKillFeed(enemy.type);
}

/* ------------------------------------------------------------------ */
/*  Enemies                                                            */
/* ------------------------------------------------------------------ */

function enemyStats(type, wave) {
  const w = wave + 1;
  if (type === 'boss') {
    return {
      hp: 1280, speed: 1.72, damage: 22, radius: 1.35,
      range: 3.8, windup: 0.68, cooldown: 1.35, score: 10000,
    };
  }
  if (type === 'brute') {
    return {
      hp: 124 + w * 17, speed: 1.85 + w * 0.05, damage: 12 + w * 1.4, radius: 0.82,
      range: 3.05, windup: 0.62, cooldown: 1.5, score: 650,
    };
  }
  return {
    hp: 42 + w * 7, speed: 2.25 + w * 0.13 + Math.random() * 0.35, damage: 6.5 + w * 1.1, radius: 0.55,
    range: 2.1, windup: 0.5, cooldown: 1.28, score: 260,
  };
}

function spawnEnemy(type, position) {
  const group = type === 'boss' ? createBoss() : type === 'brute' ? createBrute() : createGrunt(Math.floor(Math.random() * 3));
  group.position.set(position.x, 0, position.z);
  scene.add(group);
  const stats = enemyStats(type, game.wave);
  const enemy = {
    type,
    group,
    rig: group.userData.rig,
    pos: new THREE.Vector3(position.x, 0, position.z),
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed,
    damage: stats.damage,
    radius: stats.radius,
    range: stats.range,
    windupBase: stats.windup,
    cooldownBase: stats.cooldown,
    state: 'chase',
    stateT: 0,
    attackCd: 1.2 + Math.random() * 0.9,
    windup: 0,
    knock: new THREE.Vector3(),
    flash: 0,
    dead: false,
    deathT: 0,
    telegraph: null,
    specialCd: 4.5,
    hasBossBar: type === 'boss',
    phase: Math.random() * 10,
  };
  group.scale.setScalar(type === 'boss' ? 0.9 : 1);
  enemies.push(enemy);
  spawnSpawnPillar(enemy.pos, type === 'boss' ? '#ff173d' : '#a35bff');
  if (type === 'boss') {
    ui.bossPanel.classList.remove('hidden');
    game.shake = 1.4;
  }
  return enemy;
}

function chooseSpawnPosition(minDistance = 12) {
  const forwardAngle = cameraState.yaw + Math.PI;
  for (let tries = 0; tries < 24; tries++) {
    const a = forwardAngle + (Math.random() - 0.5) * 2.1;
    const r = 16 + Math.random() * 10;
    const x = player.pos.x + Math.sin(a) * r;
    const z = player.pos.z + Math.cos(a) * r;
    if (Math.hypot(x, z) < 30.5 && Math.hypot(x - player.pos.x, z - player.pos.z) > minDistance) {
      return new THREE.Vector3(x, 0, z);
    }
  }
  return new THREE.Vector3(player.pos.x, 0, player.pos.z - 18);
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    if (e.dead) {
      e.deathT += dt;
      const p = Math.min(1, e.deathT / 0.55);
      e.group.scale.setScalar(Math.max(0.001, 1 - p * p));
      e.group.rotation.z += dt * 2;
      e.rig.aura.material.opacity = Math.max(0, 0.3 * (1 - p));
      if (e.deathT > 0.58) {
        scene.remove(e.group);
        enemies.splice(i, 1);
      }
      continue;
    }

    if (e.flash > 0) {
      e.flash -= dt;
      if (e.flash <= 0) setFlash(e.rig, 0);
    }

    if (e.state === 'spawn') {
      e.stateT -= dt;
      const p = 1 - Math.max(0, e.stateT) / 0.7;
      const s = e.type === 'boss' ? 1 : 1;
      e.group.scale.setScalar(Math.max(0.001, s * (0.8 + Math.sin(p * Math.PI) * 0.3)));
      if (e.stateT <= 0) {
        e.state = 'chase';
        e.group.scale.setScalar(1);
        spawnShockwave(e.pos, e.type === 'boss' ? '#ff173d' : '#c35bff', e.type === 'boss' ? 6 : 2.4, 0.4);
      }
      animateEnemy(e.rig, dt, game.elapsed, { moving: false });
      continue;
    }

    const dx = player.pos.x - e.pos.x;
    const dz = player.pos.z - e.pos.z;
    const dist = Math.hypot(dx, dz);
    const dirX = dx / Math.max(0.001, dist);
    const dirZ = dz / Math.max(0.001, dist);

    if (e.knock.lengthSq() > 0.005) {
      e.pos.x += e.knock.x * dt;
      e.pos.z += e.knock.z * dt;
      e.knock.multiplyScalar(Math.pow(0.03, dt));
    }

    if (e.hitStun > 0) {
      e.hitStun -= dt;
    } else if (e.state === 'windup') {
      e.windup -= dt;
      if (e.telegraph) {
        const p = 1 - Math.max(0, e.windup) / e.windupBase;
        e.telegraph.scale.setScalar(0.8 + p * 0.35);
        e.telegraph.material.opacity = 0.28 + p * 0.35;
      }
      if (e.windup <= 0) {
        enemyAttack(e, dist);
        e.state = 'recover';
        e.stateT = 0.48;
        e.telegraph?.removeFromParent();
        e.telegraph = null;
      }
    } else if (e.state === 'special') {
      e.windup -= dt;
      if (e.telegraph) {
        e.telegraph.material.opacity = 0.4 + Math.sin(game.elapsed * 18) * 0.16;
      }
      if (e.windup <= 0) {
        fireBossVolley(e);
        e.state = 'recover';
        e.stateT = 0.7;
        e.telegraph?.removeFromParent();
        e.telegraph = null;
      }
    } else if (e.state === 'recover') {
      e.stateT -= dt;
      if (e.stateT <= 0) e.state = 'chase';
    } else {
      e.attackCd -= dt;
      e.specialCd -= dt;
      const canSpecial = e.type === 'boss' && e.specialCd <= 0 && dist > 6.5;
      if (canSpecial) {
        e.state = 'special';
        e.windup = 0.85;
        e.specialCd = 4.6;
        makeTelegraph(e, 3.2, '#ff7a37');
      } else if (dist <= e.range && e.attackCd <= 0) {
        e.state = 'windup';
        e.windup = e.windupBase;
        e.attackCd = e.cooldownBase;
        makeTelegraph(e, e.type === 'boss' ? 4.3 : 2.4, e.type === 'boss' ? '#ff203f' : '#ff4b6b');
      } else if (dist > e.range * 0.82) {
        e.pos.x += dirX * e.speed * dt;
        e.pos.z += dirZ * e.speed * dt;
      }
    }

    // separation
    for (let j = 0; j < enemies.length; j++) {
      const o = enemies[j];
      if (o === e || o.dead) continue;
      const sx = e.pos.x - o.pos.x;
      const sz = e.pos.z - o.pos.z;
      const sd = Math.hypot(sx, sz);
      const min = (e.radius + o.radius) * 0.95;
      if (sd < min && sd > 0.001) {
        const push = (min - sd) * 0.5;
        e.pos.x += (sx / sd) * push;
        e.pos.z += (sz / sd) * push;
      }
    }

    // arena bounds
    const pr = Math.hypot(e.pos.x, e.pos.z);
    if (pr > 31.5) {
      e.pos.x = (e.pos.x / pr) * 31.5;
      e.pos.z = (e.pos.z / pr) * 31.5;
    }

    e.group.position.x = e.pos.x;
    e.group.position.z = e.pos.z;
    e.group.rotation.y = Math.atan2(dirX, dirZ);
    if (e.type === 'boss') {
      e.group.rotation.y = Math.atan2(dirX, dirZ) + Math.sin(game.elapsed * 0.8) * 0.04;
    }

    const moving = dist > e.range * 0.9 && e.state === 'chase';
    animateEnemy(e.rig, dt, game.elapsed + e.phase, { moving });
  }
}

function makeTelegraph(e, radius, color) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.78, radius, 48),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.36, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(e.pos.x, 0.035, e.pos.z);
  scene.add(mesh);
  e.telegraph = mesh;
}

function enemyAttack(e, dist) {
  const reach = e.type === 'boss' ? 5.2 : e.type === 'brute' ? 3.9 : 2.6;
  if (dist <= reach) {
    damagePlayer(Math.round(e.damage), e.pos);
    spawnShockwave(e.pos, '#ff304e', e.type === 'boss' ? 5.5 : 2.2, 0.35);
  } else {
    spawnHitSpark(new THREE.Vector3(e.pos.x, 0.4, e.pos.z), '#ff4b6b', 5);
  }
  if (e.type === 'boss') {
    game.shake = Math.max(game.shake, 0.8);
    spawnShockwave(e.pos, '#ff1738', 7.5, 0.55);
  }
}

function fireBossVolley(e) {
  audio.hit(true);
  const dir = new THREE.Vector3(player.pos.x - e.pos.x, 0, player.pos.z - e.pos.z).normalize();
  const baseAngle = Math.atan2(dir.x, dir.z);
  for (let i = -1; i <= 1; i++) {
    const a = baseAngle + i * 0.17;
    const g = new THREE.Group();
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.32, 1),
      new THREE.MeshBasicMaterial({ color: '#ff2f4b' })
    );
    g.add(orb);
    const halo = glowSprite('rgba(255,40,75,0.95)', 2.4, 0.8);
    g.add(halo);
    const light = new THREE.PointLight('#ff2344', 4, 4, 2);
    g.add(light);
    g.position.set(e.pos.x, 2.2, e.pos.z);
    scene.add(g);
    projectiles.push({
      group: g,
      pos: g.position,
      vel: new THREE.Vector3(Math.sin(a) * 10.5, 0, Math.cos(a) * 10.5),
      life: 3.2,
      radius: 0.55,
      damage: 14,
    });
  }
  spawnShockwave(e.pos, '#ff7a37', 3.6, 0.38);
}

/* ------------------------------------------------------------------ */
/*  Projectiles / pickups                                              */
/* ------------------------------------------------------------------ */

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    p.pos.x += p.vel.x * dt;
    p.pos.z += p.vel.z * dt;
    p.group.rotation.y += dt * 7;
    const d = Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z);
    if (d < 0.8 && p.life > 0) {
      damagePlayer(p.damage, p.pos);
      spawnHitSpark(p.pos.clone(), '#ff3d58', 16);
      p.life = 0;
    }
    if (p.life <= 0) {
      spawnShockwave(p.pos, '#ff3d58', 1.6, 0.25);
      scene.remove(p.group);
      projectiles.splice(i, 1);
    }
  }
}

function spawnPickup(pos, amount = 14) {
  const g = new THREE.Group();
  const orb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.22, 1),
    new THREE.MeshBasicMaterial({ color: '#f3c67a' })
  );
  g.add(orb);
  const halo = glowSprite('rgba(255,210,130,0.8)', 1.7, 0.65);
  g.add(halo);
  g.position.set(pos.x, 1, pos.z);
  scene.add(g);
  pickups.push({ group: g, amount, life: 13, phase: Math.random() * 8 });
}

function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.life -= dt;
    p.group.position.y = 1 + Math.sin(game.elapsed * 2.5 + p.phase) * 0.18;
    p.group.rotation.y += dt * 1.8;
    const d = Math.hypot(p.group.position.x - player.pos.x, p.group.position.z - player.pos.z);
    if (d < 1.55) {
      player.health = Math.min(player.maxHealth, player.health + p.amount);
      player.energy = Math.min(100, player.energy + 10);
      announce(`CURSED RESIDUE ABSORBED // +${p.amount} VITALS`);
      spawnHitSpark(p.group.position.clone(), '#ffd890', 16);
      p.life = 0;
    }
    if (p.life <= 0) {
      scene.remove(p.group);
      pickups.splice(i, 1);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Effects                                                            */
/* ------------------------------------------------------------------ */

function addEffect(obj, update, life) {
  scene.add(obj);
  effects.push({ obj, update, life, maxLife: life });
}

function spawnHitSpark(pos, color, count = 14) {
  const group = new THREE.Group();
  const geo = new THREE.TetrahedronGeometry(0.09);
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const particles = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, mat.clone());
    m.position.copy(pos);
    const a = Math.random() * Math.PI * 2;
    const el = Math.random() * Math.PI;
    const speed = 3 + Math.random() * 9;
    m.userData.vel = new THREE.Vector3(
      Math.cos(a) * Math.sin(el) * speed,
      Math.cos(el) * speed * 0.75 + 2,
      Math.sin(a) * Math.sin(el) * speed
    );
    m.userData.spin = new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12);
    m.scale.setScalar(0.5 + Math.random() * 1.3);
    group.add(m);
    particles.push(m);
  }
  addEffect(group, (dt, t) => {
    for (const m of particles) {
      m.userData.vel.y -= 14 * dt;
      m.position.addScaledVector(m.userData.vel, dt);
      m.rotation.x += m.userData.spin.x * dt;
      m.rotation.y += m.userData.spin.y * dt;
      m.position.y = Math.max(0.03, m.position.y);
      if (m.position.y <= 0.04) m.userData.vel.y *= -0.22;
      m.material.opacity = Math.max(0, 1 - t);
    }
  }, 0.8);
}

function spawnShockwave(pos, color, maxRadius, duration) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.5, 64),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pos.x, 0.06, pos.z);
  addEffect(ring, (dt, t) => {
    const p = 1 - Math.pow(1 - t, 2);
    const s = 0.5 + p * maxRadius;
    ring.scale.set(s, s, s);
    ring.material.opacity = Math.max(0, (1 - t) * 0.85);
  }, duration);
}

const slashCanvas = document.createElement('canvas');
slashCanvas.width = slashCanvas.height = 256;
{
  const ctx = slashCanvas.getContext('2d');
  ctx.translate(128, 128);
  const grad = ctx.createLinearGradient(-100, -100, 100, 100);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.35, 'rgba(255,255,255,1)');
  grad.addColorStop(0.72, 'rgba(255,255,255,.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 15;
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(0, 0, 78, -1.25, 1.05);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(0, 0, 91, -1.03, 0.82);
  ctx.stroke();
}
const slashTex = new THREE.CanvasTexture(slashCanvas);
slashTex.colorSpace = THREE.SRGBColorSpace;

function spawnSlash(pos, facing, color, size, heavy) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: slashTex, color, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sprite.position.set(pos.x, 1.35 + (heavy ? 0.15 : 0), pos.z);
  sprite.scale.set(size, size, 1);
  // Face perpendicular enough to read from the follow camera.
  sprite.material.rotation = -facing + (heavy ? 0.5 : -0.4);
  addEffect(sprite, (dt, t) => {
    sprite.material.opacity = Math.max(0, (1 - t) * 0.95);
    sprite.scale.multiplyScalar(1 + dt * 2.3);
    sprite.position.y += dt * 0.35;
  }, 0.3);
}

function spawnBlackFlashAura() {
  const center = player.pos.clone();
  const light = new THREE.PointLight('#ff1133', 22, 16, 2);
  light.position.set(center.x, 2.5, center.z);
  addEffect(light, (dt, t) => {
    light.intensity = 22 * (1 - t);
  }, 0.8);
  spawnLightning(center, 10);
  spawnShockwave(center, '#ff2d4d', 4.5, 0.8);
}

function spawnBlackFlashPillar(center) {
  const geo = new THREE.CylinderGeometry(0.4, 2.2, 26, 20, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: '#ff1738', transparent: true, opacity: 0.42,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pillar = new THREE.Mesh(geo, mat);
  pillar.position.set(center.x, 13, center.z);
  addEffect(pillar, (dt, t) => {
    mat.opacity = Math.max(0, 0.42 * (1 - t));
    pillar.scale.x = pillar.scale.z = 1 + t * 0.8;
  }, 0.7);
}

function spawnLightning(center, count = 14) {
  const group = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({
    color: '#ff2748', transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const pts = [];
    let x = center.x;
    let z = center.z;
    let y = 0.1 + Math.random() * 0.4;
    pts.push(new THREE.Vector3(x, y, z));
    for (let j = 0; j < 6; j++) {
      x += Math.cos(a + (Math.random() - 0.5) * 1.4) * (1.5 + Math.random() * 3);
      z += Math.sin(a + (Math.random() - 0.5) * 1.4) * (1.5 + Math.random() * 3);
      y += Math.random() * 2.4;
      pts.push(new THREE.Vector3(x, y, z));
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    group.add(new THREE.Line(g, mat.clone()));
  }
  addEffect(group, (dt, t) => {
    for (const l of group.children) l.material.opacity = Math.max(0, 1 - t * 1.25);
  }, 0.6);
}

function spawnAfterimage() {
  const ghost = player.group.clone(true);
  ghost.traverse((o) => {
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      o.material = mats.map((m) => {
        const c = m.clone();
        c.transparent = true;
        c.opacity = 0.15;
        c.color = new THREE.Color('#ff284c');
        c.depthWrite = false;
        return c;
      });
      if (o.material.length === 1) o.material = o.material[0];
    }
  });
  ghost.position.copy(player.group.position);
  ghost.rotation.copy(player.group.rotation);
  addEffect(ghost, (dt, t) => {
    ghost.position.y += dt * 0.15;
    ghost.traverse((o) => {
      if (!o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { m.opacity = 0.15 * (1 - t); });
    });
  }, 0.36);
}

function spawnSpawnPillar(pos, color) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.7, 32),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pos.x, 0.05, pos.z);
  addEffect(ring, (dt, t) => {
    const s = 1 + t * 3;
    ring.scale.set(s, s, s);
    ring.material.opacity = 0.8 * (1 - t);
  }, 0.6);

  const light = new THREE.PointLight(color, 8, 7, 2);
  light.position.set(pos.x, 1.2, pos.z);
  addEffect(light, (dt, t) => { light.intensity = 8 * (1 - t); }, 0.5);
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.life -= dt;
    const t = 1 - Math.max(0, e.life) / e.maxLife;
    e.update?.(dt, Math.min(1, t));
    if (e.life <= 0) {
      if (e.obj.parent) e.obj.parent.remove(e.obj);
      effects.splice(i, 1);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Floating numbers / feed / announcements                            */
/* ------------------------------------------------------------------ */

function spawnFloatingNumber(pos, value, crit = false, color = '') {
  const el = document.createElement('div');
  el.className = `float-number${crit ? ' crit' : ''}`;
  el.textContent = value;
  if (color) el.style.color = color;
  ui.floating.appendChild(el);
  floatTexts.push({
    el, life: crit ? 1.05 : 0.75, maxLife: crit ? 1.05 : 0.75,
    pos: new THREE.Vector3(pos.x + (Math.random() - 0.5) * 0.5, pos.y, pos.z + (Math.random() - 0.5) * 0.5),
  });
}

function updateFloatingTexts(dt) {
  for (let i = floatTexts.length - 1; i >= 0; i--) {
    const f = floatTexts[i];
    f.life -= dt;
    f.pos.y += dt * 1.3;
    const p = f.pos.clone().project(camera);
    if (p.z > 1 || p.z < -1) {
      f.el.style.opacity = '0';
    } else {
      const x = (p.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-p.y * 0.5 + 0.5) * window.innerHeight;
      const t = 1 - f.life / f.maxLife;
      f.el.style.left = `${x}px`;
      f.el.style.top = `${y}px`;
      f.el.style.opacity = `${Math.max(0, 1 - t * 1.2)}`;
      f.el.style.transform = `translate(-50%,-50%) scale(${1 + Math.max(0, 0.5 - t) * 0.7})`;
    }
    if (f.life <= 0) {
      f.el.remove();
      floatTexts.splice(i, 1);
    }
  }
}

function addKillFeed(type) {
  const el = document.createElement('div');
  el.className = 'kill-item';
  const names = { grunt: 'CURSED REMAINS', brute: 'CURSED BRUTE', boss: 'SPECIAL GRADE' };
  el.innerHTML = `EXORCISED <b>${names[type] || 'CURSE'}</b>`;
  ui.killFeed.prepend(el);
  setTimeout(() => el.remove(), 3200);
  while (ui.killFeed.children.length > 4) ui.killFeed.lastChild.remove();
}

let announceTimer = 0;
function announce(text) {
  ui.announcement.innerHTML = `<span>${text}</span>`;
  ui.announcement.classList.remove('show');
  void ui.announcement.offsetWidth;
  ui.announcement.classList.add('show');
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => ui.announcement.classList.remove('show'), 2600);
}

function flashScreen(kind, strength = 0.25) {
  ui.flash.className = kind;
  ui.flash.style.opacity = String(strength);
  requestAnimationFrame(() => {
    ui.flash.style.transition = 'opacity .32s ease-out';
    ui.flash.style.opacity = '0';
    setTimeout(() => { ui.flash.style.transition = ''; ui.flash.className = ''; }, 360);
  });
}

/* ------------------------------------------------------------------ */
/*  Waves / flow                                                       */
/* ------------------------------------------------------------------ */

function beginWave(index) {
  const wave = WAVES[index];
  if (!wave) return;
  game.wave = index;
  game.waveActive = true;
  game.spawnQueue = [];
  for (const [type, count] of wave.groups) {
    for (let i = 0; i < count; i++) game.spawnQueue.push(type);
  }
  // Bosses arrive first, then the rabble.
  if (wave.boss) game.spawnQueue.sort((a, b) => (a === 'boss' ? -1 : b === 'boss' ? 1 : 0));
  game.spawnTimer = 0.55;
  if (index === 0) {
    for (let i = 0; i < 3; i++) {
      const type = game.spawnQueue.shift();
      spawnEnemy(type, chooseSpawnPosition(13));
    }
    game.spawnTimer = 0.9;
  }
  ui.waveNum.textContent = String(index + 1).padStart(2, '0');
  ui.waveFill.style.width = `${((index + 1) / WAVES.length) * 100}%`;
  ui.objectiveTitle.textContent = wave.objective;
  ui.objectiveText.textContent = wave.desc;
  ui.wbKicker.textContent = wave.kicker;
  ui.wbTitle.textContent = wave.title;
  ui.wbSub.textContent = wave.sub;
  ui.waveBanner.classList.remove('show');
  void ui.waveBanner.offsetWidth;
  ui.waveBanner.classList.add('show');
  audio.waveStart();
  if (index > 0) {
    player.health = Math.min(player.maxHealth, player.health + 16);
    player.energy = Math.min(100, player.energy + 14);
    announce('CURSED ENERGY RESTORED // +16 VITALS');
  }
  game.shake = Math.max(game.shake, 0.6);
}

function completeWave() {
  game.waveActive = false;
  game.score += 1000 + game.wave * 500;
  if (WAVES[game.wave].boss) {
    endGame(true);
    return;
  }
  game.intermission = 3.4;
  player.health = Math.min(player.maxHealth, player.health + 10);
  player.energy = Math.min(100, player.energy + 18);
  announce(`WAVE ${game.wave + 1} CLEARED // +${1000 + game.wave * 500} SCORE`);
}

function updateWaves(dt) {
  if (!game.waveActive) {
    if (game.intermission > 0) {
      game.intermission -= dt;
      if (game.intermission <= 0) beginWave(game.wave + 1);
    }
    return;
  }

  if (game.spawnQueue.length > 0) {
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      const type = game.spawnQueue.shift();
      spawnEnemy(type, chooseSpawnPosition(type === 'boss' ? 14 : 10));
      game.spawnTimer = type === 'boss' ? 1.1 : 0.42 + Math.random() * 0.3;
    }
  } else if (enemies.every((e) => e.dead)) {
    completeWave();
  }
}

/* ------------------------------------------------------------------ */
/*  Player update                                                      */
/* ------------------------------------------------------------------ */

function updatePlayer(dt, rawDt) {
  if (player.dead) return;

  player.invuln = Math.max(0, player.invuln - rawDt);
  player.hurtTimer = Math.max(0, player.hurtTimer - rawDt);
  player.dashCooldown = Math.max(0, player.dashCooldown - rawDt);
  player.cooldown = Math.max(0, player.cooldown - rawDt);
  player.comboTimer = Math.max(0, player.comboTimer - rawDt);
  if (player.comboTimer <= 0) player.combo = 0;

  if (player.blackFlash) {
    const bf = player.blackFlash;
    bf.t += rawDt;
    if (bf.t >= 0.5 && !bf.hit) {
      bf.hit = true;
      doBlackFlashHit();
    }
    if (bf.t >= 1.35) {
      player.blackFlash = null;
    }
    player.dashTimer = 0;
    animateHero(player.rig, {
      time: game.elapsed + rawDt,
      moving: false,
      speed: 0,
      attack: false,
      dash: false,
      energy: 0,
      blackFlash: true,
    }, rawDt);
    return;
  }

  const mv = moveInput();
  const attacking = !!player.attack;
  const speedMultiplier = attacking ? 0.46 : 1;
  let moving = false;
  let strafe = 0;

  if (player.dashTimer > 0) {
    player.dashTimer -= rawDt;
    player.pos.addScaledVector(player.dashDir, 25 * rawDt);
    moving = true;
    strafe = 0;
    if (Math.random() < 0.55) spawnAfterimage();
  } else {
    if (mv.x || mv.y) {
      const dir = cameraForward().multiplyScalar(mv.y).add(cameraRight().multiplyScalar(mv.x));
      if (dir.lengthSq() > 0) {
        dir.normalize();
        player.pos.addScaledVector(dir, player.speed * speedMultiplier * dt);
        moving = true;
        strafe = mv.x;
        if (!attacking) {
          const target = Math.atan2(dir.x, dir.z);
          player.facing += shortestAngle(player.facing, target) * Math.min(1, dt * 14);
        }
      }
    }
  }

  // Arena boundary
  const radius = Math.hypot(player.pos.x, player.pos.z);
  if (radius > 31) {
    player.pos.x = (player.pos.x / radius) * 31;
    player.pos.z = (player.pos.z / radius) * 31;
  }

  // Attack progression
  if (player.attack) {
    const a = player.attack;
    a.t += dt;
    if (!a.didHit && a.t >= a.hitAt) {
      a.didHit = true;
      meleeHit(a.kind);
    }
    if (a.t >= a.duration) {
      player.attack = null;
      player.lastAttackTime = game.elapsed;
    }
  }

  player.moving = moving;
  player.strafe = strafe;
  player.group.position.x = player.pos.x;
  player.group.position.z = player.pos.z;
  player.group.rotation.y = player.facing;

  animateHero(player.rig, {
    time: game.elapsed,
    moving,
    speed: player.dashTimer > 0 ? 20 : player.speed,
    attack: !!player.attack,
    attackKind: player.attack?.kind,
    attackProgress: player.attack ? Math.min(1, player.attack.t / player.attack.duration) : 0,
    dash: player.dashTimer > 0,
    energy: player.energy,
    blackFlash: false,
  }, rawDt);
}

/* ------------------------------------------------------------------ */
/*  Camera                                                             */
/* ------------------------------------------------------------------ */

const cameraTarget = new THREE.Vector3();
const cameraDesired = new THREE.Vector3();

function updateCamera(dt) {
  if (game.mode === 'menu') {
    game.menuAngle += dt * 0.055;
    const a = 0.64 + Math.sin(game.menuAngle) * 0.055;
    const focusX = 2.3;
    const focusZ = -1.8;
    const radius = 12.8;
    camera.position.set(
      focusX + Math.sin(a) * radius,
      5.0 + Math.sin(game.menuAngle * 0.7) * 0.18,
      focusZ + Math.cos(a) * radius
    );
    camera.lookAt(focusX, 1.92, focusZ - 0.9);
    camera.fov = 49;
    camera.updateProjectionMatrix();
    return;
  }

  const target = cameraTarget.set(player.pos.x, 1.65, player.pos.z);
  let dist = cameraState.distance;
  let height = 3.1;
  if (player.blackFlash) {
    dist = THREE.MathUtils.lerp(dist, 5.3, 0.25);
    height = 2.5;
  }
  const cp = Math.cos(cameraState.pitch);
  cameraDesired.set(
    target.x + Math.sin(cameraState.yaw) * dist * cp,
    target.y + height + Math.sin(cameraState.pitch) * dist,
    target.z + Math.cos(cameraState.yaw) * dist * cp
  );
  const floor = 1.05;
  if (cameraDesired.y < floor) cameraDesired.y = floor;

  camera.position.lerp(cameraDesired, 1 - Math.exp(-dt * 8));
  const fwd = cameraForward();
  const lookTarget = new THREE.Vector3(
    player.pos.x + fwd.x * 2.4,
    player.pos.y + 1.55 + Math.sin(cameraState.pitch) * -1.1,
    player.pos.z + fwd.z * 2.4
  );
  camera.lookAt(lookTarget);
  camera.fov = player.blackFlash ? 52 : 57;
  camera.updateProjectionMatrix();

  if (game.shake > 0.001) {
    const s = game.shake;
    camera.position.x += (Math.random() - 0.5) * s * 0.55;
    camera.position.y += (Math.random() - 0.5) * s * 0.45;
    camera.position.z += (Math.random() - 0.5) * s * 0.55;
    game.shake *= Math.pow(0.003, dt);
  }
}

/* ------------------------------------------------------------------ */
/*  UI update                                                          */
/* ------------------------------------------------------------------ */

let lastHudUpdate = 0;

function updateUI(dt) {
  const hp = Math.max(0, player.health);
  ui.healthFill.style.width = `${(hp / player.maxHealth) * 100}%`;
  ui.healthText.textContent = Math.ceil(hp);
  ui.energyFill.style.width = `${player.energy}%`;
  ui.energyText.textContent = Math.floor(player.energy);
  ui.score.textContent = String(game.score).padStart(6, '0');
  ui.ultimate.classList.toggle('on', player.energy >= 100);
  ui.mobileUlt.classList.toggle('ready', player.energy >= 100);

  if (player.combo >= 2) {
    ui.combo.classList.add('on');
    ui.comboCount.textContent = player.combo;
    const rank = player.combo >= 20 ? 'S' : player.combo >= 12 ? 'A' : player.combo >= 6 ? 'B' : 'C';
    ui.comboRank.textContent = rank;
  } else {
    ui.combo.classList.remove('on');
  }

  game.damageFlash = Math.max(0, game.damageFlash - dt);
  ui.damage.style.opacity = String(Math.min(1, game.damageFlash * 1.6));
  ui.healthFill.style.filter = player.hurtTimer > 0 ? 'brightness(2.2)' : '';
  document.documentElement.style.setProperty('--hp-danger', hp < 30 ? '1' : '0');

  if (ui.bossPanel.classList.contains('hidden') === false) {
    const boss = enemies.find((e) => e.type === 'boss' && !e.dead);
    if (boss) {
      ui.bossHealth.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
    } else {
      ui.bossHealth.style.width = '0%';
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Main loop                                                          */
/* ------------------------------------------------------------------ */

const clock = new THREE.Clock();
let frameCount = 0;

function animate() {
  requestAnimationFrame(animate);
  const rawDt = Math.min(clock.getDelta(), lowQuality ? 0.14 : 0.075);
  const time = clock.elapsedTime;

  if (game.mode === 'playing') {
    game.elapsed += rawDt;
    if (game.hitStop > 0) game.hitStop -= rawDt;
    const slow = player.blackFlash ? 0.34 : 1;
    const dt = game.hitStop > 0 ? 0 : rawDt * slow;
    updatePlayer(dt, rawDt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updatePickups(dt);
    updateWaves(dt);
    updateEffects(dt);
    updateFloatingTexts(rawDt);
    updateUI(rawDt);
    updateCamera(rawDt);
    audio.update(rawDt);
  } else if (game.mode === 'menu') {
    world.update(rawDt, time);
    // idle menu enemies
    menuEnemies.forEach((g, i) => {
      g.position.y = 1.05 + Math.sin(time * 1.2 + i * 1.7) * 0.14;
      g.rotation.y += rawDt * 0.12;
    });
    if (player.group) {
      player.rig.aura.material.opacity = 0.22 + Math.sin(time * 1.8) * 0.06;
      player.rig.auraRing.rotation.z += rawDt * 0.2;
    }
    updateCamera(rawDt);
  } else if (game.mode === 'paused' || game.mode === 'result') {
    if (player.dead) {
      player.deathT += rawDt;
      const fall = Math.min(1, player.deathT / 0.55);
      player.group.rotation.x = fall * fall * 1.42;
      player.rig.aura.material.opacity = Math.max(0, 0.25 * (1 - fall));
    }
    updateEffects(rawDt * 0.4);
    world.update(rawDt, time);
    updateCamera(rawDt);
    audio.update(rawDt);
  } else {
    world.update(rawDt, time);
  }

  composer.render();
  frameCount++;
  if (frameCount === 2) ui.loader.classList.add('done');
}

/* ------------------------------------------------------------------ */
/*  Flow control                                                       */
/* ------------------------------------------------------------------ */

function resetWorldEntities() {
  for (const e of enemies) scene.remove(e.group);
  enemies.length = 0;
  for (const p of projectiles) scene.remove(p.group);
  projectiles.length = 0;
  for (const p of pickups) scene.remove(p.group);
  pickups.length = 0;
  for (const e of effects) if (e.obj.parent) e.obj.parent.remove(e.obj);
  effects.length = 0;
  for (const f of floatTexts) f.el.remove();
  floatTexts.length = 0;
  ui.killFeed.innerHTML = '';
  ui.bossPanel.classList.add('hidden');
  ui.bossHealth.style.width = '100%';
}

function clearMenuEnemies() {
  for (const g of menuEnemies) {
    g.removeFromParent();
  }
  menuEnemies.length = 0;
}

function startGame() {
  audio.init();
  audio.setMuted(false);
  ui.mute.textContent = 'SOUND ON';
  if (game.mode === 'menu') {
    clearMenuEnemies();
  }
  resetWorldEntities();
  game.mode = 'playing';
  game.wave = 0;
  game.waveActive = false;
  game.intermission = 0;
  game.spawnQueue = [];
  game.score = 0;
  game.kills = 0;
  game.maxCombo = 0;
  game.elapsed = 0;
  game.hitStop = 0;
  game.shake = 0;
  game.damageFlash = 0;
  game.tutorialTip = false;
  for (const k of Object.keys(keys)) keys[k] = false;

  player.health = 100;
  player.energy = 30;
  player.pos.set(0, 0, 9);
  player.facing = Math.PI;
  player.group.position.copy(player.pos);
  player.group.rotation.set(0, player.facing, 0);
  player.dead = false;
  player.deathT = 0;
  player.invuln = 0;
  player.attack = null;
  player.blackFlash = null;
  player.combo = 0;
  player.comboTimer = 0;
  player.dashCooldown = 0;
  player.dashTimer = 0;
  player.cooldown = 0;
  player.attackChain = 0;
  cameraState.yaw = 0;
  cameraState.pitch = 0.1;
  camera.position.set(0, 5.2, 17);

  ui.menu.classList.remove('is-visible');
  ui.how.classList.remove('is-visible');
  ui.pause.classList.remove('is-visible');
  ui.waveBanner.classList.remove('show');
  ui.result.classList.remove('is-visible');
  ui.hud.classList.remove('hidden');
  ui.hud.classList.remove('fade');
  ui.damage.style.opacity = '0';
  ui.bossPanel.classList.add('hidden');
  document.body.classList.add('playing');
  if (document.pointerLockElement !== canvas && window.matchMedia('(pointer: fine)').matches) {
    // Do not grab the pointer until the player clicks the arena; this keeps the start transition readable.
  }
  beginWave(0);
}

function pauseGame() {
  if (game.mode !== 'playing') return;
  game.mode = 'paused';
  ui.waveBanner.classList.remove('show');
  ui.pause.classList.add('is-visible');
  ui.hud.classList.add('fade');
  if (document.pointerLockElement === canvas) document.exitPointerLock?.();
}

function resumeGame() {
  if (game.mode !== 'paused') return;
  game.mode = 'playing';
  ui.pause.classList.remove('is-visible');
  ui.hud.classList.remove('fade');
  audio.init();
}

function returnToMenu() {
  game.mode = 'menu';
  document.exitPointerLock?.();
  resetWorldEntities();
  clearMenuEnemies();
  buildMenuEnemies();
  game.waveActive = false;
  game.intermission = 0;
  game.spawnQueue = [];
  for (const k of Object.keys(keys)) keys[k] = false;
  player.group.position.set(4.9, 0, 0.3);
  player.group.rotation.set(0, 0.72, 0);
  player.pos.set(4.9, 0, 0.3);
  player.facing = 0.72;
  player.health = 100;
  player.energy = 0;
  player.blackFlash = null;
  player.dead = false;
  player.deathT = 0;
  player.rig.aura.material.opacity = 0.3;
  ui.hud.classList.add('hidden');
  ui.pause.classList.remove('is-visible');
  ui.result.classList.remove('is-visible');
  ui.how.classList.remove('is-visible');
  ui.menu.classList.add('is-visible');
  document.body.classList.remove('playing');
}

function endGame(victory) {
  if (game.mode !== 'playing') return;
  game.mode = 'result';
  player.dead = !victory;
  player.deathT = 0;
  if (document.pointerLockElement === canvas) document.exitPointerLock?.();
  if (victory) audio.victory(); else audio.gameOver();
  ui.hud.classList.add('fade');
  clearTimeout(game.resultTimer);
  game.resultTimer = setTimeout(() => showResult(victory), victory ? 1550 : 1050);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function computeRank(victory) {
  if (!victory) return 'D';
  const t = game.elapsed;
  const score = game.score;
  const hp = player.health;
  if (score >= 33000 && t < 240 && hp > 45) return 'S';
  if (score >= 25000 && t < 320) return 'A';
  if (score >= 16000) return 'B';
  return 'C';
}

function showResult(victory) {
  if (game.mode !== 'result') return;
  ui.waveBanner.classList.remove('show');
  const rank = computeRank(victory);
  $('#result-kicker').textContent = victory ? 'MISSION COMPLETE' : 'MISSION FAILED';
  $('#result-title').textContent = victory ? 'VEIL LIFTED' : 'CURSED END';
  $('#result-copy').textContent = victory
    ? 'The patchwork curse has been exorcised. Shibuya breathes again.'
    : 'The veil consumed you. The curses remain.';
  $('#grade').textContent = rank;
  $('#r-score').textContent = String(game.score).padStart(6, '0');
  $('#r-time').textContent = formatTime(game.elapsed);
  $('#r-kills').textContent = game.kills;
  $('#r-combo').textContent = game.maxCombo;
  const lines = {
    S: '“Throughout heaven and earth, I alone am the honored one.”',
    A: '“A curse is only as strong as the fear that feeds it.”',
    B: '“You exorcised the dark. The dark remembers.”',
    C: '“Survival is its own kind of victory.”',
    D: '“The veil does not forgive hesitation.”',
  };
  $('#r-line').textContent = lines[rank];
  ui.result.classList.add('is-visible');
  ui.hud.classList.add('hidden');
}

/* ------------------------------------------------------------------ */
/*  UI wiring                                                          */
/* ------------------------------------------------------------------ */

$('#start-btn').addEventListener('click', () => { audio.init(); startGame(); });
$('#retry-btn').addEventListener('click', () => { ui.result.classList.remove('is-visible'); startGame(); });
$('#menu-btn').addEventListener('click', returnToMenu);
$('#pause-btn').addEventListener('click', pauseGame);
$('#resume-btn').addEventListener('click', resumeGame);
$('#quit-btn').addEventListener('click', returnToMenu);
$('#mute-btn').addEventListener('click', () => {
  audio.init();
  const muted = audio.toggleMuted();
  ui.mute.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
});
$('#how-btn').addEventListener('click', () => {
  ui.how.classList.add('is-visible');
});
function closeHow() {
  ui.how.classList.remove('is-visible');
}
$('#how-close').addEventListener('click', closeHow);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.how.classList.contains('is-visible')) closeHow();
});

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(lowQuality ? Math.min(window.devicePixelRatio, 1) * 0.72 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
});

// Ensure click/tap feels responsive and unlocks audio.
window.addEventListener('pointerdown', () => audio.init(), { once: true });

// Expose a tiny debug API for the automated verification harness.
window.__JJK = {
  get state() {
    return {
      mode: game.mode, wave: game.wave + 1, score: game.score, kills: game.kills,
      health: player.health, energy: player.energy, enemies: enemies.length,
      blackFlash: !!player.blackFlash, fps: renderer.info.render.frame,
      queue: game.spawnQueue.length, spawnTimer: game.spawnTimer, elapsed: game.elapsed, waveActive: game.waveActive,
    };
  },
  start: startGame,
  damage: (n) => damagePlayer(n),
  addEnergy: () => { player.energy = 100; },
  spawn: (type) => spawnEnemy(type, chooseSpawnPosition(8)),
  spawnAt: (type, x, z) => spawnEnemy(type, new THREE.Vector3(x, 0, z)),
  enemies: () => enemies.map((e) => ({ type: e.type, x: e.pos.x, z: e.pos.z, hp: e.hp, state: e.state, dead: e.dead })),
  teleport: (x, z) => { player.pos.set(x, 0, z); player.group.position.x = x; player.group.position.z = z; },
  hit: (type = 'grunt') => { const e = enemies.find((x) => x.type === type && !x.dead); if (e) damageEnemy(e, 9999, true, player.pos, 0); },
  setHealth: (h) => { player.health = h; },
  jumpWave: (n) => {
    resetWorldEntities();
    game.wave = Math.max(-1, n - 2);
    game.waveActive = false;
    game.intermission = 0.1;
    game.spawnQueue = [];
  },
  end: (victory) => endGame(victory),
  blackFlash: triggerBlackFlash,
  get gpu() { return gpuName; },
  get lowQuality() { return lowQuality; },
  renderer,
  scene,
  camera,
  player,
  game,
};

animate();
