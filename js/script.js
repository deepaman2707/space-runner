const GAME_HEIGHT = 540;
const GROUND_HEIGHT = 90;

const game = document.getElementById("game");
const player = document.getElementById("player");
const playerImg = document.getElementById("playerImg");
const previewImg = document.getElementById("previewImg");
const previewPlaceholder = document.getElementById("previewPlaceholder");
const photoInput = document.getElementById("photoInput");

const scoreEl = document.getElementById("score");
const coinsEl = document.getElementById("coins");
const livesEl = document.getElementById("lives");
const highScoreEl = document.getElementById("highScore");
const levelEl = document.getElementById("level");
const timeEl = document.getElementById("time");
const shieldStatusEl = document.getElementById("shieldStatus");

const gameOverEl = document.getElementById("gameOver");
const gameOverText = document.getElementById("gameOverText");
const startMessageEl = document.getElementById("startMessage");
const pauseScreen = document.getElementById("pauseScreen");
const setupPanel = document.getElementById("setupPanel");
const bossAlert = document.getElementById("bossAlert");

const playerNameInput = document.getElementById("playerNameInput");
const playerNameDisplay = document.getElementById("playerNameDisplay");
const leaderboardList = document.getElementById("leaderboardList");

const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const resumeBtn = document.getElementById("resumeBtn");
const jumpBtn = document.getElementById("jumpBtn");
const shootBtn = document.getElementById("shootBtn");
const musicToggleBtn = document.getElementById("musicToggleBtn");
const pauseBtn = document.getElementById("pauseBtn");

let playerName = "Player";
let playerPhotoData = "";
let setupDone = false;

let gameStarted = false;
let gameEnded = false;
let paused = false;
let isJumping = false;
let shieldActive = false;

let velocityY = 0;
let gravity = 0.82;
let playerBottom = GROUND_HEIGHT;

let score = 0;
let coins = 0;
let lives = 3;
let level = 1;
let elapsedTime = 0;

let highScore = Number(localStorage.getItem("spaceRunnerZipHighScore")) || 0;
highScoreEl.textContent = highScore;

let obstacleSpeed = 6;
let obstacleSpawnRate = 1500;
let coinSpawnRate = 2200;
let powerupSpawnRate = 9000;

let obstacles = [];
let coinsItems = [];
let powerups = [];
let bullets = [];
let bossBullets = [];

let boss = null;
let bossMode = false;
let bossHealth = 12;

let lastTime = 0;
let lastObstacleSpawn = 0;
let lastCoinSpawn = 0;
let lastPowerupSpawn = 0;
let lastBossShot = 0;
let scoreTimer = 0;
let levelTimer = 0;

let audioCtx = null;
let musicOn = false;
let musicInterval = null;

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function beep(freq, duration, type = "sine", volume = 0.03) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function jumpSound() {
  ensureAudio();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(350, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(620, audioCtx.currentTime + 0.12);
  gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
}

function coinSound() {
  ensureAudio();
  beep(880, 0.08, "square", 0.04);
  setTimeout(() => beep(1180, 0.08, "square", 0.03), 50);
}

function powerSound() {
  ensureAudio();
  beep(420, 0.12, "sine", 0.04);
  setTimeout(() => beep(620, 0.12, "sine", 0.04), 60);
  setTimeout(() => beep(820, 0.14, "sine", 0.04), 120);
}

function shootSound() {
  ensureAudio();
  beep(740, 0.08, "sawtooth", 0.035);
}

function hitSound() {
  ensureAudio();
  beep(120, 0.18, "sawtooth", 0.05);
}

function bossHitSound() {
  ensureAudio();
  beep(180, 0.1, "square", 0.04);
  setTimeout(() => beep(140, 0.12, "square", 0.04), 50);
}

function startMusic() {
  ensureAudio();
  if (musicInterval) clearInterval(musicInterval);
  const notes = [220, 262, 294, 330, 294, 262, 349, 330];
  let i = 0;
  musicInterval = setInterval(() => {
    if (!musicOn || paused || gameEnded || !audioCtx) return;
    beep(notes[i % notes.length], 0.18, "sine", 0.018);
    i++;
  }, 320);
}

function stopMusic() {
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
}

function toggleMusic() {
  ensureAudio();
  musicOn = !musicOn;
  musicToggleBtn.textContent = musicOn ? "Music: On" : "Music: Off";
  if (musicOn) startMusic();
  else stopMusic();
}

photoInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    playerPhotoData = event.target.result;
    playerImg.src = playerPhotoData;
    previewImg.src = playerPhotoData;
    previewImg.style.display = "block";
    previewPlaceholder.style.display = "none";
  };
  reader.readAsDataURL(file);
});

function getLeaderboard() {
  return JSON.parse(localStorage.getItem("spaceRunnerZipLeaderboard") || "[]");
}

function saveLeaderboard(name, finalScore) {
  const board = getLeaderboard();
  board.push({ name, score: finalScore });
  board.sort((a, b) => b.score - a.score);
  localStorage.setItem("spaceRunnerZipLeaderboard", JSON.stringify(board.slice(0, 5)));
}

function renderLeaderboard() {
  const board = getLeaderboard();
  leaderboardList.innerHTML = "";
  if (!board.length) {
    leaderboardList.innerHTML = "<li>No scores yet</li>";
    return;
  }
  board.forEach(item => {
    const li = document.createElement("li");
    li.textContent = `${item.name} - ${item.score}`;
    leaderboardList.appendChild(li);
  });
}

function finishSetup() {
  ensureAudio();
  playerName = playerNameInput.value.trim() || "Player";
  playerNameDisplay.textContent = playerName;

  if (!playerPhotoData) {
    playerImg.src =
      "data:image/svg+xml;utf8," +
      encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
          <rect width="100" height="100" fill="#111827"/>
          <circle cx="50" cy="38" r="20" fill="#6cf0ff"/>
          <rect x="28" y="62" width="44" height="24" rx="10" fill="#ff3c6f"/>
        </svg>
      `);
  }

  setupPanel.classList.add("hidden");
  startMessageEl.classList.remove("hidden");
  setupDone = true;
}

function updateHud() {
  scoreEl.textContent = score;
  coinsEl.textContent = coins;
  livesEl.textContent = lives;
  levelEl.textContent = level;
  timeEl.textContent = elapsedTime;
  highScoreEl.textContent = highScore;
  shieldStatusEl.textContent = shieldActive ? "Yes" : "No";
  player.classList.toggle("shielded", shieldActive);
}

function startGame() {
  gameStarted = true;
  gameEnded = false;
  paused = false;
  startMessageEl.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  gameOverEl.classList.add("hidden");
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function clearEntities() {
  [...obstacles, ...coinsItems, ...powerups, ...bullets, ...bossBullets].forEach(item => item.el.remove());
  obstacles = [];
  coinsItems = [];
  powerups = [];
  bullets = [];
  bossBullets = [];

  if (boss && boss.el) {
    boss.el.remove();
    boss = null;
  }
}

function resetGame() {
  clearEntities();

  score = 0;
  coins = 0;
  lives = 3;
  level = 1;
  elapsedTime = 0;
  shieldActive = false;
  bossMode = false;
  bossHealth = 12;

  obstacleSpeed = 6;
  obstacleSpawnRate = 1500;
  coinSpawnRate = 2200;
  powerupSpawnRate = 9000;

  playerBottom = GROUND_HEIGHT;
  velocityY = 0;
  isJumping = false;

  gameStarted = false;
  gameEnded = false;
  paused = false;

  lastObstacleSpawn = 0;
  lastCoinSpawn = 0;
  lastPowerupSpawn = 0;
  lastBossShot = 0;
  scoreTimer = 0;
  levelTimer = 0;

  player.style.bottom = playerBottom + "px";
  gameOverEl.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  startMessageEl.classList.remove("hidden");
  document.getElementById("ground").style.animationDuration = "1s";

  updateHud();
  renderLeaderboard();
}

function jump() {
  if (!isJumping && !paused && !gameEnded) {
    isJumping = true;
    velocityY = 15;
    jumpSound();
  }
}

function shoot() {
  if (!gameStarted || paused || gameEnded) return;

  const bullet = document.createElement("div");
  bullet.className = "bullet";
  bullet.style.left = "165px";
  bullet.style.bottom = (playerBottom + 54) + "px";
  game.appendChild(bullet);

  bullets.push({
    el: bullet,
    x: 165,
    yBottom: playerBottom + 54,
    width: 18,
    height: 6
  });

  shootSound();
}

function spawnObstacle() {
  if (bossMode) return;
  const obstacle = document.createElement("div");
  obstacle.className = "obstacle";
  const size = 30 + Math.random() * 34;
  obstacle.style.width = size + "px";
  obstacle.style.height = size + "px";
  obstacle.style.left = game.clientWidth + "px";
  obstacle.style.bottom = GROUND_HEIGHT + "px";
  game.appendChild(obstacle);

  obstacles.push({
    el: obstacle,
    x: game.clientWidth,
    bottom: GROUND_HEIGHT,
    width: size,
    height: size
  });
}

function spawnCoin() {
  if (bossMode) return;
  const coin = document.createElement("div");
  coin.className = "coin";
  const bottom = GROUND_HEIGHT + 25 + Math.random() * 130;
  coin.style.left = game.clientWidth + "px";
  coin.style.bottom = bottom + "px";
  game.appendChild(coin);

  coinsItems.push({
    el: coin,
    x: game.clientWidth,
    bottom,
    width: 26,
    height: 26
  });
}

function spawnPowerup() {
  if (bossMode) return;
  const power = document.createElement("div");
  power.className = "powerup";
  const bottom = GROUND_HEIGHT + 25 + Math.random() * 110;
  power.style.left = game.clientWidth + "px";
  power.style.bottom = bottom + "px";
  game.appendChild(power);

  powerups.push({
    el: power,
    x: game.clientWidth,
    bottom,
    width: 30,
    height: 30
  });
}

function createExplosion(x, y) {
  const ex = document.createElement("div");
  ex.className = "explosion";
  ex.style.left = x + "px";
  ex.style.top = y + "px";
  game.appendChild(ex);
  setTimeout(() => ex.remove(), 500);
}

function getPlayerRect() {
  return {
    left: window.innerWidth <= 900 ? 56 : 100,
    right: window.innerWidth <= 900 ? 116 : 160,
    top: GAME_HEIGHT - playerBottom - 110,
    bottom: GAME_HEIGHT - playerBottom
  };
}

function getRect(item) {
  return {
    left: item.x,
    right: item.x + item.width,
    top: GAME_HEIGHT - item.bottom - item.height,
    bottom: GAME_HEIGHT - item.bottom
  };
}

function collides(a, b) {
  return (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
  );
}

function loseLife() {
  if (shieldActive) {
    shieldActive = false;
    updateHud();
    return;
  }

  lives--;
  updateHud();

  if (lives <= 0) {
    endGame();
  }
}

function updatePlayer() {
  if (isJumping) {
    velocityY -= gravity;
    playerBottom += velocityY;

    if (playerBottom <= GROUND_HEIGHT) {
      playerBottom = GROUND_HEIGHT;
      velocityY = 0;
      isJumping = false;
    }

    player.style.bottom = playerBottom + "px";
  }
}

function updateObstacles() {
  const playerRect = getPlayerRect();

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.x -= obstacleSpeed;
    obs.el.style.left = obs.x + "px";

    if (collides(playerRect, getRect(obs))) {
      createExplosion(obs.x, GAME_HEIGHT - GROUND_HEIGHT - obs.height);
      hitSound();
      obs.el.remove();
      obstacles.splice(i, 1);
      loseLife();
      continue;
    }

    if (obs.x + obs.width < 0) {
      obs.el.remove();
      obstacles.splice(i, 1);
      score++;
      if (score > highScore) {
        highScore = score;
        localStorage.setItem("spaceRunnerZipHighScore", highScore);
      }
      updateHud();
    }
  }
}

function updateCoins() {
  const playerRect = getPlayerRect();

  for (let i = coinsItems.length - 1; i >= 0; i--) {
    const coin = coinsItems[i];
    coin.x -= obstacleSpeed;
    coin.el.style.left = coin.x + "px";

    if (collides(playerRect, getRect(coin))) {
      coinSound();
      coin.el.remove();
      coinsItems.splice(i, 1);
      coins++;
      score += 2;
      if (score > highScore) {
        highScore = score;
        localStorage.setItem("spaceRunnerZipHighScore", highScore);
      }
      updateHud();
      continue;
    }

    if (coin.x + coin.width < 0) {
      coin.el.remove();
      coinsItems.splice(i, 1);
    }
  }
}

function updatePowerups() {
  const playerRect = getPlayerRect();

  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.x -= obstacleSpeed;
    p.el.style.left = p.x + "px";

    if (collides(playerRect, getRect(p))) {
      p.el.remove();
      powerups.splice(i, 1);
      shieldActive = true;
      powerSound();
      updateHud();
      continue;
    }

    if (p.x + p.width < 0) {
      p.el.remove();
      powerups.splice(i, 1);
    }
  }
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += 12;
    b.el.style.left = b.x + "px";

    let removed = false;

    for (let j = obstacles.length - 1; j >= 0; j--) {
      const obs = obstacles[j];
      const bulletRect = {
        left: b.x,
        right: b.x + b.width,
        top: GAME_HEIGHT - b.yBottom - b.height,
        bottom: GAME_HEIGHT - b.yBottom
      };

      if (collides(bulletRect, getRect(obs))) {
        createExplosion(obs.x, GAME_HEIGHT - obs.bottom - obs.height);
        obs.el.remove();
        obstacles.splice(j, 1);
        b.el.remove();
        bullets.splice(i, 1);
        score += 2;
        if (score > highScore) {
          highScore = score;
          localStorage.setItem("spaceRunnerZipHighScore", highScore);
        }
        updateHud();
        removed = true;
        break;
      }
    }

    if (removed) continue;

    if (boss && bossMode) {
      const bossRect = {
        left: boss.x,
        right: boss.x + boss.width,
        top: boss.y,
        bottom: boss.y + boss.height
      };

      const bulletRect = {
        left: b.x,
        right: b.x + b.width,
        top: GAME_HEIGHT - b.yBottom - b.height,
        bottom: GAME_HEIGHT - b.yBottom
      };

      if (
        bulletRect.left < bossRect.right &&
        bulletRect.right > bossRect.left &&
        bulletRect.top < bossRect.bottom &&
        bulletRect.bottom > bossRect.top
      ) {
        bossHealth--;
        bossHitSound();
        updateBossHealth();

        b.el.remove();
        bullets.splice(i, 1);

        if (bossHealth <= 0) {
          createExplosion(boss.x + 40, boss.y + 20);
          createExplosion(boss.x + 80, boss.y + 40);
          boss.el.remove();
          boss = null;
          bossMode = false;
          score += 20;
          if (score > highScore) {
            highScore = score;
            localStorage.setItem("spaceRunnerZipHighScore", highScore);
          }
          updateHud();
        }
        continue;
      }
    }

    if (b.x > game.clientWidth + 40) {
      b.el.remove();
      bullets.splice(i, 1);
    }
  }
}

function spawnBoss() {
  if (bossMode || boss) return;

  bossMode = true;
  bossHealth = 12;

  bossAlert.classList.remove("hidden");
  setTimeout(() => bossAlert.classList.add("hidden"), 1600);

  const bossEl = document.createElement("div");
  bossEl.className = "boss";
  bossEl.style.left = (game.clientWidth - 180) + "px";
  bossEl.style.top = "140px";

  const healthWrap = document.createElement("div");
  healthWrap.className = "boss-health";

  const healthBar = document.createElement("div");
  healthBar.className = "boss-health-bar";

  healthWrap.appendChild(healthBar);
  bossEl.appendChild(healthWrap);
  game.appendChild(bossEl);

  boss = {
    el: bossEl,
    x: game.clientWidth - 180,
    y: 140,
    width: 140,
    height: 90,
    dir: 1,
    healthBar
  };
}

function updateBossHealth() {
  if (!boss) return;
  boss.healthBar.style.width = `${(bossHealth / 12) * 100}%`;
}

function updateBoss() {
  if (!bossMode || !boss) return;

  boss.y += boss.dir * 2;
  if (boss.y < 90) boss.dir = 1;
  if (boss.y > 250) boss.dir = -1;
  boss.el.style.top = boss.y + "px";

  const now = performance.now();
  if (now - lastBossShot > 1200) {
    spawnBossBullet();
    lastBossShot = now;
  }
}

function spawnBossBullet() {
  if (!boss) return;

  const el = document.createElement("div");
  el.className = "boss-bullet";
  const x = boss.x + 10;
  const y = boss.y + 42;

  el.style.left = x + "px";
  el.style.top = y + "px";
  game.appendChild(el);

  bossBullets.push({
    el,
    x,
    y,
    width: 16,
    height: 16
  });
}

function updateBossBullets() {
  const playerRect = getPlayerRect();

  for (let i = bossBullets.length - 1; i >= 0; i--) {
    const b = bossBullets[i];
    b.x -= 7;
    b.el.style.left = b.x + "px";

    const rect = {
      left: b.x,
      right: b.x + b.width,
      top: b.y,
      bottom: b.y + b.height
    };

    if (
      rect.left < playerRect.right &&
      rect.right > playerRect.left &&
      rect.top < playerRect.bottom &&
      rect.bottom > playerRect.top
    ) {
      createExplosion(b.x, b.y);
      hitSound();
      b.el.remove();
      bossBullets.splice(i, 1);
      loseLife();
      continue;
    }

    if (b.x + b.width < 0) {
      b.el.remove();
      bossBullets.splice(i, 1);
    }
  }
}

function increaseLevel() {
  level++;
  obstacleSpeed += 1.3;
  obstacleSpawnRate = Math.max(700, obstacleSpawnRate - 90);
  coinSpawnRate = Math.max(1200, coinSpawnRate - 60);

  const newDuration = Math.max(0.35, 1 - (level - 1) * 0.08);
  document.getElementById("ground").style.animationDuration = newDuration + "s";

  if (level % 3 === 0) {
    spawnBoss();
  }

  updateHud();
}

function togglePause() {
  if (!gameStarted || gameEnded) return;

  paused = !paused;

  if (paused) {
    pauseScreen.classList.remove("hidden");
  } else {
    pauseScreen.classList.add("hidden");
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }
}

function endGame() {
  gameEnded = true;
  saveLeaderboard(playerName, score);
  renderLeaderboard();

  gameOverText.innerHTML = `
    <p><strong>${playerName}</strong></p>
    <p>Final Score: ${score}</p>
    <p>Coins: ${coins}</p>
    <p>Level Reached: ${level}</p>
    <p>High Score: ${highScore}</p>
  `;

  gameOverEl.classList.remove("hidden");
}

function gameLoop(timestamp) {
  if (!gameStarted || gameEnded || paused) return;

  const deltaTime = timestamp - lastTime;
  lastTime = timestamp;

  updatePlayer();
  updateObstacles();
  updateCoins();
  updatePowerups();
  updateBullets();
  updateBoss();
  updateBossBullets();

  if (!bossMode && timestamp - lastObstacleSpawn > obstacleSpawnRate) {
    spawnObstacle();
    lastObstacleSpawn = timestamp;
  }

  if (!bossMode && timestamp - lastCoinSpawn > coinSpawnRate) {
    spawnCoin();
    lastCoinSpawn = timestamp;
  }

  if (!bossMode && timestamp - lastPowerupSpawn > powerupSpawnRate) {
    spawnPowerup();
    lastPowerupSpawn = timestamp;
  }

  scoreTimer += deltaTime;
  levelTimer += deltaTime;

  if (scoreTimer >= 1000) {
    elapsedTime++;
    scoreTimer = 0;
    updateHud();
  }

  if (levelTimer >= 30000) {
    levelTimer = 0;
    increaseLevel();
  }

  requestAnimationFrame(gameLoop);
}

function handleJumpStart() {
  if (!setupDone) return;
  ensureAudio();
  if (!gameStarted) startGame();
  jump();
}

function handleShootStart() {
  if (!setupDone) return;
  ensureAudio();
  if (!gameStarted) startGame();
  shoot();
}

function bindTouchButton(button, handler) {
  button.addEventListener("touchstart", (e) => {
    e.preventDefault();
    handler();
  }, { passive: false });

  button.addEventListener("click", (e) => {
    e.preventDefault();
    handler();
  });
}

bindTouchButton(jumpBtn, handleJumpStart);
bindTouchButton(shootBtn, handleShootStart);
bindTouchButton(startBtn, finishSetup);
bindTouchButton(restartBtn, resetGame);
bindTouchButton(resumeBtn, togglePause);
bindTouchButton(pauseBtn, togglePause);
bindTouchButton(musicToggleBtn, toggleMusic);

playerNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") finishSetup();
});

document.addEventListener("keydown", (e) => {
  if (!setupDone) return;

  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();
    handleJumpStart();
  }

  if (e.code === "KeyF") {
    handleShootStart();
  }

  if (e.code === "KeyP") {
    togglePause();
  }

  if (e.code === "KeyR" && gameEnded) {
    resetGame();
  }
});

document.addEventListener("touchmove", (e) => {
  if (e.target.closest(".panel")) return;
  e.preventDefault();
}, { passive: false });

player.style.bottom = playerBottom + "px";
updateHud();
renderLeaderboard();