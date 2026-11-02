const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreValue = document.getElementById('scoreValue');
const waveValue = document.getElementById('waveValue');
const healthFill = document.getElementById('healthFill');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const startButton = document.getElementById('startButton');
const jumpButton = document.getElementById('fireButton');
const touchButtons = [...document.querySelectorAll('[data-dir]')];

const W = canvas.width;
const H = canvas.height;
const LEVEL_WIDTH = 2200;
const GROUND_Y = 500;
const GOAL_X = 2070;
const CHECKPOINT_X = 1210;
const TARGET_COINS = 12;
const ENEMY_SQUISH_DURATION = 0.46;
const PIPES = [
  { x: 315, w: 58, h: 74 },
  { x: 920, w: 64, h: 104 },
  { x: 1430, w: 62, h: 82 },
  { x: 1870, w: 68, h: 112 },
].map(pipe => ({ ...pipe, y: GROUND_Y - pipe.h }));
const keys = new Set();
const touchDirs = new Set();
let player;
let platforms = [];
let coins = [];
let enemies = [];
let cameraX = 0;
let gameState = 'menu';
let lastTime = 0;
let elapsed = 0;
let jumpQueued = false;
let messageTimer = 0;
let message = '';
let particles = [];
let cameraShake = 0;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function buildLevel() {
  platforms = [
    { x: 0, y: GROUND_Y, w: 530, h: 100 },
    { x: 620, y: GROUND_Y, w: 475, h: 100 },
    { x: 1180, y: GROUND_Y, w: 420, h: 100 },
    { x: 1700, y: GROUND_Y, w: 500, h: 100 },
    { x: 170, y: 416, w: 132, h: 18 },
    { x: 390, y: 350, w: 150, h: 18 },
    { x: 670, y: 410, w: 130, h: 18 },
    { x: 850, y: 340, w: 160, h: 18 },
    { x: 1110, y: 420, w: 130, h: 18 },
    { x: 1300, y: 350, w: 160, h: 18 },
    { x: 1510, y: 405, w: 140, h: 18 },
    { x: 1740, y: 350, w: 150, h: 18 },
    { x: 1940, y: 290, w: 145, h: 18 },
  ];
  coins = [];
  const rows = [
    [115, 464], [220, 372], [440, 306], [500, 306], [565, 440], [700, 365],
    [760, 365], [900, 296], [960, 296], [1050, 464], [1150, 464], [1350, 306],
    [1410, 306], [1490, 464], [1570, 360], [1765, 306], [1825, 306], [1980, 246],
    [2040, 246], [2120, 464],
  ];
  rows.forEach(([x, y]) => coins.push({ x, y, taken: false, phase: Math.random() * Math.PI * 2 }));
  enemies = [
    { x: 340, y: GROUND_Y - 28, w: 34, h: 28, min: 315, max: 380, dir: 1, speed: 50, alive: true, squishTimer: 0 },
    { x: 740, y: GROUND_Y - 28, w: 34, h: 28, min: 655, max: 805, dir: -1, speed: 56, alive: true, squishTimer: 0 },
    { x: 1260, y: GROUND_Y - 28, w: 34, h: 28, min: 1200, max: 1325, dir: 1, speed: 52, alive: true, squishTimer: 0 },
    { x: 1810, y: GROUND_Y - 28, w: 34, h: 28, min: 1730, max: 1900, dir: -1, speed: 62, alive: true, squishTimer: 0 },
  ];
}

function resetGame() {
  buildLevel();
  player = { x: 62, y: GROUND_Y - 48, w: 30, h: 46, vx: 0, vy: 0, grounded: true, coyote: 0.12, jumpBuffer: 0, facing: 1, lives: 3, coins: 0, invulnerable: 0, walk: 0, checkpoint: 62, checkpointActive: false };
  cameraX = 0;
  elapsed = 0;
  particles = [];
  cameraShake = 0;
  updateHUD();
}

function updateHUD() {
  scoreValue.textContent = String(player ? player.coins : 0);
  waveValue.textContent = '1-1';
  if (player) {
    healthFill.style.width = `${(player.lives / 3) * 100}%`;
    healthFill.setAttribute('aria-valuenow', String(player.lives));
  }
}

function showOverlay(title, text, buttonText) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startButton.textContent = buttonText;
  overlay.classList.add('visible');
}

function startGame() {
  resetGame();
  gameState = 'playing';
  overlay.classList.remove('visible');
  keys.clear();
  touchDirs.clear();
}

function setMessage(text) {
  message = text;
  messageTimer = 1.8;
}

function burst(x, y, color, amount = 9) {
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 45 + Math.random() * 130;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 35, life: 0.55, color, size: 4 + Math.random() * 5 });
  }
}

function loseLife(fell = false) {
  if (player.invulnerable > 0 && !fell) return;
  if (player.invulnerable <= 0) player.lives -= 1;
  player.invulnerable = 1.5;
  cameraShake = 9;
  burst(player.x + player.w / 2, player.y + player.h / 2, '#ff8170');
  updateHUD();
  if (player.lives <= 0) {
    gameState = 'over';
    showOverlay('Ouch!', `You collected ${player.coins} coins. Give it another try!`, 'Try Again');
    return;
  }
  if (fell) {
    player.x = player.checkpoint;
    player.y = GROUND_Y - player.h;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
  } else {
    player.vy = -320;
    player.vx = -player.facing * 150;
  }
}

function movePlayer(dt) {
  const left = keys.has('ArrowLeft') || keys.has('a') || touchDirs.has('left');
  const right = keys.has('ArrowRight') || keys.has('d') || touchDirs.has('right');
  const jumpHeld = keys.has('ArrowUp') || keys.has('w') || keys.has(' ') || touchDirs.has('up') || touchDirs.has('jump');
  const direction = Number(right) - Number(left);
  if (direction) {
    player.vx += direction * 1500 * dt;
    player.facing = direction;
  } else {
    player.vx *= Math.pow(0.0008, dt);
  }
  player.vx = clamp(player.vx, -285, 285);
  if (jumpQueued) player.jumpBuffer = 0.13;
  else player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
  if (player.grounded) player.coyote = 0.12;
  else player.coyote = Math.max(0, player.coyote - dt);
  if (player.jumpBuffer > 0 && player.coyote > 0) {
    player.vy = -570;
    player.grounded = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
  }
  if (!jumpHeld && player.vy < -180) player.vy += 1200 * dt;
  jumpQueued = false;
  player.vy = Math.min(player.vy + 1550 * dt, 760);

  const oldX = player.x;
  const oldY = player.y;
  const wasGrounded = player.grounded;
  player.x += player.vx * dt;
  player.x = clamp(player.x, 0, LEVEL_WIDTH - player.w);

  for (const pipe of PIPES) {
    const overlapsVertically = player.y < pipe.y + pipe.h && player.y + player.h > pipe.y;
    if (overlapsVertically && player.x + player.w > pipe.x && player.x < pipe.x + pipe.w) {
      if (player.vx > 0) player.x = pipe.x - player.w;
      else if (player.vx < 0) player.x = pipe.x + pipe.w;
      player.vx = 0;
    }
  }

  player.y += player.vy * dt;
  player.grounded = false;

  if (player.vy >= 0) {
    for (const p of [...platforms, ...PIPES]) {
      const crossedTop = oldY + player.h <= p.y + 2 && player.y + player.h >= p.y;
      if (crossedTop && player.x + player.w > p.x && player.x < p.x + p.w) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.grounded = true;
      }
    }
  } else {
    for (const pipe of PIPES) {
      const pipeBottom = pipe.y + pipe.h;
      const hitUnderside = oldY >= pipeBottom - 2 && player.y <= pipeBottom;
      if (hitUnderside && player.x + player.w > pipe.x && player.x < pipe.x + pipe.w) {
        player.y = pipeBottom;
        player.vy = 0;
      }
    }
  }
  if (!wasGrounded && player.grounded) burst(player.x + player.w / 2, player.y + player.h, '#fff4d2', 4);
  if (player.grounded && Math.abs(player.vx) > 18) {
    player.walk += dt * (5.5 + Math.abs(player.vx) * 0.025);
  }
  if (player.y > H + 100) loseLife(true);
  if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
}

function update(dt) {
  elapsed += dt;
  movePlayer(dt);
  cameraX = clamp(player.x - W * 0.36, 0, LEVEL_WIDTH - W);
  if (!player.checkpointActive && player.x + player.w >= CHECKPOINT_X) {
    player.checkpoint = CHECKPOINT_X + 18;
    player.checkpointActive = true;
    setMessage('Checkpoint reached!');
    burst(CHECKPOINT_X, GROUND_Y - 36, '#8fffc1', 12);
  }

  for (const coin of coins) {
    if (!coin.taken) {
      const bobY = coin.y + Math.sin(elapsed * 5 + coin.phase) * 4;
      const box = { x: coin.x - 12, y: bobY - 14, w: 24, h: 28 };
      if (overlap(player, box)) {
        coin.taken = true;
        player.coins += 1;
        burst(coin.x, bobY, '#ffd84e', 7);
        updateHUD();
      }
    }
  }

  for (const enemy of enemies) {
    if (!enemy.alive) {
      enemy.squishTimer = Math.max(0, enemy.squishTimer - dt);
      continue;
    }
    enemy.x += enemy.dir * enemy.speed * dt;
    if (enemy.x < enemy.min || enemy.x + enemy.w > enemy.max) enemy.dir *= -1;
    if (overlap(player, enemy)) {
      const stomp = player.vy > 80 && player.y + player.h - enemy.y < 20;
      if (stomp) {
        enemy.alive = false;
        enemy.squishTimer = ENEMY_SQUISH_DURATION;
        player.vy = -360;
        cameraShake = Math.max(cameraShake, 3);
        burst(enemy.x + enemy.w / 2, enemy.y, '#c58a53', 10);
      } else {
        loseLife();
      }
    }
  }

  if (player.x + player.w >= GOAL_X) {
    if (player.coins >= TARGET_COINS) {
      gameState = 'won';
      showOverlay('You made it!', `Amazing run! You grabbed ${player.coins} coins and reached the flag.`, 'Play Again');
    } else {
      setMessage(`Find ${TARGET_COINS - player.coins} more coins to unlock the flag!`);
      player.x = GOAL_X - player.w - 2;
      player.vx = 0;
    }
  }
  if (messageTimer > 0) messageTimer -= dt;
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 300 * dt;
  }
}

function roundedRect(x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function roundedGradientRect(x, y, w, h, r, topColor, bottomColor) {
  const gradient = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  gradient.addColorStop(0, topColor);
  gradient.addColorStop(1, bottomColor);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#3988d9');
  sky.addColorStop(0.38, '#72c7f1');
  sky.addColorStop(0.76, '#c7eff0');
  sky.addColorStop(1, '#f5f5ce');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Warm sun glow and a slow, subtle atmospheric pulse.
  const sunX = 755 - cameraX * 0.035;
  const sunY = 102;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 190);
  sunGlow.addColorStop(0, 'rgba(255,246,190,0.76)');
  sunGlow.addColorStop(0.28, 'rgba(255,238,172,0.26)');
  sunGlow.addColorStop(1, 'rgba(255,238,172,0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(sunX - 190, sunY - 190, 380, 380);
  ctx.fillStyle = '#fff4bd';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.58)';
  ctx.beginPath();
  ctx.ellipse(sunX - 6, sunY - 8, 10, 4, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // Distant mountain silhouettes create scale behind the playable valley.
  const mountainLayers = [
    { spacing: 420, parallax: 0.12, base: 377, color: '#91c9d4', peak: 100 },
    { spacing: 520, parallax: 0.2, base: 398, color: '#72b6ba', peak: 77 },
  ];
  for (const layer of mountainLayers) {
    const drift = (cameraX * layer.parallax) % layer.spacing;
    for (let i = -2; i < 5; i += 1) {
      const x = i * layer.spacing - drift;
      const peakX = x + layer.spacing * (0.36 + (i % 2) * 0.12);
      const peakY = layer.base - layer.peak;
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.moveTo(x - 20, layer.base);
      ctx.lineTo(peakX, peakY);
      ctx.lineTo(x + layer.spacing * 0.68, layer.base);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(248,255,239,0.78)';
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(peakX - 27, peakY + 36);
      ctx.lineTo(peakX - 5, peakY + 28);
      ctx.lineTo(peakX + 15, peakY + 43);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Rolling hills at two parallax speeds soften the mountain horizon.
  for (let layer = 0; layer < 2; layer += 1) {
    const spacing = layer ? 280 : 360;
    const drift = (cameraX * (layer ? 0.34 : 0.25)) % spacing;
    ctx.fillStyle = layer ? '#8bd28c' : '#a9df9c';
    ctx.beginPath();
    ctx.moveTo(-spacing, 444);
    for (let i = -2; i < 7; i += 1) {
      const x = i * spacing - drift;
      const peak = 365 + ((i + layer) % 3) * 17;
      ctx.quadraticCurveTo(x + spacing * 0.48, peak, x + spacing, 435);
    }
    ctx.lineTo(W + spacing, H);
    ctx.lineTo(-spacing, H);
    ctx.closePath();
    ctx.fill();
  }

  // Sunlit clouds float at different depths.
  for (let i = 0; i < 8; i += 1) {
    const x = i * 175 - (cameraX * 0.16 % 175) - 55;
    const y = 72 + (i % 3) * 47;
    drawCloud(x, y, 0.78 + (i % 2) * 0.2);
  }

  // A soft tree line anchors the playable space without competing with it.
  for (let i = 0; i < 16; i += 1) {
    const spacing = 125;
    const x = i * spacing - (cameraX * 0.62 % spacing) - 30;
    const height = 28 + (i % 4) * 8;
    const crownY = 416 - height;
    ctx.fillStyle = 'rgba(92,75,60,0.72)';
    ctx.fillRect(x - 3, crownY + 20, 7, 40);
    const crown = ctx.createLinearGradient(0, crownY, 0, crownY + 46);
    crown.addColorStop(0, i % 2 ? '#4eae6a' : '#55b773');
    crown.addColorStop(1, '#32885c');
    ctx.fillStyle = crown;
    ctx.beginPath();
    ctx.arc(x, crownY + 12, 22, Math.PI, 0);
    ctx.arc(x + 17, crownY + 25, 17, Math.PI * 1.05, Math.PI * 0.05);
    ctx.arc(x - 17, crownY + 27, 17, Math.PI * 0.95, -0.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(207,255,174,0.25)';
    ctx.beginPath();
    ctx.arc(x - 7, crownY + 8, 7, Math.PI, 0);
    ctx.fill();
  }

  // Tiny drifting pollen catches the light and adds a sense of air and depth.
  for (let i = 0; i < 18; i += 1) {
    const drift = (elapsed * (7 + i % 4) + i * 73) % (W + 20);
    const x = (drift - cameraX * 0.08 + W) % W;
    const y = 190 + (i * 47 % 220) + Math.sin(elapsed * 1.3 + i) * 5;
    ctx.fillStyle = `rgba(255,250,195,${0.22 + (i % 3) * 0.1})`;
    ctx.beginPath();
    ctx.arc(x, y, i % 4 === 0 ? 1.8 : 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCloud(x, y, s) {
  ctx.save();
  ctx.translate(0, Math.sin(elapsed * 0.5 + x * 0.01) * 2);
  ctx.fillStyle = 'rgba(89,151,188,0.18)';
  ctx.beginPath();
  ctx.ellipse(x + 44 * s, y + 25 * s, 43 * s, 12 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  const cloud = ctx.createLinearGradient(0, y, 0, y + 28 * s);
  cloud.addColorStop(0, 'rgba(255,255,255,0.98)');
  cloud.addColorStop(0.65, 'rgba(250,253,248,0.94)');
  cloud.addColorStop(1, 'rgba(214,237,240,0.9)');
  ctx.fillStyle = cloud;
  ctx.beginPath();
  ctx.arc(x + 22 * s, y + 16 * s, 17 * s, Math.PI, 0);
  ctx.arc(x + 43 * s, y + 10 * s, 23 * s, Math.PI, 0);
  ctx.arc(x + 68 * s, y + 18 * s, 16 * s, Math.PI, 0);
  ctx.lineTo(x + 84 * s, y + 22 * s);
  ctx.lineTo(x + 7 * s, y + 22 * s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawWorld() {
  for (const pit of [[530, 90], [1095, 85], [1600, 100]]) {
    const x = pit[0] - cameraX;
    ctx.fillStyle = '#71d5ef';
    ctx.fillRect(x, GROUND_Y, pit[1], 40);
    ctx.fillStyle = '#438fc5';
    ctx.fillRect(x, GROUND_Y + 38, pit[1], 55);
  }
  for (const p of platforms) {
    const x = p.x - cameraX;
    if (x + p.w < -10 || x > W + 10) continue;
    if (p.y === GROUND_Y) {
      const soil = ctx.createLinearGradient(0, p.y + 14, 0, p.y + p.h);
      soil.addColorStop(0, '#b96738');
      soil.addColorStop(1, '#713d32');
      ctx.fillStyle = soil;
      ctx.fillRect(x, p.y, p.w, p.h);

      const grass = ctx.createLinearGradient(0, p.y, 0, p.y + 16);
      grass.addColorStop(0, '#8af06a');
      grass.addColorStop(0.35, '#58d64e');
      grass.addColorStop(1, '#319a4f');
      ctx.fillStyle = grass;
      ctx.fillRect(x, p.y, p.w, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(x, p.y, p.w, 2);

      // Fine strata and scattered stones give the cut soil a layered, earthy face.
      ctx.fillStyle = 'rgba(255,190,115,0.16)';
      ctx.fillRect(x, p.y + 24, p.w, 2);
      ctx.fillRect(x, p.y + 61, p.w, 1);
      ctx.fillStyle = 'rgba(74,38,34,0.48)';
      for (let bx = p.x + 12; bx < p.x + p.w; bx += 44) {
        const sx = bx - cameraX;
        ctx.fillRect(sx, p.y + 34, 3, 25);
        ctx.fillRect(sx + 20, p.y + 69, 3, 24);
      }
      for (let bx = Math.ceil(p.x / 71) * 71 + 29; bx < p.x + p.w; bx += 71) {
        const sx = bx - cameraX;
        ctx.fillStyle = 'rgba(87,43,33,0.42)';
        ctx.beginPath();
        ctx.ellipse(sx, p.y + 44 + (bx % 3) * 5, 5 + bx % 4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,190,115,0.28)';
        ctx.fillRect(sx - 3, p.y + 42 + (bx % 3) * 5, 4, 1);
      }
    } else {
      const dirt = ctx.createLinearGradient(0, p.y + 5, 0, p.y + p.h);
      dirt.addColorStop(0, '#bd6b40');
      dirt.addColorStop(1, '#713a29');
      ctx.fillStyle = dirt;
      ctx.fillRect(x, p.y + 5, p.w, p.h - 5);

      const top = ctx.createLinearGradient(0, p.y, 0, p.y + 7);
      top.addColorStop(0, '#ffd07a');
      top.addColorStop(1, '#d77c3e');
      ctx.fillStyle = top;
      ctx.fillRect(x, p.y, p.w, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.48)';
      ctx.fillRect(x + 2, p.y, p.w - 4, 1);
      ctx.fillStyle = 'rgba(67,31,25,0.55)';
      ctx.fillRect(x, p.y + p.h - 2, p.w, 2);
      ctx.fillStyle = '#713a29';
      for (let bx = x + 25; bx < x + p.w; bx += 50) ctx.fillRect(bx, p.y + 8, 3, 9);
      ctx.fillStyle = '#f2bb6a';
      for (let bx = x + 12; bx < x + p.w; bx += 50) ctx.fillRect(bx, p.y + 9, 3, 3);
    }
  }
  for (const pipe of PIPES) {
    const x = pipe.x - cameraX;
    const y = pipe.y;
    const body = ctx.createLinearGradient(x + 7, 0, x + pipe.w - 7, 0);
    body.addColorStop(0, '#087c3d');
    body.addColorStop(0.24, '#20b752');
    body.addColorStop(0.62, '#37d465');
    body.addColorStop(1, '#087c3d');
    ctx.fillStyle = body;
    ctx.fillRect(x + 7, y + 12, pipe.w - 14, pipe.h - 12);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x + 12, y + 18, 3, pipe.h - 24);
    ctx.fillStyle = 'rgba(0,75,35,0.3)';
    ctx.fillRect(x + pipe.w - 15, y + 17, 4, pipe.h - 20);

    const rim = ctx.createLinearGradient(x, y, x, y + 16);
    rim.addColorStop(0, '#66f28a');
    rim.addColorStop(0.42, '#31d665');
    rim.addColorStop(1, '#108743');
    ctx.fillStyle = rim;
    ctx.fillRect(x, y, pipe.w, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(x + 4, y + 2, pipe.w - 8, 2);
    ctx.fillStyle = 'rgba(0,74,35,0.42)';
    ctx.fillRect(x + 4, y + 13, pipe.w - 8, 3);
  }

  const cx = CHECKPOINT_X - cameraX;
  const flagSwing = Math.sin(elapsed * 4) * 4;
  ctx.fillStyle = '#f4f0dc';
  ctx.fillRect(cx, 382, 6, GROUND_Y - 382);
  ctx.fillStyle = player && player.checkpointActive ? '#35d99a' : '#f1a94e';
  ctx.beginPath();
  ctx.moveTo(cx + 6, 388 + flagSwing * 0.2);
  ctx.lineTo(cx + 49, 402 + flagSwing);
  ctx.lineTo(cx + 6, 416 + flagSwing * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx + 3, 380, 7, 0, Math.PI * 2);
  ctx.fill();

  const fx = GOAL_X - cameraX;
  const goalSwing = Math.sin(elapsed * 5) * 6;
  ctx.fillStyle = '#f4f0dc';
  ctx.fillRect(fx, 218, 8, GROUND_Y - 218);
  ctx.fillStyle = '#ff4f52';
  ctx.beginPath();
  ctx.moveTo(fx + 8, 224 + goalSwing * 0.2);
  ctx.lineTo(fx + 72, 245 + goalSwing);
  ctx.lineTo(fx + 8, 266 + goalSwing * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffe16a';
  ctx.beginPath();
  ctx.arc(fx + 4, 216, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui';
  ctx.fillText('GO!', fx + 19, 250);
}

function drawCoins() {
  for (const coin of coins) {
    if (coin.taken) continue;
    const x = coin.x - cameraX;
    if (x < -30 || x > W + 30) continue;
    const bob = Math.sin(elapsed * 5 + coin.phase) * 4;
    const y = coin.y + bob;
    const sparkle = 1 + Math.sin(elapsed * 9 + coin.phase) * 0.12;
    const rotation = Math.sin(elapsed * 6 + coin.phase) * 0.4;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(sparkle, sparkle);

    const coinFace = ctx.createLinearGradient(-10, -12, 9, 12);
    coinFace.addColorStop(0, '#fff17b');
    coinFace.addColorStop(0.35, '#ffd43d');
    coinFace.addColorStop(0.72, '#f5a91f');
    coinFace.addColorStop(1, '#c77a13');
    ctx.fillStyle = '#a96713';
    ctx.beginPath();
    ctx.ellipse(0, 1, 11, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = coinFace;
    ctx.beginPath();
    ctx.ellipse(-1, -1, 9, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,248,172,0.82)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-1, -1, 5, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.beginPath();
    ctx.ellipse(-4, -7, 2, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawEnemy(enemy) {
  if (!enemy.alive && enemy.squishTimer <= 0) return;
  const x = enemy.x - cameraX;
  const squishProgress = enemy.alive ? 0 : 1 - enemy.squishTimer / ENEMY_SQUISH_DURATION;
  const squashIn = clamp(squishProgress / 0.16, 0, 1);
  const squeeze = 1 - Math.pow(1 - squashIn, 3);
  const scaleY = 1 - squeeze * 0.68;
  const scaleX = 1 + squeeze * 0.38;
  const fade = enemy.alive ? 1 : clamp(enemy.squishTimer / (ENEMY_SQUISH_DURATION * 0.42), 0, 1);
  const bounce = enemy.alive ? Math.sin(elapsed * 8 + enemy.x * 0.2) * 1.5 : 0;
  const anchorY = enemy.y + enemy.h;

  ctx.save();
  ctx.globalAlpha *= fade;
  ctx.translate(x + enemy.w / 2, anchorY);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-(x + enemy.w / 2), -anchorY);

  ctx.fillStyle = 'rgba(58,38,28,0.2)';
  ctx.beginPath();
  ctx.ellipse(x + enemy.w / 2, GROUND_Y - 1, 18, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(x + 12, enemy.y + 8 + bounce, 2, x + 17, enemy.y + 17 + bounce, 20);
  body.addColorStop(0, '#e7ac64');
  body.addColorStop(0.65, '#b77b3f');
  body.addColorStop(1, '#704322');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(x + enemy.w / 2, enemy.y + 19 + bounce, 18, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  const cap = ctx.createLinearGradient(0, enemy.y + bounce, 0, enemy.y + 17 + bounce);
  cap.addColorStop(0, '#f0bd77');
  cap.addColorStop(0.55, '#c78a4c');
  cap.addColorStop(1, '#8a552e');
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.arc(x + enemy.w / 2, enemy.y + 14 + bounce, 15, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,235,190,0.5)';
  ctx.beginPath();
  ctx.ellipse(x + 12, enemy.y + 6 + bounce, 5, 2, -0.25, 0, Math.PI * 2);
  ctx.fill();

  if (enemy.alive) {
    ctx.fillStyle = '#fff7df';
    ctx.fillRect(x + 9, enemy.y + 12 + bounce, 6, 8);
    ctx.fillRect(x + 21, enemy.y + 12 + bounce, 6, 8);
    ctx.fillStyle = '#30241d';
    ctx.fillRect(x + 12, enemy.y + 15 + bounce, 3, 4);
    ctx.fillRect(x + 22, enemy.y + 15 + bounce, 3, 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 12, enemy.y + 15 + bounce, 1, 1);
    ctx.fillRect(x + 22, enemy.y + 15 + bounce, 1, 1);
  } else {
    ctx.strokeStyle = '#4b3023';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 10, enemy.y + 17 + bounce);
    ctx.lineTo(x + 15, enemy.y + 16 + bounce);
    ctx.moveTo(x + 21, enemy.y + 16 + bounce);
    ctx.lineTo(x + 26, enemy.y + 17 + bounce);
    ctx.stroke();
    ctx.strokeStyle = '#704322';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 15, enemy.y + 22 + bounce);
    ctx.quadraticCurveTo(x + 18, enemy.y + 24 + bounce, x + 21, enemy.y + 22 + bounce);
    ctx.stroke();
  }

  roundedGradientRect(x + 3, enemy.y + 24 + bounce, 12, 5, 2, '#73513a', '#35251e');
  roundedGradientRect(x + 21, enemy.y + 24 + bounce, 12, 5, 2, '#73513a', '#35251e');
  ctx.restore();
}

function drawPlayer() {
  if (!player) return;
  if (player.invulnerable > 0 && Math.floor(elapsed * 15) % 2) return;

  const x = Math.round(player.x - cameraX);
  const y = Math.round(player.y);
  const speed = Math.abs(player.vx);
  const moving = player.grounded && speed > 18;
  const runAmount = moving ? clamp(speed / 150, 0, 1) : 0;
  const phase = player.walk;
  const stride = moving ? Math.sin(phase) : 0;
  const bob = moving ? Math.abs(Math.sin(phase)) * 1.8 * runAmount : 0;
  const lean = moving ? clamp(player.vx / 285, -1, 1) * 0.12 : 0;
  const airborne = !player.grounded;
  const shadowY = Math.max(0, GROUND_Y - (y + player.h));

  ctx.fillStyle = `rgba(46,37,32,${Math.max(0.08, 0.2 - shadowY * 0.0007)})`;
  ctx.beginPath();
  ctx.ellipse(x + player.w / 2, y + player.h + 2, Math.max(7, 13 - shadowY * 0.06), 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x + player.w / 2, y + player.h / 2 + bob);
  ctx.scale(player.facing, 1);
  ctx.scale(1, 1 + (moving ? Math.sin(phase * 2) * 0.025 * runAmount : 0));
  ctx.rotate(airborne ? (player.vy < 0 ? -0.08 : 0.07) : -lean);

  // Arms counter-swing against the legs to make each stride feel propulsive.
  const armSwing = moving ? stride * 0.88 * runAmount : airborne ? -0.4 : 0.08;
  const drawLimb = (px, py, angle, length, width, top, bottom) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    roundedGradientRect(-width / 2, 0, width, length, width / 2, top, bottom);
    ctx.restore();
  };
  const drawShoe = (px, py, angle, length, width, top, bottom) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.fillStyle = bottom;
    ctx.beginPath();
    ctx.moveTo(-width * 0.55, width * 0.18);
    ctx.lineTo(length * 0.72, width * 0.2);
    ctx.quadraticCurveTo(length, width * 0.2, length * 0.88, width * 0.62);
    ctx.lineTo(-width * 0.52, width * 0.62);
    ctx.quadraticCurveTo(-width * 0.82, width * 0.46, -width * 0.55, width * 0.18);
    ctx.fill();
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.moveTo(-width * 0.62, -width * 0.28);
    ctx.lineTo(length * 0.58, -width * 0.48);
    ctx.quadraticCurveTo(length, -width * 0.42, length * 0.94, 0);
    ctx.lineTo(length * 0.76, width * 0.24);
    ctx.lineTo(-width * 0.46, width * 0.18);
    ctx.quadraticCurveTo(-width * 0.8, 0, -width * 0.62, -width * 0.28);
    ctx.fill();
    ctx.restore();
  };

  // Legs swing in a wide side-profile arc: one reaches forward as the other pushes back.
  const legSwing = moving ? Math.sin(phase) * 1.25 * runAmount : 0;
  const backLeg = airborne ? 0.9 : legSwing;
  const frontLeg = airborne ? -0.65 : -legSwing;
  const farLegX = -2.5 - Math.sin(phase) * 1.6 * runAmount;
  const nearLegX = 2.5 + Math.sin(phase) * 1.6 * runAmount;
  const farFootX = farLegX - Math.sin(backLeg) * 10;
  const farFootY = 15 + Math.cos(backLeg) * 10;
  const nearFootX = nearLegX - Math.sin(frontLeg) * 10;
  const nearFootY = 14 + Math.cos(frontLeg) * 10;
  drawLimb(farLegX, 13, backLeg, 10, 5, '#3983dd', '#164c9d');
  drawShoe(farFootX, farFootY, backLeg * 0.16, 11, 5.5, '#d58d57', '#6f3b2d');

  // Back arm, torso, and the forward arm are separate layers for a little depth.
  drawLimb(-7, -4, armSwing, 12, 5, '#f2bd91', '#bd7958');
  roundedGradientRect(-9, -4, 17, 19, 5, '#5fb0ff', '#174d9d');
  // Bring the front leg over the shirt so its forward/back swing stays readable.
  drawLimb(nearLegX, 12, frontLeg, 10.5, 5.5, '#55a5ff', '#1553b5');
  drawShoe(nearFootX, nearFootY, frontLeg * 0.16, 11, 6, '#bd6c45', '#4f2a20');
  ctx.fillStyle = 'rgba(215,237,255,0.58)';
  ctx.beginPath();
  ctx.moveTo(-5, -1);
  ctx.lineTo(-2, -2);
  ctx.lineTo(-2, 11);
  ctx.lineTo(-5, 12);
  ctx.closePath();
  ctx.fill();
  roundedGradientRect(0, 8, 7, 7, 2, '#f8cc4f', '#ca7b21');
  ctx.fillStyle = 'rgba(255,238,172,0.8)';
  ctx.fillRect(1, 9, 2, 3);
  drawLimb(6, -3, -armSwing * 0.85, 11, 6, '#ffd2a8', '#c17b58');

  // Profiled face: a single eye, a small forward nose, and a visible ear.
  const face = ctx.createLinearGradient(-7, -16, 10, 3);
  face.addColorStop(0, '#ffe8c2');
  face.addColorStop(0.68, '#f2bd8c');
  face.addColorStop(1, '#ce875d');
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.moveTo(-8, -15);
  ctx.quadraticCurveTo(-2, -19, 5, -15);
  ctx.quadraticCurveTo(9, -13, 8, -9);
  ctx.lineTo(12, -6);
  ctx.quadraticCurveTo(13, -4, 9, -3);
  ctx.lineTo(8, 1);
  ctx.quadraticCurveTo(3, 5, -5, 2);
  ctx.quadraticCurveTo(-10, -2, -8, -15);
  ctx.fill();

  ctx.fillStyle = '#d58c60';
  ctx.beginPath();
  ctx.ellipse(-5, -5, 2.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fffdf4';
  ctx.beginPath();
  ctx.ellipse(4, -10, 2.3, 3.2, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#30252a';
  ctx.beginPath();
  ctx.ellipse(5.2, -9.5, 1.1, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(5, -11, 1, 1);
  ctx.fillStyle = '#8b423b';
  ctx.beginPath();
  ctx.moveTo(6, -1);
  ctx.quadraticCurveTo(8, 0, 10, -1);
  ctx.strokeStyle = '#8b423b';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Red cap with a forward brim gives the silhouette an unmistakable direction.
  const cap = ctx.createLinearGradient(0, -23, 0, -11);
  cap.addColorStop(0, '#ff8068');
  cap.addColorStop(0.55, '#f04b43');
  cap.addColorStop(1, '#a92835');
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.moveTo(-10, -16);
  ctx.quadraticCurveTo(-9, -23, -2, -23);
  ctx.lineTo(4, -22);
  ctx.quadraticCurveTo(7, -20, 7, -15);
  ctx.lineTo(12, -14);
  ctx.quadraticCurveTo(15, -13, 13, -11);
  ctx.lineTo(1, -12);
  ctx.lineTo(-10, -12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,220,194,0.75)';
  ctx.beginPath();
  ctx.moveTo(-7, -19);
  ctx.quadraticCurveTo(-2, -22, 3, -20);
  ctx.lineTo(3, -18);
  ctx.lineTo(-7, -17);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(116,28,40,0.5)';
  ctx.fillRect(-8, -13, 17, 1.5);

  ctx.restore();
}

function drawDecor() {
  const onGround = worldX => platforms.some(p => p.y === GROUND_Y && worldX >= p.x + 8 && worldX <= p.x + p.w - 8);

  // Short, world-anchored grass tufts break up the long platform edges without
  // obscuring the character's feet or the readable collision silhouette.
  for (let worldX = 18; worldX < LEVEL_WIDTH; worldX += 29) {
    if (!onGround(worldX)) continue;
    const x = worldX - cameraX;
    if (x < -12 || x > W + 12) continue;
    const height = 4 + (worldX % 4);
    ctx.strokeStyle = worldX % 2 ? '#359c4d' : '#42b752';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 3, GROUND_Y - 1);
    ctx.lineTo(x - 4, GROUND_Y - height);
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x + (worldX % 3) - 1, GROUND_Y - height - 2);
    ctx.moveTo(x + 3, GROUND_Y - 1);
    ctx.lineTo(x + 5, GROUND_Y - height + 1);
    ctx.stroke();
  }

  // Small, varied blossoms add color at a calmer rhythm than the grass.
  for (let worldX = 42; worldX < LEVEL_WIDTH; worldX += 103) {
    if (!onGround(worldX)) continue;
    const x = worldX - cameraX;
    if (x < -12 || x > W + 12) continue;
    const flowerY = GROUND_Y - 9 - worldX % 3;
    const petal = worldX % 2 ? '#fff4d8' : '#ffd8ef';
    ctx.strokeStyle = '#358e48';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y - 1);
    ctx.lineTo(x, flowerY + 2);
    ctx.stroke();
    ctx.fillStyle = petal;
    for (let petalIndex = 0; petalIndex < 4; petalIndex += 1) {
      const angle = petalIndex * Math.PI / 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * 2.4, flowerY + Math.sin(angle) * 2.4, 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffc846';
    ctx.beginPath();
    ctx.arc(x, flowerY, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function draw() {
  ctx.save();
  if (cameraShake > 0.15) ctx.translate((Math.random() - 0.5) * cameraShake, (Math.random() - 0.5) * cameraShake);
  drawBackground();
  drawWorld();
  drawDecor();
  drawCoins();
  enemies.forEach(drawEnemy);
  drawPlayer();
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / 0.55, 0, 1);
    ctx.fillStyle = p.color;
    const pulse = 1 + Math.sin((0.55 - p.life) * 25) * 0.6;
    ctx.fillRect(p.x - cameraX, p.y, p.size * pulse, p.size * pulse);
  }
  ctx.globalAlpha = 1;
  if (messageTimer > 0) {
    roundedRect(250, 22, 460, 42, 12, 'rgba(30,48,54,.85)');
    ctx.fillStyle = '#fff'; ctx.font = 'bold 17px system-ui'; ctx.textAlign = 'center'; ctx.fillText(message, W / 2, 49); ctx.textAlign = 'left';
  }
  // Coin progress is always visible in the playfield too.
  roundedRect(18, 16, 132, 38, 12, 'rgba(21,51,74,.72)');
  ctx.fillStyle = '#ffe16a'; ctx.font = 'bold 17px system-ui'; ctx.fillText(`● ${player ? player.coins : 0} / ${TARGET_COINS}`, 31, 41);
  ctx.restore();
}

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000 || 0, 0.033);
  lastTime = now;
  if (gameState === 'playing') update(dt);
  else elapsed += dt * 0.35;
  cameraShake *= Math.pow(0.01, dt);
  draw();
  requestAnimationFrame(frame);
}

startButton.addEventListener('click', startGame);
canvas.addEventListener('pointerdown', () => { if (gameState === 'playing') jumpQueued = true; });
jumpButton.addEventListener('pointerdown', event => {
  event.preventDefault();
  touchDirs.add('jump');
  jumpQueued = true;
  jumpButton.setPointerCapture(event.pointerId);
});
for (const button of touchButtons) {
  const dir = button.dataset.dir;
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    touchDirs.add(dir);
    if (dir === 'up') jumpQueued = true;
    button.setPointerCapture(event.pointerId);
  });
  const release = () => touchDirs.delete(dir);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}
jumpButton.addEventListener('pointerup', () => touchDirs.delete('jump'));
jumpButton.addEventListener('pointercancel', () => touchDirs.delete('jump'));
jumpButton.addEventListener('lostpointercapture', () => touchDirs.delete('jump'));
window.addEventListener('keydown', event => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'ArrowDown'].includes(key)) event.preventDefault();
  keys.add(key);
  if ((key === ' ' || key === 'ArrowUp' || key === 'w') && gameState === 'playing' && !event.repeat) jumpQueued = true;
  if (key === 'Enter' && gameState !== 'playing') startGame();
});
window.addEventListener('keyup', event => keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
window.addEventListener('blur', () => { keys.clear(); touchDirs.clear(); });

resetGame();
requestAnimationFrame(frame);
