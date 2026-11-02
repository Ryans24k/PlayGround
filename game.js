const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreValue = document.getElementById('scoreValue');
const waveValue = document.getElementById('waveValue');
const healthFill = document.getElementById('healthFill');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const startButton = document.getElementById('startButton');
const fireButton = document.getElementById('fireButton');
const dpadButtons = [...document.querySelectorAll('[data-dir]')];

const W = canvas.width;
const H = canvas.height;
const UP = 'up';
const DOWN = 'down';
const LEFT = 'left';
const RIGHT = 'right';

const keys = new Set();
const activeTouchDirs = new Set();

const uiState = {
  score: 0,
  wave: 1,
  health: 100,
  shardsCollected: 0,
  winThreshold: 220,
};

let gameState = 'menu';
let lastTime = 0;
let spawnTimer = 0;
let waveDelay = 0;
let particles = [];
let projectiles = [];
let enemies = [];
let shards = [];
let stars = [];
let player = null;
let pulse = 0;

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resetGame() {
  uiState.score = 0;
  uiState.wave = 1;
  uiState.health = 100;
  uiState.shardsCollected = 0;
  particles = [];
  projectiles = [];
  enemies = [];
  shards = [];
  stars = [];

  player = {
    x: W / 2,
    y: H - 100,
    radius: 18,
    speed: 320,
    cooldown: 0,
    fireRate: 0.18,
    hitFlash: 0,
  };

  for (let i = 0; i < 120; i += 1) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 2.5 + 0.5,
      speed: Math.random() * 35 + 15,
      alpha: Math.random() * 0.8 + 0.2,
    });
  }

  spawnTimer = 0;
  waveDelay = 0;
  pulse = 0;
  updateHUD();
}

function updateHUD() {
  scoreValue.textContent = String(Math.floor(uiState.score));
  waveValue.textContent = String(uiState.wave);
  healthFill.style.width = `${clamp(uiState.health, 0, 100)}%`;
}

function showOverlay(title, text, buttonText = 'Start Run') {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startButton.textContent = buttonText;
  overlay.classList.add('visible');
}

function hideOverlay() {
  overlay.classList.remove('visible');
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  const radius = randomBetween(12, 24);

  if (side === 0) {
    x = randomBetween(0, W);
    y = -radius;
  } else if (side === 1) {
    x = W + radius;
    y = randomBetween(0, H);
  } else if (side === 2) {
    x = randomBetween(0, W);
    y = H + radius;
  } else {
    x = -radius;
    y = randomBetween(0, H);
  }

  const angle = Math.atan2(player.y - y, player.x - x);
  const speed = randomBetween(70 + uiState.wave * 10, 125 + uiState.wave * 15);

  enemies.push({
    x,
    y,
    radius,
    speed,
    angle,
    hp: 1 + Math.floor(uiState.wave / 4),
    drift: randomBetween(-1.2, 1.2),
    fireTimer: randomBetween(0.5, 1.5),
  });
}

function spawnShard() {
  const x = randomBetween(30, W - 30);
  const y = randomBetween(30, H - 30);
  shards.push({ x, y, radius: 9, value: 10, bob: Math.random() * Math.PI * 2 });
}

function createParticles(x, y, color, amount = 12) {
  for (let i = 0; i < amount; i += 1) {
    particles.push({
      x,
      y,
      vx: randomBetween(-120, 120),
      vy: randomBetween(-120, 120),
      r: randomBetween(1.5, 3.5),
      life: randomBetween(0.3, 0.8),
      color,
    });
  }
}

function shoot() {
  if (!player || gameState !== 'playing') return;
  if (player.cooldown > 0) return;

  const angle = Math.atan2((mouse.y || H / 2) - player.y, (mouse.x || W / 2) - player.x);
  const speed = 600;

  projectiles.push({
    x: player.x + Math.cos(angle) * 17,
    y: player.y + Math.sin(angle) * 17,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 4,
    life: 1.2,
    color: '#7ae7ff',
  });

  player.cooldown = player.fireRate;
  createParticles(player.x + Math.cos(angle) * 12, player.y + Math.sin(angle) * 12, '#7ae7ff', 5);
}

function handleInput(dt) {
  if (gameState !== 'playing' || !player) return;

  let dx = 0;
  let dy = 0;

  if (keys.has('ArrowLeft') || keys.has('a') || activeTouchDirs.has(LEFT)) dx -= 1;
  if (keys.has('ArrowRight') || keys.has('d') || activeTouchDirs.has(RIGHT)) dx += 1;
  if (keys.has('ArrowUp') || keys.has('w') || activeTouchDirs.has(UP)) dy -= 1;
  if (keys.has('ArrowDown') || keys.has('s') || activeTouchDirs.has(DOWN)) dy += 1;

  const length = Math.hypot(dx, dy) || 1;
  const moveX = (dx / length) * player.speed * dt;
  const moveY = (dy / length) * player.speed * dt;

  player.x = clamp(player.x + moveX, player.radius + 10, W - player.radius - 10);
  player.y = clamp(player.y + moveY, player.radius + 10, H - player.radius - 10);

  player.cooldown = Math.max(0, player.cooldown - dt);
  player.hitFlash = Math.max(0, player.hitFlash - dt);
}

function updateStars(dt) {
  for (const star of stars) {
    star.y += star.speed * dt;
    if (star.y > H) {
      star.y = -10;
      star.x = Math.random() * W;
    }
  }
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const p = projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;

    if (p.life <= 0 || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) {
      projectiles.splice(i, 1);
    }
  }
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    enemy.x += Math.cos(enemy.angle) * enemy.speed * dt;
    enemy.y += Math.sin(enemy.angle) * enemy.speed * dt;
    enemy.fireTimer -= dt;

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    enemy.angle = Math.atan2(dy, dx) + Math.sin((performance.now() / 600) + i) * 0.15;

    if (Math.hypot(dx, dy) < enemy.radius + player.radius + 8) {
      uiState.health -= 18;
      createParticles(enemy.x, enemy.y, '#ff5e7d', 18);
      enemies.splice(i, 1);
      if (uiState.health <= 0) {
        endRun(false, 'The swarm overwhelmed the starfighter.');
        return;
      }
      continue;
    }

    if (enemy.fireTimer <= 0) {
      const bulletAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      enemy.fireTimer = randomBetween(1.4, 2.4) - uiState.wave * 0.05;
      projectiles.push({
        x: enemy.x + Math.cos(bulletAngle) * (enemy.radius + 6),
        y: enemy.y + Math.sin(bulletAngle) * (enemy.radius + 6),
        vx: Math.cos(bulletAngle) * 260,
        vy: Math.sin(bulletAngle) * 260,
        radius: 5,
        life: 3,
        color: '#ff78c8',
        enemy: true,
      });
    }
  }
}

function updateCollectibles(dt) {
  for (let i = shards.length - 1; i >= 0; i -= 1) {
    const shard = shards[i];
    shard.bob += dt * 3;
    const dist = Math.hypot(player.x - shard.x, player.y - shard.y);
    if (dist < player.radius + shard.radius + 8) {
      uiState.score += shard.value;
      uiState.shardsCollected += 1;
      createParticles(shard.x, shard.y, '#7dfa9e', 18);
      shards.splice(i, 1);
      if (uiState.score >= uiState.winThreshold) {
        endRun(true, 'You collected enough energy and escaped the swarm.');
        return;
      }
      continue;
    }
  }

  if (uiState.shardsCollected > 0 && uiState.shardsCollected % 18 === 0 && shards.length < 4) {
    spawnShard();
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function updateWave(dt) {
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    const count = 1 + Math.min(5, Math.floor(uiState.wave / 2));
    for (let i = 0; i < count; i += 1) {
      spawnEnemy();
    }
    spawnTimer = Math.max(0.5, 1.8 - uiState.wave * 0.08);
  }

  waveDelay -= dt;
  if (waveDelay <= 0 && uiState.score > 0 && uiState.score >= uiState.wave * 40) {
    uiState.wave += 1;
    waveDelay = 8;
    spawnShard();
    createParticles(W / 2, 40, '#ffd36a', 25);
    for (let i = 0; i < 3; i += 1) {
      spawnShard();
    }
  }
}

function maybeSpawnInitialShardBurst() {
  if (shards.length > 0) return;
  const burst = 5 + uiState.wave;
  for (let i = 0; i < burst; i += 1) {
    spawnShard();
  }
}

function updateProjectilesCollision() {
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const shot = projectiles[i];
    if (shot.enemy) {
      const dist = Math.hypot(player.x - shot.x, player.y - shot.y);
      if (dist < player.radius + shot.radius + 4) {
        projectiles.splice(i, 1);
        uiState.health = clamp(uiState.health - 8, 0, 100);
        createParticles(player.x, player.y, '#ff5e7d', 10);
        if (uiState.health <= 0) {
          endRun(false, 'The fighter was struck down by enemy fire.');
          return;
        }
      }
      continue;
    }

    for (let j = enemies.length - 1; j >= 0; j -= 1) {
      const enemy = enemies[j];
      const dist = Math.hypot(enemy.x - shot.x, enemy.y - shot.y);
      if (dist < enemy.radius + shot.radius + 2) {
        projectiles.splice(i, 1);
        enemy.hp -= 1;
        createParticles(shot.x, shot.y, '#7ae7ff', 7);
        if (enemy.hp <= 0) {
          enemies.splice(j, 1);
          createParticles(enemy.x, enemy.y, '#9c80ff', 18);
          if (Math.random() < 0.32) spawnShard();
        }
        break;
      }
    }
  }
}

function endRun(win, message) {
  gameState = 'ended';
  const title = win ? 'Run Complete' : 'Mission Failed';
  showOverlay(title, `${message} Final energy: ${Math.floor(uiState.score)}.`, 'Restart');
}

function drawBackground() {
  ctx.fillStyle = '#050816';
  ctx.fillRect(0, 0, W, H);

  for (const star of stars) {
    ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }

  const gradient = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.8);
  gradient.addColorStop(0, 'rgba(113, 118, 255, 0.18)');
  gradient.addColorStop(1, 'rgba(10, 11, 22, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
}

function drawPlayer() {
  if (!player) return;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(Math.atan2((mouse.y || H / 2) - player.y, (mouse.x || W / 2) - player.x));

  ctx.shadowColor = player.hitFlash > 0 ? '#ff5e7d' : '#7ae7ff';
  ctx.shadowBlur = 18;
  ctx.fillStyle = player.hitFlash > 0 ? '#ff7ca5' : '#9fe7ff';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-12, -9);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, 9);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.fillRect(-16, -3, 8, 6);
  ctx.restore();
}

function drawEnemies() {
  for (const enemy of enemies) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.angle);
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ff78c8';
    ctx.fillStyle = '#ff78c8';
    ctx.beginPath();
    ctx.moveTo(enemy.radius, 0);
    ctx.lineTo(-enemy.radius, enemy.radius * 0.8);
    ctx.lineTo(-enemy.radius * 0.5, 0);
    ctx.lineTo(-enemy.radius, -enemy.radius * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawShards() {
  for (const shard of shards) {
    const y = shard.y + Math.sin(shard.bob) * 4;
    ctx.save();
    ctx.translate(shard.x, y);
    ctx.rotate(shard.bob);
    ctx.fillStyle = '#7dfa9e';
    ctx.shadowColor = '#7dfa9e';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 8);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawProjectiles() {
  for (const shot of projectiles) {
    ctx.beginPath();
    ctx.fillStyle = shot.color;
    ctx.shadowColor = shot.color;
    ctx.shadowBlur = 16;
    ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.fillStyle = `${p.color}${Math.floor((p.life / 0.8) * 255).toString(16).padStart(2, '0')}`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHudWarning() {
  if (gameState !== 'playing') return;
  const danger = uiState.health < 35;
  if (!danger) return;

  ctx.save();
  ctx.fillStyle = 'rgba(255, 100, 120, 0.18)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function render() {
  drawBackground();
  drawShards();
  drawProjectiles();
  drawEnemies();
  drawPlayer();
  drawParticles();
  drawHudWarning();
}

function tick(timestamp) {
  const dt = clamp((timestamp - lastTime) / 1000 || 0.016, 0.016, 0.033);
  lastTime = timestamp;

  if (gameState === 'playing') {
    pulse += dt;
    updateStars(dt);
    updateParticles(dt);
    handleInput(dt);
    maybeSpawnInitialShardBurst();
    updateWave(dt);
    updateProjectiles(dt);
    updateEnemies(dt);
    updateCollectibles(dt);
    updateProjectilesCollision();
    updateHUD();
  }

  render();
  requestAnimationFrame(tick);
}

function startGame() {
  resetGame();
  gameState = 'playing';
  hideOverlay();
}

const mouse = { x: W / 2, y: H / 2 };
window.addEventListener('pointermove', (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouse.x = (event.clientX - rect.left) * scaleX;
  mouse.y = (event.clientY - rect.top) * scaleY;
});

window.addEventListener('keydown', (event) => {
  const keyName = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys.add(keyName);
  if (event.key === ' ') {
    event.preventDefault();
    shoot();
  }
  if (event.key === 'Enter' && gameState !== 'playing') {
    startGame();
  }
});

window.addEventListener('keyup', (event) => {
  const keyName = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys.delete(keyName);
});

canvas.addEventListener('pointerdown', () => {
  if (gameState !== 'playing') return;
  shoot();
});

startButton.addEventListener('click', startGame);
fireButton.addEventListener('pointerdown', shoot);

for (const button of dpadButtons) {
  const dir = button.dataset.dir;
  const activate = (event) => {
    event.preventDefault();
    activeTouchDirs.add(dir);
    if (gameState !== 'playing') return;
    if (dir === RIGHT || dir === LEFT || dir === UP || dir === DOWN) {
      return;
    }
  };
  const deactivate = (event) => {
    event.preventDefault();
    activeTouchDirs.delete(dir);
  };
  button.addEventListener('pointerdown', activate);
  button.addEventListener('pointerup', deactivate);
  button.addEventListener('pointerleave', deactivate);
  button.addEventListener('pointercancel', deactivate);
}

resetGame();
showOverlay('Neon Drift', 'Pilot a starfighter through a swarm of hostile drones. Collect 220 energy from glowing shards to escape.', 'Start Run');
requestAnimationFrame(tick);
