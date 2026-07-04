// ================================================================
// けだまる散歩日記 v2
// Canvas 2D API 使用。フレームワーク不使用。
// ================================================================

const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');

const DPR    = window.devicePixelRatio || 1;
const GAME_W = 390;
const GAME_H = 700;
canvas.width  = GAME_W * DPR;
canvas.height = GAME_H * DPR;
ctx.scale(DPR, DPR);

// ================================================================
// 定数
// ================================================================

const GROUND_Y       = 620;
const KDM_R          = 28;
const KDM_MIN_X      = 50;
const KDM_MAX_X      = 290;
const KDM_START_X    = 110;
const GRAVITY        = 0.52;
const JUMP_FORCE     = -13;
const MOVE_SPEED     = 4.5;
const OBJ_SPAWN_X    = GAME_W + 50;
const OBJ_MIN_Y      = 90;
const OBJ_MAX_Y      = GROUND_Y;
const OBJ_SPEED_BASE = 4.5;
const DIST_PER_FRAME = 0.14;  // 0.07→0.14で約60秒で500m到達
const GOAL_DISTANCE  = 500;   // ゴール距離（m）
const OBS_MIN_Y      = 80;    // 障害物の最小Y（HUDより下から）
// プレイヤーの天井：HUD下端(78) + 体の半径。ここより上には行けない
const CEILING_Y      = 78 + KDM_R;

const HIGH_SCORE_KEY = 'kedamaru_highscore';

// タッチデバイス判定（スマホ・タブレットのみ true）
const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches;

// スマホ用の左右ボタン領域（Canvas 座標）
const MB_LEFT_X1  = 15,  MB_LEFT_X2  = 105; // 左ボタンの X 範囲
const MB_RIGHT_X1 = 285, MB_RIGHT_X2 = 375; // 右ボタンの X 範囲
const MB_Y1 = GAME_H - 95, MB_Y2 = GAME_H - 20; // 共通 Y 範囲

// レベル定義
// maxObstacles・スポーン頻度を調整してジャンプ無敵を防止
const LEVELS = [
  {
    label: 'Lv.1', minDist: 0,   color: '#5cba4a',
    speedBonus: 0.0, maxItems: 3, maxObstacles: 3,
    spawnItemMin: 80,  spawnItemMax: 120,
    spawnObsMin:  65,  spawnObsMax:  100,
  },
  {
    label: 'Lv.2', minDist: 150, color: '#f0a030',
    speedBonus: 1.2, maxItems: 3, maxObstacles: 4,
    spawnItemMin: 65,  spawnItemMax: 100,
    spawnObsMin:  55,  spawnObsMax:   85,
  },
  {
    label: 'Lv.3', minDist: 350, color: '#e03030',
    speedBonus: 2.8, maxItems: 4, maxObstacles: 5,
    spawnItemMin: 50,  spawnItemMax:  80,
    spawnObsMin:  45,  spawnObsMax:   70,
  },
];

// ================================================================
// アイテム・障害物の種類定義
// ================================================================

const ITEM_TYPES = [
  { label: 'おにぎり', emoji: '🍙', furDelta:  0, energyDelta: +10, scoreDelta: +10 },
  { label: '水',       emoji: '💧', furDelta:  0, energyDelta: +10, scoreDelta: +10 },
  { label: 'どんぐり', emoji: '🌰', furDelta:  0, energyDelta:  +5, scoreDelta: +10 },
  { label: 'ふわ毛',   emoji: '🪶', furDelta: +15, energyDelta:  +5, scoreDelta: +20 },
  { label: '小さい星', emoji: '⭐', furDelta:  0, energyDelta:  +5, scoreDelta: +10 },
];

const OBSTACLE_TYPES = [
  { label: 'ストレス',   emoji: '😤', furDelta: -10, energyDelta: -5 },
  { label: '寝不足',     emoji: '😴', furDelta: -10, energyDelta: -5 },
  { label: '強風',       emoji: '💨', furDelta: -10, energyDelta: -5 },
  { label: '雨',         emoji: '🌧',  furDelta: -10, energyDelta: -5 },
  { label: '考えすぎ',   emoji: '🌀', furDelta: -10, energyDelta: -5 },
  { label: '締切',       emoji: '📅', furDelta: -10, energyDelta: -5 },
  { label: '月曜の気配', emoji: '😱', furDelta: -10, energyDelta: -5 },
];

// ================================================================
// ゲーム状態変数
// ================================================================

let gamePhase;   // 'title' | 'playing' | 'gameover' | 'cleared'
let kdm;
let items;
let obstacles;
let particles;
let score;
let distance;
let frameCount;
let bgOffset;
let keys;
let lastTime;
let animId;
let currentLevel;
let levelUpFlash;
let shakeFrames;
let shakeAmount;
let nextItemFrame;
let nextObsFrame;
let highScore;
let combo;
let comboText;
// 指ごとにどのボタンを押しているか記録する（multi-touch 対応）
const touchPointers = new Map(); // pointerId → 'left' | 'right' | 'jump'

// ================================================================
// initGame
// ================================================================

function initGame() {
  kdm = {
    x: KDM_START_X,
    y: GROUND_Y,
    vx: 0, vy: 0,
    isOnGround: true,
    furAmount: 100,
    energy: 100,
    bounceOffset: 0,
    bounceTimer: 0,
    blinkTimer: 80,
    isBlinking: false,
    damageFlash: 0,
  };

  items        = [];
  obstacles    = [];
  particles    = [];
  score        = 0;
  distance     = 0;
  frameCount   = 0;
  bgOffset     = 0;
  keys         = { left: false, right: false };
  gamePhase    = 'playing';
  lastTime     = null;

  currentLevel = 0;
  levelUpFlash = 0;
  shakeFrames  = 0;
  shakeAmount  = 0;
  combo        = 0;
  comboText    = null;

  nextItemFrame = 60  + Math.floor(Math.random() * 40);
  nextObsFrame  = 90  + Math.floor(Math.random() * 60);
}

// ================================================================
// gameLoop
// ================================================================

function gameLoop(timestamp) {
  const dt = lastTime ? Math.min((timestamp - lastTime) / 16.67, 3) : 1;
  lastTime  = timestamp;
  update(dt);
  draw();
  animId = requestAnimationFrame(gameLoop);
}

// ================================================================
// update
// ================================================================

function update(dt) {
  bgOffset = (bgOffset + 1.5 * dt) % GAME_W;

  if (gamePhase !== 'playing') return;

  frameCount++;
  distance += DIST_PER_FRAME * dt;

  // 500m でゴール
  if (distance >= GOAL_DISTANCE) {
    endCleared();
    return;
  }

  updateLevel();

  const lv    = LEVELS[currentLevel];
  const speed = OBJ_SPEED_BASE + lv.speedBonus + Math.floor(distance / 100) * 0.5;

  updateKedamaru(dt);
  updateItems(speed, dt);
  updateObstacles(speed, dt);
  updateParticles(dt);
  spawnObjects();
  checkCollision();
  updateAnimations(dt);

  if (levelUpFlash > 0) levelUpFlash -= dt;
  if (shakeFrames  > 0) shakeFrames  -= dt;

  if (comboText) {
    comboText.alpha -= 0.015 * dt;
    comboText.y     -= 0.5   * dt;
    if (comboText.alpha <= 0) comboText = null;
  }
}

// ================================================================
// updateLevel
// ================================================================

function updateLevel() {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (distance >= LEVELS[i].minDist && i > currentLevel) {
      currentLevel = i;
      levelUpFlash = 120;
      break;
    }
  }
}

// ================================================================
// updateKedamaru
// ================================================================

function updateKedamaru(dt) {
  if (keys.left)       kdm.vx = -MOVE_SPEED;
  else if (keys.right) kdm.vx =  MOVE_SPEED;
  else                 kdm.vx =  0;

  kdm.vy += GRAVITY * dt;
  kdm.x  += kdm.vx * dt;
  kdm.y  += kdm.vy * dt;

  if (kdm.y >= GROUND_Y) {
    kdm.y          = GROUND_Y;
    kdm.vy         = 0;
    kdm.isOnGround = true;
  } else {
    kdm.isOnGround = false;
  }

  // HUDの下端を天井にする（これより上にはジャンプできない）
  if (kdm.y < CEILING_Y) {
    kdm.y  = CEILING_Y;
    kdm.vy = 0;
  }

  kdm.x = Math.max(KDM_MIN_X, Math.min(KDM_MAX_X, kdm.x));
}

function updateAnimations(dt) {
  kdm.bounceTimer  += 0.12 * dt;
  kdm.bounceOffset  = kdm.isOnGround ? Math.sin(kdm.bounceTimer) * 2.5 : 0;

  kdm.blinkTimer -= dt;
  if (kdm.blinkTimer <= 0) {
    kdm.isBlinking = !kdm.isBlinking;
    kdm.blinkTimer = kdm.isBlinking ? 5 : (60 + Math.random() * 120);
  }

  if (kdm.damageFlash > 0) kdm.damageFlash -= dt;
}

// ================================================================
// スポーン（ランダムタイマー方式）
// ================================================================

// 障害物のY座標：4ゾーン均等配置でどの高さにいても当たるようにする
// ゾーン1（上）: y=80-180  → 3段ジャンプ中のプレイヤーを狙う
// ゾーン2（中上）: y=220-380 → ジャンプ中〜中空を狙う
// ゾーン3（中下）: y=400-520 → 低めのジャンプや着地直前を狙う
// ゾーン4（地面）: y=540-620 → 地面張り付きを狙う
function randomObstacleY() {
  const r = Math.random();
  if (r < 0.25) return OBS_MIN_Y + Math.random() * 100; // ゾーン1: 80〜180
  if (r < 0.50) return 220 + Math.random() * 160;       // ゾーン2: 220〜380
  if (r < 0.75) return 400 + Math.random() * 120;       // ゾーン3: 400〜520
  return 540 + Math.random() * 80;                       // ゾーン4: 540〜620
}

function spawnObjects() {
  const lv = LEVELS[currentLevel];

  if (items.length < lv.maxItems && frameCount >= nextItemFrame) {
    const type = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
    items.push({
      x: OBJ_SPAWN_X,
      y: OBJ_MIN_Y + Math.random() * (OBJ_MAX_Y - OBJ_MIN_Y),
      type, size: 28, collected: false,
    });
    nextItemFrame = frameCount + lv.spawnItemMin
      + Math.floor(Math.random() * (lv.spawnItemMax - lv.spawnItemMin));
  }

  if (obstacles.length < lv.maxObstacles && frameCount >= nextObsFrame) {
    const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    obstacles.push({
      x: OBJ_SPAWN_X,
      y: randomObstacleY(),
      type, size: 28, hit: false,
    });
    nextObsFrame = frameCount + lv.spawnObsMin
      + Math.floor(Math.random() * (lv.spawnObsMax - lv.spawnObsMin));
  }
}

// ================================================================
// updateItems / updateObstacles / updateParticles
// ================================================================

function updateItems(speed, dt) {
  for (const item of items) item.x -= speed * dt;
  items = items.filter(item => item.x > -80 && !item.collected);
}

function updateObstacles(speed, dt) {
  for (const obs of obstacles) obs.x -= speed * dt;
  obstacles = obstacles.filter(obs => obs.x > -80 && !obs.hit);
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x     += p.vx * dt;
    p.y     += p.vy * dt;
    p.vy    += 0.15 * dt;
    p.alpha -= p.fadeRate * dt;
    p.r     -= 0.1 * dt;
  }
  particles = particles.filter(p => p.alpha > 0 && p.r > 0);
}

// ================================================================
// checkCollision
// ================================================================

function checkCollision() {
  const kx = kdm.x;
  const ky = kdm.y + kdm.bounceOffset;
  const kr = KDM_R - 5;

  for (const item of items) {
    if (item.collected) continue;
    if (isCircleColliding(kx, ky, kr, item.x, item.y, item.size / 2)) {
      item.collected = true;
      score         += item.type.scoreDelta;
      kdm.furAmount  = Math.min(100, kdm.furAmount + item.type.furDelta);
      kdm.energy     = Math.min(100, kdm.energy    + item.type.energyDelta);

      combo++;
      if (combo >= 3) {
        const bonus = combo * 5;
        score += bonus;
        comboText = { value: combo, bonus, alpha: 1.2, y: ky - 50 };
      }

      spawnParticles(item.x, item.y, '#ffdd44', 8);
    }
  }

  for (const obs of obstacles) {
    if (obs.hit) continue;
    if (isCircleColliding(kx, ky, kr, obs.x, obs.y, obs.size / 2)) {
      obs.hit        = true;
      kdm.furAmount  = Math.max(0, kdm.furAmount + obs.type.furDelta);
      kdm.energy     = Math.max(0, kdm.energy    + obs.type.energyDelta);
      kdm.damageFlash = 20;
      combo           = 0;
      shakeFrames     = 18;
      shakeAmount     = 6;
      spawnParticles(obs.x, obs.y, '#ff4444', 6);
    }
  }

  if (kdm.furAmount <= 0) endGame();
}

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.4;
    const spd   = 1.5 + Math.random() * 2.5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 1,
      r: 4 + Math.random() * 3,
      alpha: 1,
      fadeRate: 0.035 + Math.random() * 0.02,
      color,
    });
  }
}

function isCircleColliding(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy) < ar + br;
}

// ================================================================
// endGame / endCleared / restartGame
// ================================================================

function endGame() {
  gamePhase = 'gameover';
  saveHighScore();
}

function endCleared() {
  gamePhase = 'cleared';
  saveHighScore();
}

function saveHighScore() {
  if (score > highScore) {
    highScore = score;
    try { localStorage.setItem(HIGH_SCORE_KEY, highScore); } catch (_) {}
  }
}

function restartGame() {
  initGame();
}

// ================================================================
// draw
// ================================================================

function draw() {
  ctx.clearRect(0, 0, GAME_W, GAME_H);

  if (gamePhase === 'title') {
    drawTitle();
    return;
  }

  // ゲームプレイ中のみシェイクを適用（結果画面は揺らさない）
  const doShake = shakeFrames > 0 && gamePhase === 'playing';
  const sx = doShake ? (Math.random() - 0.5) * shakeAmount : 0;
  const sy = doShake ? (Math.random() - 0.5) * shakeAmount : 0;
  ctx.save();
  ctx.translate(sx, sy);

  drawBackground();
  drawItems();
  drawObstacles();
  drawParticles();
  drawKedamaru();
  drawHUD();

  if (levelUpFlash > 0) drawLevelUp();
  if (comboText)        drawComboText();

  ctx.restore();

  // 結果画面はシェイクの外で描く（揺れない）
  if (gamePhase === 'gameover') drawGameOver();
  if (gamePhase === 'cleared')  drawCleared();
}

// ================================================================
// drawBackground
// ================================================================

function drawBackground() {
  const skyColors = [
    ['#74b8e0', '#ddf0ff'],  // Lv.1: 昼の青空
    ['#e07830', '#ffcc88'],  // Lv.2: 夕焼け
    ['#1a0f3e', '#4a2a7e'],  // Lv.3: 夜空
  ];
  const [skyTop, skyBot] = skyColors[currentLevel];

  const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  skyGrad.addColorStop(0, skyTop);
  skyGrad.addColorStop(1, skyBot);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  drawClouds();

  const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, GAME_H);
  groundGrad.addColorStop(0,    '#7ec850');
  groundGrad.addColorStop(0.12, '#5fa832');
  groundGrad.addColorStop(0.12, '#9c7a3a');
  groundGrad.addColorStop(1,    '#6b4f1e');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, GROUND_Y, GAME_W, GAME_H - GROUND_Y);

  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth   = 2;
  const stripeW   = 55;
  const stripeOff = bgOffset % stripeW;
  for (let x = -stripeW + stripeOff; x < GAME_W + stripeW; x += stripeW) {
    ctx.beginPath();
    ctx.moveTo(x,      GROUND_Y + 2);
    ctx.lineTo(x - 18, GAME_H);
    ctx.stroke();
  }
}

function drawClouds() {
  const cloudDefs = [
    { baseX: 60,  y: 85,  scale: 1.0,  speed: 0.25 },
    { baseX: 220, y: 55,  scale: 0.75, speed: 0.18 },
    { baseX: 330, y: 115, scale: 1.2,  speed: 0.30 },
  ];

  if (currentLevel === 2) {
    ctx.font         = '20px serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    for (const c of cloudDefs) {
      const cx = ((c.baseX - bgOffset * c.speed) % (GAME_W + 150) + GAME_W + 150) % (GAME_W + 150) - 75;
      ctx.globalAlpha = 0.85;
      ctx.fillText('✨', cx, c.y);
    }
    ctx.globalAlpha = 1;
    return;
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  for (const c of cloudDefs) {
    const cx = ((c.baseX - bgOffset * c.speed) % (GAME_W + 150) + GAME_W + 150) % (GAME_W + 150) - 75;
    const s  = c.scale;
    ctx.beginPath();
    ctx.arc(cx,           c.y,          28 * s, 0, Math.PI * 2);
    ctx.arc(cx + 30 * s,  c.y - 8 * s, 22 * s, 0, Math.PI * 2);
    ctx.arc(cx - 26 * s,  c.y + 5 * s, 18 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ================================================================
// drawKedamaru
// ================================================================

function drawKedamaru() {
  const cx = kdm.x;
  const cy = kdm.y + kdm.bounceOffset;
  const R  = KDM_R;

  drawFur(cx, cy, R, kdm.furAmount);

  const bodyGrad = ctx.createRadialGradient(
    cx - R * 0.3, cy - R * 0.35, R * 0.05,
    cx,           cy,             R
  );
  if (kdm.furAmount < 10) {
    bodyGrad.addColorStop(0, '#f0d0b5');
    bodyGrad.addColorStop(1, '#c08050');
  } else {
    bodyGrad.addColorStop(0, '#d8d8d8');
    bodyGrad.addColorStop(1, '#888888');
  }
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  if (kdm.damageFlash > 0) {
    const alpha = Math.min(0.55, kdm.damageFlash / 20);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 70, 70, ${alpha})`;
    ctx.fill();
  }

  drawEyes(cx, cy, R, kdm.isBlinking);
}

// ================================================================
// drawFur
// ================================================================

function drawFur(cx, cy, R, furAmount) {
  ctx.lineCap = 'round';
  let angles, furLen, furWidth;

  if (furAmount >= 80) {
    angles   = makeAngles(90); furLen = 13; furWidth = 3.0;
  } else if (furAmount >= 50) {
    angles   = makeAngles(26); furLen = 12; furWidth = 2.5;
  } else if (furAmount >= 30) {
    angles   = makeAngles(22).filter(a => !isNearAngle(a, -Math.PI / 2, 0.55));
    furLen = 12; furWidth = 2.5;
  } else if (furAmount >= 10) {
    angles   = makeAngles(20).filter(a => !isNearAngle(a, -Math.PI / 2, 1.15));
    furLen = 11; furWidth = 2.0;
  } else {
    angles   = [-Math.PI / 2 - 0.35, -Math.PI / 2 + 0.35, Math.PI / 2];
    furLen = 10; furWidth = 2.0;
  }

  ctx.strokeStyle = '#b0b0b0';
  ctx.lineWidth   = furWidth;

  for (const angle of angles) {
    const x1 = cx + Math.cos(angle) * (R + 1);
    const y1 = cy + Math.sin(angle) * (R + 1);
    const x2 = cx + Math.cos(angle) * (R + furLen);
    const y2 = cy + Math.sin(angle) * (R + furLen);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

function makeAngles(count) {
  const r = [];
  for (let i = 0; i < count; i++) r.push((Math.PI * 2 / count) * i);
  return r;
}

function isNearAngle(a, center, range) {
  let diff = ((a - center) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return diff < range;
}

// ================================================================
// drawEyes
// ================================================================

function drawEyes(cx, cy, R, isBlinking) {
  const ox = 9, oy = -6, eyeR = 5;

  if (isBlinking) {
    ctx.strokeStyle = '#333';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * (ox - 3.5), cy + oy);
      ctx.lineTo(cx + side * (ox + 3.5), cy + oy);
      ctx.stroke();
    }
  } else {
    for (const side of [-1, 1]) {
      const ex = cx + side * ox;
      const ey = cy + oy;
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
      ctx.fillStyle = '#222';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex - 1.5, ey - 1.5, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
    }
  }
}

// ================================================================
// drawItems / drawObstacles / drawParticles
// ================================================================

function drawItems() {
  for (const item of items) {
    ctx.beginPath();
    ctx.arc(item.x, item.y, item.size / 2 + 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(80, 210, 80, 0.55)';
    ctx.lineWidth   = 2.5;
    ctx.stroke();
    drawEmoji(item.type.emoji, item.x, item.y, item.size);
    ctx.fillStyle    = 'rgba(30, 140, 30, 0.9)';
    ctx.font         = '10px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(item.type.label, item.x, item.y + item.size / 2 + 4);
  }
}

function drawObstacles() {
  for (const obs of obstacles) {
    ctx.beginPath();
    ctx.arc(obs.x, obs.y, obs.size / 2 + 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(220, 60, 60, 0.55)';
    ctx.lineWidth   = 2.5;
    ctx.stroke();
    drawEmoji(obs.type.emoji, obs.x, obs.y, obs.size);
    ctx.fillStyle    = 'rgba(180, 30, 30, 0.9)';
    ctx.font         = '10px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(obs.type.label, obs.x, obs.y + obs.size / 2 + 4);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0, p.r), 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawEmoji(emoji, x, y, size) {
  ctx.font         = `${size}px serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, x, y);
}

// ================================================================
// drawHUD
// ================================================================

function drawHUD() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.beginPath();
  ctx.roundRect(10, 10, GAME_W - 20, 68, 12);
  ctx.fill();

  ctx.fillStyle    = 'white';
  ctx.font         = 'bold 14px sans-serif';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`スコア: ${score}`, 20, 17);

  const lv = LEVELS[currentLevel];
  ctx.fillStyle = lv.color;
  ctx.font      = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(lv.label, GAME_W / 2, 17);

  ctx.fillStyle = 'white';
  ctx.font      = 'bold 14px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.floor(distance)}m`, GAME_W - 56, 17);

  drawStatusBar(20,              41, 165, 15, kdm.furAmount / 100, '#c0c0c0', '🐾毛量');
  drawStatusBar(GAME_W / 2 + 5, 41, 165, 15, kdm.energy    / 100, '#ffcc44', '⚡元気');

  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.roundRect(GAME_W - 48, 13, 34, 26, 7);
  ctx.fill();
  ctx.font         = '14px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏠', GAME_W - 31, 26);

  // スマホのみ：左右移動ボタン（PC のキーボード操作には影響しない）
  if (IS_TOUCH && gamePhase === 'playing') {
    drawMobileButtons();
  }
}

/**
 * スマホ用の左右移動ボタンを画面下部に描く。
 * 押されている状態のときは少し明るく光らせる。
 */
function drawMobileButtons() {
  const btnW  = MB_LEFT_X2  - MB_LEFT_X1;   // 90px
  const btnH  = MB_Y2 - MB_Y1;              // 75px
  const btnRx = 14;

  // 左ボタン
  const leftPressed = keys.left;
  ctx.fillStyle = leftPressed
    ? 'rgba(255,255,255,0.38)'
    : 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.roundRect(MB_LEFT_X1, MB_Y1, btnW, btnH, btnRx);
  ctx.fill();
  ctx.fillStyle    = leftPressed ? 'white' : 'rgba(255,255,255,0.75)';
  ctx.font         = 'bold 28px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('◀', MB_LEFT_X1 + btnW / 2, MB_Y1 + btnH / 2);

  // 右ボタン
  const rightPressed = keys.right;
  ctx.fillStyle = rightPressed
    ? 'rgba(255,255,255,0.38)'
    : 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.roundRect(MB_RIGHT_X1, MB_Y1, btnW, btnH, btnRx);
  ctx.fill();
  ctx.fillStyle    = rightPressed ? 'white' : 'rgba(255,255,255,0.75)';
  ctx.fillText('▶', MB_RIGHT_X1 + btnW / 2, MB_Y1 + btnH / 2);
}

function drawStatusBar(x, y, w, h, ratio, fillColor, label) {
  ctx.fillStyle    = 'rgba(255,255,255,0.85)';
  ctx.font         = '10px sans-serif';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + h / 2);

  const barX = x + 46;
  const barW = w - 46;

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.roundRect(barX, y, barW, h, h / 2);
  ctx.fill();

  if (ratio > 0) {
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.roundRect(barX, y, barW * ratio, h, h / 2);
    ctx.fill();
  }
}

// ================================================================
// drawLevelUp
// ================================================================

function drawLevelUp() {
  const lv    = LEVELS[currentLevel];
  const alpha = Math.min(1, levelUpFlash / 30);
  const pop   = levelUpFlash > 90 ? 1 + (levelUpFlash - 90) / 90 * 0.25 : 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(GAME_W / 2, GAME_H / 2 - 60);
  ctx.scale(pop, pop);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
  ctx.beginPath();
  ctx.roundRect(-120, -36, 240, 72, 16);
  ctx.fill();
  ctx.strokeStyle = lv.color;
  ctx.lineWidth   = 3;
  ctx.stroke();

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = lv.color;
  ctx.font         = 'bold 22px sans-serif';
  ctx.fillText(`⬆ ${lv.label} に突入！`, 0, -9);

  const msgs = ['', 'ちょっとスピードアップ！', '激ムズモード突入！！'];
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font      = '13px sans-serif';
  ctx.fillText(msgs[currentLevel] || '', 0, 18);

  ctx.restore();
}

// ================================================================
// drawComboText
// ================================================================

function drawComboText() {
  if (!comboText) return;
  ctx.save();
  ctx.globalAlpha  = Math.min(1, comboText.alpha);
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = 'bold 18px sans-serif';
  ctx.strokeStyle  = 'rgba(0,0,0,0.7)';
  ctx.lineWidth    = 3;
  ctx.fillStyle    = '#ffdd00';
  const text = `${comboText.value}連続！ +${comboText.bonus}`;
  ctx.strokeText(text, kdm.x, comboText.y);
  ctx.fillText(text,   kdm.x, comboText.y);
  ctx.restore();
}

// ================================================================
// drawTitle
// ================================================================

function drawTitle() {
  drawBackground();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.beginPath();
  ctx.roundRect(30, 115, GAME_W - 60, 500, 20);
  ctx.fill();

  ctx.fillStyle    = '#444';
  ctx.font         = 'bold 24px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🐾 けだまる散歩日記', GAME_W / 2, 165);

  if (highScore > 0) {
    ctx.fillStyle = '#d07010';
    ctx.font      = '14px sans-serif';
    ctx.fillText(`🏆 ベスト: ${highScore}点`, GAME_W / 2, 195);
  }

  const px = GAME_W / 2;
  const py = 285;
  drawFur(px, py, KDM_R, 100);
  const previewGrad = ctx.createRadialGradient(
    px - KDM_R * 0.3, py - KDM_R * 0.35, KDM_R * 0.05,
    px, py, KDM_R
  );
  previewGrad.addColorStop(0, '#d8d8d8');
  previewGrad.addColorStop(1, '#888888');
  ctx.beginPath();
  ctx.arc(px, py, KDM_R, 0, Math.PI * 2);
  ctx.fillStyle = previewGrad;
  ctx.fill();
  drawEyes(px, py, KDM_R, false);

  ctx.fillStyle = '#555';
  ctx.font      = '14px sans-serif';
  ctx.fillText('← → / A・D キーで左右移動', GAME_W / 2, 362);
  ctx.fillText('スペース / タップ でジャンプ（何度でも）', GAME_W / 2, 386);

  ctx.font      = '13px sans-serif';
  ctx.fillStyle = '#777';
  ctx.fillText('アイテムを集めて毛量を守ろう！', GAME_W / 2, 415);
  ctx.fillText('毛量が 0 になるとゲームオーバー', GAME_W / 2, 435);

  ctx.font      = '11px sans-serif';
  ctx.fillStyle = '#999';
  ctx.fillText('Lv.2（150m〜）→ Lv.3（350m〜）→ ゴール（500m）', GAME_W / 2, 452);

  ctx.fillStyle = '#5cba4a';
  ctx.beginPath();
  ctx.roundRect(GAME_W / 2 - 95, 468, 190, 52, 26);
  ctx.fill();
  ctx.fillStyle    = 'white';
  ctx.font         = 'bold 20px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('スタート！', GAME_W / 2, 494);
}

// ================================================================
// drawGameOver
// ================================================================

function drawGameOver() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
  ctx.beginPath();
  ctx.roundRect(35, 185, GAME_W - 70, 345, 20);
  ctx.fill();

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'white';
  ctx.font      = 'bold 24px sans-serif';
  ctx.fillText('けだまる……', GAME_W / 2, 233);

  ctx.fillStyle = '#aaa';
  ctx.font      = '14px sans-serif';
  ctx.fillText('毛量がなくなってしまった', GAME_W / 2, 263);

  ctx.fillStyle = 'white';
  ctx.font      = 'bold 18px sans-serif';
  ctx.fillText(`スコア:  ${score}`, GAME_W / 2, 303);
  ctx.fillText(`距離:  ${Math.floor(distance)} m`, GAME_W / 2, 330);

  const lv = LEVELS[currentLevel];
  ctx.fillStyle = lv.color;
  ctx.font      = 'bold 15px sans-serif';
  ctx.fillText(`到達レベル: ${lv.label}`, GAME_W / 2, 357);

  if (score > 0 && score >= highScore) {
    ctx.fillStyle = '#ffcc00';
    ctx.font      = 'bold 15px sans-serif';
    ctx.fillText('🏆 NEW ハイスコア！', GAME_W / 2, 384);
  } else if (highScore > 0) {
    ctx.fillStyle = '#888';
    ctx.font      = '13px sans-serif';
    ctx.fillText(`ベスト: ${highScore}点`, GAME_W / 2, 384);
  }

  ctx.fillStyle = '#5cba4a';
  ctx.beginPath();
  ctx.roundRect(GAME_W / 2 - 95, 403, 190, 46, 23);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font      = 'bold 17px sans-serif';
  ctx.fillText('もう一度（R キー）', GAME_W / 2, 426);

  ctx.fillStyle = '#444';
  ctx.beginPath();
  ctx.roundRect(GAME_W / 2 - 95, 458, 190, 42, 21);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font      = '15px sans-serif';
  ctx.fillText('タイトルへ（T キー）', GAME_W / 2, 479);
}

// ================================================================
// drawCleared：500m ゴール達成画面
// ================================================================

function drawCleared() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  // ゴールパネル（金色枠）
  ctx.fillStyle = 'rgba(30, 25, 10, 0.96)';
  ctx.beginPath();
  ctx.roundRect(35, 165, GAME_W - 70, 375, 20);
  ctx.fill();
  ctx.strokeStyle = '#f0c030';
  ctx.lineWidth   = 3;
  ctx.stroke();

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#f0c030';
  ctx.font      = 'bold 28px sans-serif';
  ctx.fillText('🎉 散歩完走！', GAME_W / 2, 215);

  ctx.fillStyle = '#ddd';
  ctx.font      = '14px sans-serif';
  ctx.fillText(`500m を走りきった！`, GAME_W / 2, 248);

  ctx.fillStyle = 'white';
  ctx.font      = 'bold 20px sans-serif';
  ctx.fillText(`スコア:  ${score}`, GAME_W / 2, 288);

  const lv = LEVELS[currentLevel];
  ctx.fillStyle = lv.color;
  ctx.font      = 'bold 15px sans-serif';
  ctx.fillText(`到達レベル: ${lv.label}`, GAME_W / 2, 318);

  ctx.fillStyle = '#c0c0c0';
  ctx.font      = '14px sans-serif';
  ctx.fillText(`🐾 毛量: ${Math.floor(kdm.furAmount)}%`, GAME_W / 2, 345);

  if (score > 0 && score >= highScore) {
    ctx.fillStyle = '#ffcc00';
    ctx.font      = 'bold 15px sans-serif';
    ctx.fillText('🏆 NEW ハイスコア！', GAME_W / 2, 373);
  } else if (highScore > 0) {
    ctx.fillStyle = '#888';
    ctx.font      = '13px sans-serif';
    ctx.fillText(`ベスト: ${highScore}点`, GAME_W / 2, 373);
  }

  // もう一度ボタン
  ctx.fillStyle = '#f0a020';
  ctx.beginPath();
  ctx.roundRect(GAME_W / 2 - 95, 393, 190, 46, 23);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font      = 'bold 17px sans-serif';
  ctx.fillText('もう一度（R キー）', GAME_W / 2, 416);

  // タイトルへボタン
  ctx.fillStyle = '#444';
  ctx.beginPath();
  ctx.roundRect(GAME_W / 2 - 95, 448, 190, 42, 21);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font      = '15px sans-serif';
  ctx.fillText('タイトルへ（T キー）', GAME_W / 2, 469);
}

// ================================================================
// 入力処理：キーボード
// ================================================================

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft'  || e.code === 'KeyA') keys.left  = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;

  if (e.code === 'Space') {
    e.preventDefault();
    if (gamePhase === 'title') {
      initGame();
    } else if (gamePhase === 'playing') {
      kdm.vy = JUMP_FORCE;
    }
  }

  if (e.code === 'KeyR'   && (gamePhase === 'gameover' || gamePhase === 'cleared')) restartGame();
  if (e.code === 'Escape' && gamePhase === 'playing')                               gamePhase = 'title';
  if (e.code === 'KeyT'   && (gamePhase === 'gameover' || gamePhase === 'cleared')) gamePhase = 'title';
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft'  || e.code === 'KeyA') keys.left  = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
});

// ================================================================
// 入力処理：タッチ・クリック
// ================================================================

// タッチ座標を Canvas 論理座標に変換するユーティリティ
function getTouchCoords(e) {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = GAME_W / rect.width;
  const scaleY = GAME_H / rect.height;
  return {
    cx: (e.clientX - rect.left) * scaleX,
    cy: (e.clientY - rect.top)  * scaleY,
  };
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const { cx, cy } = getTouchCoords(e);

  if (gamePhase === 'title') {
    if (cy >= 468 && cy <= 520) initGame();
    return;
  }

  if (gamePhase === 'gameover') {
    if (cy >= 403 && cy <= 449) { restartGame();       return; }
    if (cy >= 458 && cy <= 500) { gamePhase = 'title'; return; }
    return;
  }

  if (gamePhase === 'cleared') {
    if (cy >= 393 && cy <= 439) { restartGame();       return; }
    if (cy >= 448 && cy <= 490) { gamePhase = 'title'; return; }
    return;
  }

  if (gamePhase === 'playing') {
    // 🏠 ボタン
    if (cx >= GAME_W - 48 && cx <= GAME_W - 14 && cy >= 13 && cy <= 39) {
      gamePhase = 'title';
      return;
    }

    // スマホ：左右ボタン（pointerId を記録して押しっぱなしを追跡）
    if (IS_TOUCH && cx >= MB_LEFT_X1 && cx <= MB_LEFT_X2 && cy >= MB_Y1 && cy <= MB_Y2) {
      touchPointers.set(e.pointerId, 'left');
      keys.left = true;
      return;
    }
    if (IS_TOUCH && cx >= MB_RIGHT_X1 && cx <= MB_RIGHT_X2 && cy >= MB_Y1 && cy <= MB_Y2) {
      touchPointers.set(e.pointerId, 'right');
      keys.right = true;
      return;
    }

    // それ以外のタップ = ジャンプ（左右ボタン押しっぱなし中でも同時に発火する）
    touchPointers.set(e.pointerId, 'jump');
    kdm.vy = JUMP_FORCE;
  }
});

// 指を離したとき：対応するキーを解放する
canvas.addEventListener('pointerup', (e) => {
  const role = touchPointers.get(e.pointerId);
  if (role === 'left')  keys.left  = false;
  if (role === 'right') keys.right = false;
  touchPointers.delete(e.pointerId);
});

// タッチがキャンセルされた場合も同様に解放する（電話着信などで中断された場合）
canvas.addEventListener('pointercancel', (e) => {
  const role = touchPointers.get(e.pointerId);
  if (role === 'left')  keys.left  = false;
  if (role === 'right') keys.right = false;
  touchPointers.delete(e.pointerId);
});

// ================================================================
// 起動
// ================================================================

try { highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY)) || 0; } catch (_) { highScore = 0; }

gamePhase    = 'title';
keys         = { left: false, right: false };
items        = [];
obstacles    = [];
particles    = [];
score        = 0;
distance     = 0;
frameCount   = 0;
bgOffset     = 0;
currentLevel = 0;
levelUpFlash = 0;
shakeFrames  = 0;
shakeAmount  = 0;
combo        = 0;
comboText    = null;
nextItemFrame = 60;
nextObsFrame  = 90;
kdm = {
  x: KDM_START_X, y: GROUND_Y,
  vx: 0, vy: 0, isOnGround: true,
  furAmount: 100, energy: 100,
  bounceOffset: 0, bounceTimer: 0,
  blinkTimer: 100, isBlinking: false,
  damageFlash: 0,
};

requestAnimationFrame(gameLoop);
