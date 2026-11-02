const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const titleText = document.getElementById('title');
const messageText = document.getElementById('message');
const startButton = document.getElementById('startButton');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const waveEl = document.getElementById('wave');
const bestEl = document.getElementById('best');
const touchButtons = document.querySelectorAll('[data-control]');

const keys = { left: false, right: false, fire: false };
const mouse = { x: canvas.width / 2, active: false };

const state = {
  running: false,
  won: false,
  score: 0,
  lives: 5,
  wave: 1,
  best: Number(localStorage.getItem('starfall-best') || '0'),
  elapsed: 0,
  spawnTimer: 0,
  enemyQueue: 0,
  waveDelay: 0,
  player: {
    x: canvas.width / 2,
    y: canvas.height - 72,
    w: 26,
    h: 34,
    speed: 420,
    fireCooldown: 0,
    invulnerable: 0
  },
  bullets: [],
  enemies: [],
  particles: [],
  stars: [],
  lastTime: 0
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function setupStars() {
  state.stars = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2.6 + 1,
    speed: Math.random() * 40 + 18,
    alpha: Math.random() * 0.8 + 0.2
  }));
}

function resetPlayer() {
  state.player.x = canvas.width / 2;
  state.player.y = canvas.height - 72;
  state.player.fireCooldown = 0;
  state.player.invulnerable = 0;
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  livesEl.textContent = String(state.lives);
  waveEl.textContent = String(state.wave);
  bestEl.textContent = String(state.best);
}

function setOverlay(title, message, buttonLabel = 'Start Mission') {
  titleText.textContent = title;
  messageText.textContent = message;
  startButton.textContent = buttonLabel;
  overlay.classList.add('visible');
}

function hideOverlay() {
  overlay.classList.remove('visible');
}

function awardBest() {
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('starfall-best', String(state.best));
  }
}

function createBurst(x, y, color, count = 16) {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.75;
    const speed = Math.random() * 140 + 35;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.6 + Math.random() * 0.5,
      maxLife: 0.6 + Math.random() * 0.5,
      size: Math.random() * 4 + 2,
      color
    });
  }
}

function shoot() {
  const p = state.player;
  if (p.fireCooldown > 0 || !state.running) return;

  const bulletSpeed = 560;
  state.bullets.push({
    x: p.x,
    y: p.y - p.h / 2 - 8,
    radius: 5,
    vy: -bulletSpeed,
    color: '#7ce8ff'
  });

  p.fireCooldown = 0.22;
}

function spawnEnemy() {
  const sidePadding = 32;
  const x = sidePadding + Math.random() * (canvas.width - sidePadding * 2);
  const size = 18 + Math.random() * 14;
  const speed = 55 + state.wave * 18 + Math.random() * 25;
  const drift = (Math.random() - 0.5) * 80;

  state.enemies.push({
    x,
    y: -size,
    radius: size / 2,
    speed,
    drift,
    hp: 1 + Math.floor((state.wave - 1) / 3),
    value: 25 + state.wave * 10,
    color: state.wave % 2 === 0 ? '#ff7c70' : '#b699ff'
  });
}

function startWave() {
  state.enemyQueue = 6 + state.wave * 2;
  state.spawnTimer = 0.35;
  state.waveDelay = 0;
}

function resetGame() {
  state.running = true;
  state.won = false;
  state.score = 0;
  state.lives = 5;
  state.wave = 1;
  state.elapsed = 0;
  state.spawnTimer = 0.35;
  state.enemyQueue = 6;
  state.waveDelay = 0;
  state.bullets = [];
  state.enemies = [];
  state.particles = [];
  resetPlayer();
  updateHud();
  hideOverlay();
}

function endGame(win) {
  state.running = false;
  state.won = win;
  awardBest();
  updateHud();

  if (win) {
    setOverlay('Mission Complete!', `You survived all waves and scored ${state.score} points.`, 'Play Again');
  } else {
    setOverlay('Ship Down', `You reached wave ${state.wave} with ${state.score} points.`, 'Retry Mission');
  }
}

function takeDamage() {
  if (!state.running || state.player.invulnerable > 0) return;

  state.lives -= 1;
  state.player.invulnerable = 1.2;
  createBurst(state.player.x, state.player.y, '#ff8a8a', 28);

  if (state.lives <= 0) {
    state.lives = 0;
    updateHud();
    endGame(false);
  }
}

function handleCollisions() {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];

    for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
      const enemy = state.enemies[j];
      const dx = bullet.x - enemy.x;
      const dy = bullet.y - enemy.y;
      const distance = Math.hypot(dx, dy);

      if (distance < bullet.radius + enemy.radius) {
        bullet.hit = true;
        enemy.hp -= 1;
        createBurst(enemy.x, enemy.y, '#6ce9ff', 12);

        if (enemy.hp <= 0) {
          state.score += enemy.value;
          state.enemies.splice(j, 1);
          createBurst(enemy.x, enemy.y, enemy.color, 22);
        }
        break;
      }
    }

    if (bullet.hit) {
      state.bullets.splice(i, 1);
    }
  }

  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const distance = Math.hypot(dx, dy);

    if (distance < enemy.radius + 18) {
      state.enemies.splice(i, 1);
      takeDamage();
      createBurst(enemy.x, enemy.y, '#ff6d7f', 18);
    } else if (enemy.y - enemy.radius > canvas.height + 40) {
      state.enemies.splice(i, 1);
      takeDamage();
    }
  }

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('starfall-best', String(state.best));
  }
}

function update(dt) {
  if (!state.running) {
    return;
  }

  state.elapsed += dt;
  const p = state.player;

  if (keys.left) p.x -= p.speed * dt;
  if (keys.right) p.x += p.speed * dt;
  if (mouse.active) {
    p.x += (mouse.x - p.x) * 0.12;
  }

  p.x = clamp(p.x, 18, canvas.width - 18);
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);

  if (keys.fire || mouse.active) {
    shoot();
  }

  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    bullet.y += bullet.vy * dt;
    if (bullet.y < -24 || bullet.hit) {
      state.bullets.splice(i, 1);
    }
  }

  state.spawnTimer -= dt;
  if (state.enemyQueue > 0 && state.spawnTimer <= 0) {
    spawnEnemy();
    state.enemyQueue -= 1;
    state.spawnTimer = Math.max(0.28, 1.1 - state.wave * 0.07 - Math.random() * 0.2);
  }

  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    enemy.x += Math.sin((state.elapsed + i) * 3) * enemy.drift * dt;
    enemy.y += enemy.speed * dt;
    enemy.x = clamp(enemy.x, 18, canvas.width - 18);
  }

  state.particles = state.particles.filter((particle) => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
    return particle.life > 0;
  });

  handleCollisions();

  if (state.enemyQueue === 0 && state.enemies.length === 0) {
    if (state.waveDelay <= 0) {
      state.waveDelay = 1.4;
      state.wave += 1;
      updateHud();
      if (state.wave > 6) {
        endGame(true);
        return;
      }
      startWave();
    } else {
      state.waveDelay -= dt;
    }
  }

  updateHud();
}

function drawStars() {
  ctx.fillStyle = 'rgba(5, 10, 20, 0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const star of state.stars) {
    star.y += star.speed * (1 / 60);
    if (star.y > canvas.height) {
      star.y = -5;
      star.x = Math.random() * canvas.width;
    }

    ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
}

function drawPlayer() {
  const p = state.player;
  const blink = p.invulnerable > 0 && Math.floor(p.invulnerable * 12) % 2 === 0;
  if (blink) return;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = '#7af4ff';
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(12, 14);
  ctx.lineTo(0, 8);
  ctx.lineTo(-12, 14);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#dfeeff';
  ctx.fillRect(-3, 14, 6, 12);
  ctx.restore();
}

function drawBullets() {
  for (const bullet of state.bullets) {
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.moveTo(0, -enemy.radius);
    ctx.lineTo(enemy.radius, 0);
    ctx.lineTo(0, enemy.radius);
    ctx.lineTo(-enemy.radius, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(-2, -enemy.radius + 6, 4, 8);
    ctx.restore();
  }
}

function drawParticles() {
  for (const particle of state.particles) {
    const alpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
    if (/^#/.test(particle.color)) {
      ctx.fillStyle = particle.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
    }
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawStars();

  ctx.strokeStyle = 'rgba(110, 168, 255, 0.18)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawHudDetails() {
  if (!state.running) return;

  ctx.fillStyle = 'rgba(15, 20, 36, 0.4)';
  ctx.fillRect(18, 18, 180, 34);
  ctx.fillStyle = '#d7f7ff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`Wave ${state.wave}`, 28, 42);
}

function render() {
  drawBackground();
  drawPlayer();
  drawBullets();
  drawEnemies();
  drawParticles();
  drawHudDetails();
}

let lastFrame = 0;
function frame(timestamp) {
  const dt = Math.min(0.032, (timestamp - (lastFrame || timestamp)) / 1000 || 0.016);
  lastFrame = timestamp;

  update(dt);
  render();
  requestAnimationFrame(frame);
}

function startButtonHandler() {
  resetGame();
}

function setKeyState(code, isPressed) {
  switch (code) {
    case 'ArrowLeft':
    case 'KeyA':
      keys.left = isPressed;
      break;
    case 'ArrowRight':
    case 'KeyD':
      keys.right = isPressed;
      break;
    case 'Space':
      keys.fire = isPressed;
      if (isPressed) shoot();
      break;
    default:
      break;
  }
}

function bindInput() {
  document.addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'Space', 'KeyA', 'KeyD'].includes(event.code)) {
      event.preventDefault();
    }
    setKeyState(event.code, true);
  });

  document.addEventListener('keyup', (event) => {
    setKeyState(event.code, false);
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.active = true;
  });

  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.active = true;
    shoot();
  });

  canvas.addEventListener('pointerleave', () => {
    mouse.active = false;
  });

  touchButtons.forEach((button) => {
    const control = button.dataset.control;
    const press = () => {
      button.classList.add('active');
      if (control === 'left') keys.left = true;
      if (control === 'right') keys.right = true;
      if (control === 'fire') {
        keys.fire = true;
        shoot();
      }
    };
    const release = () => {
      button.classList.remove('active');
      if (control === 'left') keys.left = false;
      if (control === 'right') keys.right = false;
      if (control === 'fire') keys.fire = false;
    };

    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointerleave', release);
    button.addEventListener('pointercancel', release);
  });
}

function init() {
  setupStars();
  updateHud();
  bindInput();
  startButton.addEventListener('click', startButtonHandler);
  setOverlay('Starfall Defense', 'Use arrow keys or WASD to dodge! Fire with Space or the touch button.', 'Start Mission');
  render();
  requestAnimationFrame(frame);
}

init();
