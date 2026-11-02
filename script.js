const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const titleText = document.getElementById('title');
const messageText = document.getElementById('message');
const startButton = document.getElementById('startButton');
const scoreEl = document.getElementById('score');
const coinsEl = document.getElementById('coins');
const livesEl = document.getElementById('lives');
const bestEl = document.getElementById('best');

const W = canvas.width;
const H = canvas.height;
const WORLD_WIDTH = 4300;
const FLOOR_Y = 510;
const input = { left: false, right: false, jump: false, jumpQueued: false };
const bestKey = 'moonlit-mayhem-best';

const platforms = [
  { x: 0, y: FLOOR_Y, w: 1080, h: 90 },
  { x: 1220, y: FLOOR_Y, w: 800, h: 90 },
  { x: 2150, y: FLOOR_Y, w: 830, h: 90 },
  { x: 3100, y: FLOOR_Y, w: 1200, h: 90 },
  { x: 300, y: 405, w: 150, h: 24 },
  { x: 555, y: 330, w: 145, h: 24 },
  { x: 815, y: 405, w: 155, h: 24 },
  { x: 1280, y: 400, w: 160, h: 24 },
  { x: 1535, y: 325, w: 150, h: 24 },
  { x: 1790, y: 405, w: 145, h: 24 },
  { x: 2260, y: 390, w: 170, h: 24 },
  { x: 2515, y: 315, w: 160, h: 24 },
  { x: 2780, y: 395, w: 150, h: 24 },
  { x: 3220, y: 410, w: 160, h: 24 },
  { x: 3480, y: 335, w: 160, h: 24 },
  { x: 3750, y: 410, w: 160, h: 24 }
];

const coinSpots = [
  [225, 455], [350, 360], [430, 455], [600, 285], [675, 455], [850, 360], [1010, 455],
  [1135, 420], [1295, 350], [1380, 455], [1580, 280], [1700, 455], [1840, 355], [1975, 455],
  [2085, 430], [2290, 340], [2375, 455], [2560, 270], [2700, 455], [2820, 345], [2945, 455],
  [3030, 420], [3260, 360], [3380, 455], [3525, 290], [3650, 455], [3795, 360], [3940, 455], [4110, 455]
];
const enemySeeds = [
  { x: 470, min: 455, max: 740 }, { x: 940, min: 860, max: 1030 },
  { x: 1430, min: 1370, max: 1950 }, { x: 2320, min: 2220, max: 2460 },
  { x: 2860, min: 2780, max: 2940 }, { x: 3330, min: 3180, max: 3430 },
  { x: 3870, min: 3790, max: 4070 }
];
const graveSeeds = [
  { x: 625, platformX: 555 },
  { x: 1610, platformX: 1535 },
  { x: 2595, platformX: 2515 },
  { x: 3560, platformX: 3480 }
];

const state = {
  running: false,
  score: 0,
  coins: 0,
  lives: 3,
  best: Number(localStorage.getItem(bestKey) || 0),
  camera: 0,
  time: 0,
  particles: [],
  hero: { x: 72, y: FLOOR_Y - 42, w: 30, h: 42, growth: 1, vx: 0, vy: 0, facing: 1, grounded: false, jumpsUsed: 0, invuln: 0, checkpoint: 72 },
  coinsOnMap: [],
  enemies: [],
  graves: [],
  smokeClouds: []
};

function resetLevel() {
  input.jump = false;
  input.jumpQueued = false;
  state.hero = { x: 72, y: FLOOR_Y - 42, w: 30, h: 42, growth: 1, vx: 0, vy: 0, facing: 1, grounded: false, jumpsUsed: 0, invuln: 0, checkpoint: 72 };
  state.coinsOnMap = coinSpots.map(([x, y]) => ({ x, y, taken: false, bob: Math.random() * Math.PI * 2 }));
  state.enemies = enemySeeds.map((e, i) => ({ ...e, y: FLOOR_Y - 29, w: 34, h: 29, dir: i % 2 ? -1 : 1, alive: true, phase: Math.random() * 3 }));
  state.graves = graveSeeds.map((grave) => ({ ...grave, triggered: false, zombieTime: 0, powerup: null }));
  state.smokeClouds = [];
  state.particles = [];
  state.camera = 0;
  state.time = 0;
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  coinsEl.textContent = String(state.coins);
  livesEl.textContent = String(state.lives);
  bestEl.textContent = String(state.best);
}

function overlayShow(title, message, button) {
  titleText.textContent = title;
  messageText.textContent = message;
  startButton.textContent = button;
  overlay.classList.add('visible');
}
function startGame() {
  state.score = 0;
  state.coins = 0;
  state.lives = 3;
  resetLevel();
  state.running = true;
  overlay.classList.remove('visible');
  updateHud();
}
function endGame(won) {
  state.running = false;
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(bestKey, String(state.best));
  }
  updateHud();
  if (won) overlayShow('You escaped the fog!', `The haunted valley fades behind you. You collected ${state.coins} moon coins and scored ${state.score}.`, 'Play Again');
  else overlayShow('The woods claimed you', `You scored ${state.score}. The spirits will be waiting for your next midnight run.`, 'Try Again');
}

function burst(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 45 + Math.random() * 150;
    state.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .45 + Math.random() * .45, color, size: 3 + Math.random() * 4 });
  }
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function triggerGrave(grave) {
  if (grave.triggered) return;
  grave.triggered = true;
  grave.zombieTime = 0.001;
  burst(grave.x, platforms.find((platform) => platform.x === grave.platformX).y, '#b8d7a1', 9);
}

function hurt() {
  const h = state.hero;
  if (h.invuln > 0) return;
  burst(h.x + h.w / 2, h.y + h.h / 2, '#fff0bd', 18);
  if (h.growth > 1) {
    // The growth potion absorbs one hit: shrink in place instead of losing a life and respawning.
    const feet = h.y + h.h;
    const center = h.x + h.w / 2;
    h.growth = 1;
    h.w = 30;
    h.h = 42;
    h.x = center - h.w / 2;
    h.y = feet - h.h;
    h.vx = 0;
    h.vy = -260;
    h.grounded = false;
    h.jumpsUsed = 1;
    h.invuln = 1.7;
    return;
  }
  state.lives -= 1;
  if (state.lives <= 0) {
    state.lives = 0;
    updateHud();
    endGame(false);
    return;
  }
  h.x = h.checkpoint;
  h.y = FLOOR_Y - h.h - 2;
  h.vx = 0;
  h.vy = 0;
  h.grounded = false;
  h.jumpsUsed = 0;
  h.invuln = 1.7;
  state.camera = Math.max(0, h.x - 280);
}

function releaseSmokeClouds() {
  const h = state.hero;
  const x = h.x + h.w / 2 + h.facing * 16;
  const y = h.y + h.h / 2;
  for (const spread of [-115, 0, 115]) {
    state.smokeClouds.push({ x, y, vx: h.facing * 340, vy: spread, life: 1.1, radius: 34 });
  }
}

function updateSmokeClouds(dt) {
  for (const cloud of state.smokeClouds) {
    cloud.x += cloud.vx * dt;
    cloud.y += cloud.vy * dt;
    cloud.life -= dt;
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.x + enemy.w / 2 - cloud.x;
      const dy = enemy.y + enemy.h / 2 - cloud.y;
      if (dx * dx + dy * dy > (cloud.radius + 16) ** 2) continue;
      enemy.alive = false;
      state.coinsOnMap.push({ x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h / 2, taken: false, bob: Math.random() * Math.PI * 2 });
      burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, '#c6c8d8', 8);
    }
  }
  state.smokeClouds = state.smokeClouds.filter((cloud) => cloud.life > 0);
}

function update(dt) {
  if (!state.running) return;
  state.time += dt;
  const h = state.hero;
  const previousBottom = h.y + h.h;
  const previousTop = h.y;

  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (direction) {
    h.vx = direction * 270;
    h.facing = direction;
  } else {
    h.vx *= Math.pow(.001, dt);
  }
  if (input.jumpQueued) {
    if (h.grounded || h.jumpsUsed < 2) {
      h.vy = -610;
      h.grounded = false;
      h.jumpsUsed += 1;
    }
    input.jumpQueued = false;
  }
  if (!input.jump && h.vy < -185) h.vy = -185;

  h.x += h.vx * dt;
  for (const p of platforms) {
    if (!overlaps(h, p)) continue;
    if (h.vx > 0) h.x = p.x - h.w;
    else if (h.vx < 0) h.x = p.x + p.w;
    h.vx = 0;
  }
  h.x = Math.max(0, Math.min(WORLD_WIDTH - h.w, h.x));

  h.vy += 1550 * dt;
  h.y += h.vy * dt;
  h.grounded = false;
  for (const p of platforms) {
    if (h.x + h.w <= p.x || h.x >= p.x + p.w) continue;
    if (h.vy >= 0 && previousBottom <= p.y + 4 && h.y + h.h >= p.y) {
      h.y = p.y - h.h;
      h.vy = 0;
      h.grounded = true;
      h.jumpsUsed = 0;
    } else if (h.vy < 0 && previousTop >= p.y + p.h && h.y <= p.y + p.h) {
      h.y = p.y + p.h;
      h.vy = 20;
      for (const grave of state.graves) {
        if (grave.platformX === p.x && h.x + h.w > grave.x - 19 && h.x < grave.x + 19) triggerGrave(grave);
      }
    }
  }

  for (const grave of state.graves) {
    if (!grave.triggered) continue;
    grave.zombieTime += dt;
    const platform = platforms.find((item) => item.x === grave.platformX);
    if (!grave.powerup && grave.zombieTime >= .72) {
      grave.powerup = { x: grave.x, y: platform.y - 24, collected: false, bob: Math.random() * Math.PI * 2 };
    }
    if (grave.powerup && !grave.powerup.collected) {
      const powerup = grave.powerup;
      const py = powerup.y + Math.sin(state.time * 4 + powerup.bob) * 3;
      if (h.x + h.w > powerup.x - 13 && h.x < powerup.x + 13 && h.y + h.h > py - 15 && h.y < py + 15) {
        powerup.collected = true;
        if (h.growth === 1) {
          h.x -= 2;
          h.y -= 6;
          h.w = 34;
          h.h = 48;
          h.growth = 1.14;
        } else {
          releaseSmokeClouds();
        }
        state.score += 300;
        burst(powerup.x, py, '#c7ff9a', 18);
      }
    }
  }

  if (h.x > 1190 && h.checkpoint < 1220) h.checkpoint = 1240;
  if (h.x > 3030 && h.checkpoint < 3100) h.checkpoint = 3120;
  if (h.y > H + 100) hurt();
  h.invuln = Math.max(0, h.invuln - dt);

  for (const coin of state.coinsOnMap) {
    if (coin.taken) continue;
    const cy = coin.y + Math.sin(state.time * 4 + coin.bob) * 4;
    if (h.x + h.w > coin.x - 12 && h.x < coin.x + 12 && h.y + h.h > cy - 14 && h.y < cy + 14) {
      coin.taken = true;
      state.coins += 1;
      state.score += 100;
      burst(coin.x, cy, '#ffe36b', 8);
    }
  }

  for (const e of state.enemies) {
    if (!e.alive) continue;
    e.x += e.dir * 62 * dt;
    if (e.x < e.min || e.x + e.w > e.max) e.dir *= -1;
    e.y = FLOOR_Y - e.h + Math.sin(state.time * 5 + e.phase) * 2;
    if (overlaps(h, e)) {
      if (h.vy > 80 && previousBottom <= e.y + 13) {
        e.alive = false;
        h.vy = -360;
        state.score += 200;
        burst(e.x + e.w / 2, e.y + e.h / 2, '#ffb17a', 14);
      } else {
        hurt();
      }
    }
  }

  updateSmokeClouds(dt);

  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 300 * dt;
    p.life -= dt;
  }
  state.particles = state.particles.filter(p => p.life > 0);
  state.camera += (Math.max(0, Math.min(WORLD_WIDTH - W, h.x - W * .35)) - state.camera) * Math.min(1, dt * 5);
  if (h.x > 4130) endGame(true);
  updateHud();
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, '#11152f');
  gradient.addColorStop(.62, '#302747');
  gradient.addColorStop(1, '#65536b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // Cold moonlight and a slow drift of stars.
  ctx.fillStyle = 'rgba(177, 201, 255, .12)';
  ctx.beginPath(); ctx.arc(790, 105, 66, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e5e9ff';
  ctx.beginPath(); ctx.arc(790, 105, 43, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b7bddc';
  ctx.beginPath(); ctx.arc(805, 92, 7, 0, Math.PI * 2); ctx.arc(776, 117, 5, 0, Math.PI * 2); ctx.arc(804, 124, 4, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 42; i++) {
    const x = (i * 137 + 41) % W;
    const y = 24 + ((i * 71) % 260);
    const twinkle = .35 + (Math.sin(state.time * 2 + i) + 1) * .3;
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = i % 4 === 0 ? '#d9c4ff' : '#e5e9ff';
    ctx.fillRect(x, y, i % 5 === 0 ? 3 : 2, i % 5 === 0 ? 3 : 2);
  }
  ctx.globalAlpha = 1;

  // Jagged hills and a distant haunted keep.
  for (let i = 0; i < 8; i++) {
    const x = i * 170 - (state.camera * .2 % 170) - 40;
    const y = 385 + (i % 3) * 26;
    ctx.fillStyle = i % 2 ? '#25243d' : '#30283f';
    ctx.beginPath(); ctx.moveTo(x - 120, y); ctx.lineTo(x - 55, y - 75); ctx.lineTo(x - 12, y - 24); ctx.lineTo(x + 35, y - 112); ctx.lineTo(x + 95, y - 18); ctx.lineTo(x + 150, y - 70); ctx.lineTo(x + 210, y); ctx.closePath(); ctx.fill();
  }
  const castleX = 570 - state.camera * .16;
  ctx.fillStyle = '#1c1c32';
  ctx.fillRect(castleX, 244, 132, 150);
  ctx.fillRect(castleX - 18, 281, 35, 113);
  ctx.fillRect(castleX + 115, 264, 35, 130);
  ctx.beginPath();
  ctx.moveTo(castleX - 24, 281); ctx.lineTo(castleX, 239); ctx.lineTo(castleX + 6, 281);
  ctx.moveTo(castleX + 108, 264); ctx.lineTo(castleX + 132, 222); ctx.lineTo(castleX + 157, 264);
  ctx.moveTo(castleX + 12, 245); ctx.lineTo(castleX + 33, 203); ctx.lineTo(castleX + 54, 245);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d5a4ff';
  ctx.fillRect(castleX + 31, 275, 8, 15); ctx.fillRect(castleX + 91, 275, 8, 15); ctx.fillRect(castleX + 6, 307, 7, 13); ctx.fillRect(castleX + 128, 293, 7, 13);

  // Wisps of ground fog drift in front of the hills.
  for (let i = 0; i < 7; i++) {
    const x = ((i * 223 - state.camera * .35 + state.time * 9) % (W + 260) + W + 260) % (W + 260) - 120;
    const y = 425 + (i % 3) * 20;
    ctx.fillStyle = 'rgba(180, 191, 226, .12)';
    ctx.beginPath(); ctx.ellipse(x, y, 67, 13, 0, 0, Math.PI * 2); ctx.ellipse(x + 33, y - 8, 44, 14, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPlatforms() {
  const tileW = 32;
  const tileH = 22;
  for (const p of platforms) {
    const sx = p.x - state.camera;
    if (sx + p.w < -20 || sx > W + 20) continue;

    const grassH = p.y === FLOOR_Y ? 12 : 8;
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, p.y, p.w, p.h);
    ctx.clip();

    // Chunky soil blocks, staggered like old-school platformer bricks.
    ctx.fillStyle = '#30252c';
    ctx.fillRect(sx, p.y, p.w, p.h);
    const firstRow = p.y + grassH;
    const firstTileX = Math.floor(p.x / tileW) * tileW;
    for (let rowY = firstRow, row = 0; rowY < p.y + p.h; rowY += tileH, row++) {
      const stagger = row % 2 ? tileW / 2 : 0;
      for (let worldX = firstTileX - tileW + stagger; worldX < p.x + p.w; worldX += tileW) {
        const tileX = worldX - state.camera;
        const variation = (Math.floor(worldX / tileW) + row * 3) % 3;
        ctx.fillStyle = ['#594039', '#63463a', '#503a37'][((variation % 3) + 3) % 3];
        ctx.fillRect(tileX + 1, rowY + 1, tileW - 2, tileH - 2);
        ctx.strokeStyle = '#30252c';
        ctx.lineWidth = 2;
        ctx.strokeRect(tileX + 1, rowY + 1, tileW - 2, tileH - 2);
        ctx.fillStyle = 'rgba(221, 158, 105, .2)';
        ctx.fillRect(tileX + 4, rowY + 3, tileW - 9, 2);
        ctx.fillStyle = 'rgba(24, 21, 31, .3)';
        ctx.fillRect(tileX + tileW - 6, rowY + 5, 2, tileH - 9);
      }
    }

    // A soft mossy cap with little squared-off tufts.
    ctx.fillStyle = '#52613f';
    ctx.fillRect(sx, p.y + 3, p.w, grassH - 3);
    ctx.fillStyle = '#89945a';
    ctx.fillRect(sx, p.y + 2, p.w, 3);
    ctx.fillStyle = '#b0aa68';
    ctx.fillRect(sx, p.y, p.w, 2);
    ctx.fillStyle = '#71834b';
    for (let worldX = Math.floor(p.x / 24) * 24; worldX < p.x + p.w; worldX += 24) {
      const grassX = worldX - state.camera + ((Math.floor(worldX / 24) % 2) * 5);
      ctx.fillRect(grassX, p.y, 3, 4);
      ctx.fillRect(grassX + 4, p.y + 1, 3, 3);
    }
    ctx.restore();
  }
}

function drawGrave(grave) {
  const platform = platforms.find((item) => item.x === grave.platformX);
  const x = grave.x - state.camera;
  if (x < -40 || x > W + 40) return;
  const y = platform.y;
  ctx.fillStyle = '#363747';
  ctx.beginPath();
  ctx.moveTo(x - 15, y - 2);
  ctx.lineTo(x - 15, y - 23);
  ctx.quadraticCurveTo(x - 15, y - 31, x - 7, y - 31);
  ctx.lineTo(x + 7, y - 31);
  ctx.quadraticCurveTo(x + 15, y - 31, x + 15, y - 23);
  ctx.lineTo(x + 15, y - 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#77798a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#a8a9b5';
  ctx.fillRect(x - 2, y - 25, 4, 15);
  ctx.fillRect(x - 7, y - 20, 14, 4);
  ctx.fillStyle = '#202434';
  ctx.fillRect(x - 19, y - 3, 38, 4);
}

function drawGraveRewards() {
  for (const grave of state.graves) {
    const platform = platforms.find((item) => item.x === grave.platformX);
    const x = grave.x - state.camera;
    if (grave.triggered && grave.zombieTime < .95 && x > -45 && x < W + 45) {
      const rise = Math.min(1, grave.zombieTime / .42);
      const zombieY = platform.y - rise * 34;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - grave.zombieTime / .95) * 2.5);
      ctx.fillStyle = '#78936d';
      ctx.beginPath(); ctx.arc(x, zombieY - 12, 10, Math.PI, 0); ctx.fill();
      ctx.fillRect(x - 10, zombieY - 12, 20, 17);
      ctx.fillStyle = '#d8e6ba';
      ctx.fillRect(x - 7, zombieY - 15, 4, 4); ctx.fillRect(x + 3, zombieY - 15, 4, 4);
      ctx.fillStyle = '#303d35';
      ctx.fillRect(x - 6, zombieY - 14, 2, 2); ctx.fillRect(x + 4, zombieY - 14, 2, 2);
      ctx.fillStyle = '#b7c894';
      ctx.fillRect(x - 13, zombieY + 2, 8, 4); ctx.fillRect(x + 5, zombieY + 2, 8, 4);
      if (grave.zombieTime > .4) {
        ctx.fillStyle = '#c9ff91';
        ctx.beginPath(); ctx.arc(x + 17, zombieY - 7, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f2ffd7';
        ctx.beginPath(); ctx.arc(x + 15, zombieY - 9, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    const powerup = grave.powerup;
    if (!powerup || powerup.collected || x < -30 || x > W + 30) continue;
    const y = powerup.y + Math.sin(state.time * 4 + powerup.bob) * 3;
    ctx.fillStyle = 'rgba(177, 255, 123, .2)';
    ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9bdf72';
    ctx.beginPath(); ctx.moveTo(x - 8, y - 9); ctx.lineTo(x + 8, y - 9); ctx.lineTo(x + 6, y + 8); ctx.quadraticCurveTo(x, y + 13, x - 6, y + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e9ffd0';
    ctx.fillRect(x - 5, y - 12, 10, 4);
    ctx.fillStyle = '#f1a4ff';
    ctx.fillRect(x - 5, y - 2, 10, 5);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 3, y - 7, 2, 4);
  }
}

function drawCoin(coin) {
  const x = coin.x - state.camera;
  if (x < -30 || x > W + 30 || coin.taken) return;
  const y = coin.y + Math.sin(state.time * 4 + coin.bob) * 4;
  ctx.fillStyle = '#9b7cff'; ctx.beginPath(); ctx.ellipse(x, y, 10, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e7dcff'; ctx.beginPath(); ctx.ellipse(x - 2, y - 2, 6, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a98bff'; ctx.fillRect(x - 1, y - 5, 2, 10);
}

function drawEnemy(e) {
  if (!e.alive) return;
  const x = e.x - state.camera;
  if (x < -50 || x > W + 50) return;
  const bob = Math.sin(state.time * 8 + e.phase) * 2;
  ctx.fillStyle = '#a9dbeb';
  ctx.beginPath(); ctx.moveTo(x + 2, e.y + 26 + bob); ctx.lineTo(x + 3, e.y + 13 + bob); ctx.quadraticCurveTo(x + 17, e.y - 2 + bob, x + 31, e.y + 13 + bob); ctx.lineTo(x + 32, e.y + 27 + bob); ctx.lineTo(x + 24, e.y + 22 + bob); ctx.lineTo(x + 17, e.y + 29 + bob); ctx.lineTo(x + 9, e.y + 23 + bob); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f6f1ff'; ctx.fillRect(x + 5, e.y + 13 + bob, 24, 12);
  ctx.fillStyle = '#fff'; ctx.fillRect(x + 8, e.y + 10 + bob, 7, 9); ctx.fillRect(x + 20, e.y + 10 + bob, 7, 9);
  ctx.fillStyle = '#8b4fff'; ctx.fillRect(x + 11, e.y + 13 + bob, 3, 5); ctx.fillRect(x + 23, e.y + 13 + bob, 3, 5);
}

function drawHero() {
  const h = state.hero;
  if (h.invuln > 0 && Math.floor(state.time * 14) % 2 === 0) return;
  const x = h.x - state.camera;
  const running = Math.abs(h.vx) > 20 && h.grounded;
  const leg = running ? Math.sin(state.time * 18) * 4 : 0;
  const batWing = Math.sin(state.time * 14) * 5;
  const batX = x - 18 + (h.facing < 0 ? 12 : -4) + Math.sin(state.time * 6) * 6;
  const batY = h.y - 18 + Math.sin(state.time * 8) * 4;

  ctx.save();
  ctx.translate(batX, batY);
  ctx.fillStyle = '#141822';
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.quadraticCurveTo(-18, -8, -22, -4);
  ctx.quadraticCurveTo(-10, 2, -9, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.quadraticCurveTo(18, -8, 22, -4);
  ctx.quadraticCurveTo(10, 2, 9, 0);
  ctx.fill();
  ctx.fillStyle = '#2d2d3a';
  ctx.fillRect(-4, -2, 8, 6);
  ctx.fillStyle = '#dfe5ff';
  ctx.fillRect(-2, -1, 2, 2); ctx.fillRect(2, -1, 2, 2);
  ctx.fillStyle = '#d8b7ff';
  ctx.fillRect(-1, 6, 2, 2);
  ctx.restore();

  ctx.save();
  ctx.translate(x + h.w / 2, h.y);
  ctx.scale(h.growth, h.growth);
  if (h.facing < 0) ctx.scale(-1, 1);
  // Tiny vampire hero: sweeping cape, high collar, widow's peak, and fangs.
  ctx.fillStyle = '#541f47';
  ctx.beginPath(); ctx.moveTo(-10, 9); ctx.lineTo(-18, 17); ctx.lineTo(-15, 37 + leg); ctx.lineTo(-6, 32); ctx.lineTo(1, 39 - leg); ctx.lineTo(13, 31); ctx.lineTo(11, 10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#a82f5c';
  ctx.beginPath(); ctx.moveTo(-12, 14); ctx.lineTo(-16, 34 + leg); ctx.lineTo(-8, 30); ctx.lineTo(0, 36 - leg); ctx.lineTo(8, 29); ctx.lineTo(8, 14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#17172d'; ctx.fillRect(-13, 34 + leg, 11, 8); ctx.fillRect(3, 34 - leg, 11, 8);
  ctx.fillStyle = '#27233d'; ctx.fillRect(-12, 20, 24, 16);
  ctx.fillStyle = '#f3edff'; ctx.beginPath(); ctx.moveTo(-5, 18); ctx.lineTo(0, 27); ctx.lineTo(5, 18); ctx.lineTo(2, 31); ctx.lineTo(-2, 31); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#dc294f'; ctx.fillRect(-3, 23, 6, 5);
  ctx.fillStyle = '#e9d8ed'; ctx.fillRect(-14, 18, 5, 12); ctx.fillRect(9, 18, 5, 12);
  ctx.fillStyle = '#f0d8c8'; ctx.fillRect(-10, 7, 20, 17);
  ctx.fillStyle = '#191727';
  ctx.fillRect(-11, 5, 22, 7); ctx.fillRect(-9, 2, 5, 9); ctx.fillRect(4, 2, 5, 9);
  ctx.fillRect(-3, 9, 3, 4); ctx.fillRect(-8, 10, 3, 2); ctx.fillRect(4, 10, 3, 2);
  ctx.fillStyle = '#f34e70'; ctx.fillRect(-7, 13, 3, 3); ctx.fillRect(4, 13, 3, 3);
  ctx.fillStyle = '#23192c'; ctx.fillRect(-1, 17, 7, 2);
  ctx.fillStyle = '#fff5f2'; ctx.beginPath(); ctx.moveTo(0, 17); ctx.lineTo(2, 22); ctx.lineTo(4, 17); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawSmokeClouds() {
  for (const cloud of state.smokeClouds) {
    const x = cloud.x - state.camera;
    if (x < -80 || x > W + 80) continue;
    const age = 1.1 - cloud.life;
    const puff = cloud.radius * (.72 + Math.min(.38, age));
    ctx.save();
    ctx.globalAlpha = Math.min(.72, cloud.life * 1.4);
    ctx.fillStyle = '#b7b9ca';
    ctx.beginPath();
    ctx.arc(x, cloud.y, puff * .58, 0, Math.PI * 2);
    ctx.arc(x - puff * .48, cloud.y + 3, puff * .4, 0, Math.PI * 2);
    ctx.arc(x + puff * .47, cloud.y - 2, puff * .43, 0, Math.PI * 2);
    ctx.arc(x, cloud.y - puff * .38, puff * .42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawGoal() {
  const x = 4180 - state.camera;
  ctx.fillStyle = '#25243a';
  ctx.fillRect(x, 300, 13, FLOOR_Y - 300);
  ctx.fillRect(x + 92, 300, 13, FLOOR_Y - 300);
  ctx.fillRect(x - 9, 285, 123, 17);
  ctx.fillStyle = '#77728c';
  ctx.fillRect(x - 12, 280, 129, 8);
  ctx.fillStyle = '#20192c';
  ctx.fillRect(x + 18, 322, 58, FLOOR_Y - 322);
  ctx.fillStyle = '#d7bcff';
  ctx.beginPath(); ctx.arc(x + 47, 352, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#756c85';
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 23 + i * 18, 386, 4, 40);
  ctx.fillStyle = '#cf416d';
  ctx.beginPath(); ctx.moveTo(x + 53, 300); ctx.lineTo(x + 96, 317); ctx.lineTo(x + 53, 334); ctx.closePath(); ctx.fill();
}

function render() {
  drawSky();
  drawPlatforms();
  for (const grave of state.graves) drawGrave(grave);
  for (const coin of state.coinsOnMap) drawCoin(coin);
  drawGraveRewards();
  drawGoal();
  for (const enemy of state.enemies) drawEnemy(enemy);
  drawSmokeClouds();
  for (const p of state.particles) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = p.color; ctx.fillRect(p.x - state.camera, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  drawHero();
  // Progress ribbon makes the destination easy to spot.
  ctx.fillStyle = 'rgba(9, 8, 24, .58)'; ctx.fillRect(20, 18, 180, 8);
  ctx.fillStyle = '#c9a1ff'; ctx.fillRect(20, 18, 180 * Math.min(1, state.hero.x / 4180), 8);
}

let lastFrame = 0;
function frame(now) {
  const dt = Math.min(.033, (now - (lastFrame || now)) / 1000 || .016);
  lastFrame = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function setControl(control, pressed) {
  if (control === 'jump' && pressed && !input.jump) input.jumpQueued = true;
  input[control] = pressed;
}

function setInput(code, pressed) {
  if (['ArrowLeft', 'KeyA'].includes(code)) setControl('left', pressed);
  if (['ArrowRight', 'KeyD'].includes(code)) setControl('right', pressed);
  if (['Space', 'ArrowUp', 'KeyW'].includes(code)) setControl('jump', pressed);
}

document.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(event.code)) event.preventDefault();
  setInput(event.code, true);
});
document.addEventListener('keyup', (event) => setInput(event.code, false));
window.addEventListener('blur', () => {
  input.left = input.right = input.jump = false;
  input.jumpQueued = false;
});

for (const button of document.querySelectorAll('[data-control]')) {
  const control = button.dataset.control;
  const press = (event) => {
    event.preventDefault();
    button.classList.add('active');
    setControl(control, true);
    if (button.setPointerCapture && event.pointerId !== undefined) button.setPointerCapture(event.pointerId);
  };
  const release = () => { button.classList.remove('active'); setControl(control, false); };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}
startButton.addEventListener('click', startGame);
resetLevel();
updateHud();
overlayShow('Moonlit Mayhem', 'Sneak through the haunted valley, grab moon coins, and reach the final gate before the spirits catch you.', 'Start the Run');
render();
requestAnimationFrame(frame);
