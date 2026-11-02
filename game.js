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
    { x: 340, y: GROUND_Y - 28, w: 34, h: 28, min: 315, max: 380, dir: 1, speed: 50, alive: true },
    { x: 740, y: GROUND_Y - 28, w: 34, h: 28, min: 655, max: 805, dir: -1, speed: 56, alive: true },
    { x: 1260, y: GROUND_Y - 28, w: 34, h: 28, min: 1200, max: 1325, dir: 1, speed: 52, alive: true },
    { x: 1810, y: GROUND_Y - 28, w: 34, h: 28, min: 1730, max: 1900, dir: -1, speed: 62, alive: true },
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
    player.walk += dt * Math.abs(player.vx) * 0.045;
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

  const oldY = player.y;
  const wasGrounded = player.grounded;
  player.x += player.vx * dt;
  player.x = clamp(player.x, 0, LEVEL_WIDTH - player.w);
  player.y += player.vy * dt;
  player.grounded = false;

  if (player.vy >= 0) {
    for (const p of platforms) {
      const crossedTop = oldY + player.h <= p.y + 2 && player.y + player.h >= p.y;
      if (crossedTop && player.x + player.w > p.x && player.x < p.x + p.w) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.grounded = true;
      }
    }
  }
  if (!wasGrounded && player.grounded) burst(player.x + player.w / 2, player.y + player.h, '#fff4d2', 4);
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
    if (!enemy.alive) continue;
    enemy.x += enemy.dir * enemy.speed * dt;
    if (enemy.x < enemy.min || enemy.x + enemy.w > enemy.max) enemy.dir *= -1;
    if (overlap(player, enemy)) {
      const stomp = player.vy > 80 && player.y + player.h - enemy.y < 20;
      if (stomp) {
        enemy.alive = false;
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

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#68c9ff');
  sky.addColorStop(0.68, '#d2f3ff');
  sky.addColorStop(1, '#f4fbdb');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const shimmer = (Math.sin(elapsed * 0.8) + 1) * 0.5;
  ctx.fillStyle = `rgba(255,255,255,${0.2 + shimmer * 0.2})`;
  ctx.fillRect(0, 0, W, H * 0.42);

  for (let i = 0; i < 7; i += 1) {
    const x = i * 190 - (cameraX * 0.2 % 190) - 70;
    ctx.fillStyle = i % 2 ? '#a4e5a0' : '#8bdc9a';
    ctx.beginPath();
    ctx.ellipse(x + 95, 424, 145, 105, 0, Math.PI, 0);
    ctx.fill();
  }
  for (let i = 0; i < 9; i += 1) {
    const x = i * 155 - (cameraX * 0.42 % 155) - 40;
    const y = 95 + (i % 3) * 52;
    drawCloud(x, y, 0.8 + (i % 2) * 0.18);
  }
  for (let i = 0; i < 14; i += 1) {
    const x = i * 190 - (cameraX * 0.55 % 190) + 35;
    ctx.fillStyle = '#79583e';
    ctx.fillRect(x, 405, 12, 45);
    ctx.fillStyle = '#38ad64';
    ctx.beginPath();
    ctx.arc(x + 6, 398, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 9, 410, 18, 0, Math.PI * 2);
    ctx.arc(x + 21, 410, 18, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCloud(x, y, s) {
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.beginPath();
  ctx.arc(x + 22 * s, y + 16 * s, 17 * s, Math.PI, 0);
  ctx.arc(x + 43 * s, y + 10 * s, 23 * s, Math.PI, 0);
  ctx.arc(x + 68 * s, y + 18 * s, 16 * s, Math.PI, 0);
  ctx.lineTo(x + 84 * s, y + 22 * s);
  ctx.lineTo(x + 7 * s, y + 22 * s);
  ctx.closePath();
  ctx.fill();
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
      ctx.fillStyle = '#a85b32';
      ctx.fillRect(x, p.y, p.w, p.h);
      ctx.fillStyle = '#59c94f';
      ctx.fillRect(x, p.y, p.w, 16);
      ctx.fillStyle = '#8b452a';
      for (let bx = x + 12; bx < x + p.w; bx += 44) {
        ctx.fillRect(bx, p.y + 34, 3, 25);
        ctx.fillRect(bx + 20, p.y + 69, 3, 24);
      }
    } else {
      ctx.fillStyle = '#9b512d';
      ctx.fillRect(x, p.y, p.w, p.h);
      ctx.fillStyle = '#e69a4c';
      ctx.fillRect(x, p.y, p.w, 6);
      ctx.fillStyle = '#713a29';
      for (let bx = x + 25; bx < x + p.w; bx += 50) ctx.fillRect(bx, p.y + 7, 3, 10);
      ctx.fillStyle = '#f2bb6a';
      for (let bx = x + 12; bx < x + p.w; bx += 50) ctx.fillRect(bx, p.y + 8, 3, 3);
    }
  }
  for (const pipe of [{ x: 315, w: 58, h: 74 }, { x: 920, w: 64, h: 104 }, { x: 1430, w: 62, h: 82 }, { x: 1870, w: 68, h: 112 }]) {
    const x = pipe.x - cameraX;
    const y = GROUND_Y - pipe.h;
    ctx.fillStyle = '#159447'; ctx.fillRect(x + 7, y + 12, pipe.w - 14, pipe.h - 12);
    ctx.fillStyle = '#35cf62'; ctx.fillRect(x + 13, y + 14, 11, pipe.h - 14);
    ctx.fillStyle = '#159447'; ctx.fillRect(x, y, pipe.w, 16);
    ctx.fillStyle = '#57e879'; ctx.fillRect(x + 5, y + 3, pipe.w - 10, 7);
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

    ctx.fillStyle = '#d79d1d';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffdf55';
    ctx.beginPath();
    ctx.ellipse(-2, -2, 7, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff4a6';
    ctx.fillRect(-3, -8, 3, 7);
    ctx.restore();
  }
}

function drawEnemy(enemy) {
  if (!enemy.alive) return;
  const x = enemy.x - cameraX;
  const bounce = Math.sin(elapsed * 8 + enemy.x * 0.2) * 1.5;

  ctx.fillStyle = '#68401f';
  ctx.beginPath();
  ctx.ellipse(x + enemy.w / 2, enemy.y + 19 + bounce, 18, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#b77b3f';
  ctx.beginPath();
  ctx.arc(x + enemy.w / 2, enemy.y + 14 + bounce, 15, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 9, enemy.y + 12 + bounce, 6, 8);
  ctx.fillRect(x + 21, enemy.y + 12 + bounce, 6, 8);

  ctx.fillStyle = '#222';
  ctx.fillRect(x + 12, enemy.y + 15 + bounce, 3, 4);
  ctx.fillRect(x + 22, enemy.y + 15 + bounce, 3, 4);

  ctx.fillStyle = '#3c2b21';
  ctx.fillRect(x + 3, enemy.y + 25 + bounce, 12, 4);
  ctx.fillRect(x + 21, enemy.y + 25 + bounce, 12, 4);
}

function drawPlayer() {
  if (!player) return;
  if (player.invulnerable > 0 && Math.floor(elapsed * 15) % 2) return;
  const x = Math.round(player.x - cameraX);
  const y = Math.round(player.y);
  const step = player.grounded ? Math.sin(player.walk) * 2 : 0;
  const squash = player.grounded ? 1 + Math.abs(player.vx) * 0.0006 : 1.06;
  const runTilt = player.grounded ? Math.sin(player.walk * 1.4) * 3 : 0;
  const bob = player.grounded ? Math.sin(elapsed * 10) * 1.5 : 0;

  ctx.save();
  ctx.translate(x + player.w / 2, y + player.h / 2 + bob);
  ctx.scale(player.facing, 1);
  ctx.translate(-(x + player.w / 2), -(y + player.h / 2 + bob));

  const footY = y + 38 + step;
  roundedRect(x + 2, footY, 12, 8, 3, '#5b301f');
  roundedRect(x + 17, footY - step * 0.6, 12, 8, 3, '#5b301f');

  ctx.fillStyle = '#2477df';
  ctx.beginPath();
  ctx.roundRect(x + 5, y + 22, 21, 18 * squash, 4);
  ctx.fill();

  ctx.fillStyle = '#8fc6ff';
  ctx.fillRect(x + 9, y + 26, 4, 4);
  ctx.fillRect(x + 19, y + 26, 4, 4);

  roundedRect(x + 3, y + 17 + runTilt * 0.18, 25, 14, 5, '#ed453c');
  roundedRect(x + 7, y + 4, 19, 20, 6, '#ffd09a');
  ctx.fillStyle = '#e94c3e';
  ctx.fillRect(x + 4, y + 1, 23, 8);
  ctx.fillRect(x + 1, y + 8, 29, 5);

  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 19, y + 12, 5, 6);
  ctx.fillStyle = '#30252a';
  ctx.fillRect(x + 22, y + 14, 2, 4);
  ctx.fillStyle = '#a72c2e';
  ctx.fillRect(x + 14, y + 20, 7, 2);
  ctx.fillStyle = '#f7f0de';
  ctx.fillRect(x + 10, y + 4, 11, 3);

  ctx.restore();
}

function drawDecor() {
  // Tiny flowers add foreground color without hiding gameplay.
  for (let i = 0; i < 35; i += 1) {
    const x = i * 67 - cameraX;
    if (x < -10 || x > W + 10) continue;
    const onGround = platforms.some(p => p.y === GROUND_Y && x >= p.x && x <= p.x + p.w);
    if (!onGround) continue;
    ctx.fillStyle = '#fff'; ctx.fillRect(x, GROUND_Y - 7, 3, 3);
    ctx.fillStyle = '#ffdb4d'; ctx.fillRect(x + 1, GROUND_Y - 6, 2, 2);
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
