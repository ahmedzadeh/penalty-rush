const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const teamText = document.querySelector("#teamText");
const matchText = document.querySelector("#matchText");
const pointsText = document.querySelector("#pointsText");
const roundText = document.querySelector("#roundText");
const scoreText = document.querySelector("#scoreText");
const messageText = document.querySelector("#messageText");
const powerText = document.querySelector("#powerText");
const powerFill = document.querySelector("#powerFill");
const coinsText = document.querySelector("#coinsText");
const opponentText = document.querySelector("#opponentText");
const leagueTable = document.querySelector("#leagueTable");
const teamSelect = document.querySelector("#teamSelect");
const difficultySelect = document.querySelector("#difficultySelect");
const shootButton = document.querySelector("#shootButton");
const leftButton = document.querySelector("#leftButton");
const rightButton = document.querySelector("#rightButton");
const resetButton = document.querySelector("#resetButton");
const newSeasonButton = document.querySelector("#newSeasonButton");
const accuracyButton = document.querySelector("#accuracyButton");
const powerButton = document.querySelector("#powerButton");
const curveButton = document.querySelector("#curveButton");
const accuracyText = document.querySelector("#accuracyText");
const powerStatText = document.querySelector("#powerStatText");
const curveText = document.querySelector("#curveText");

const W = canvas.width;
const H = canvas.height;
const goal = { x: 250, y: 74, w: 460, h: 190 };
const ballStart = { x: 480, y: 548 };
const keeperHome = { x: 480, y: 190 };
const MAX_SHOTS = 5;
const MAX_MATCHES = 5;
const UPGRADE_COST = 2;

const difficulties = {
  rookie: { keeper: 0.54, save: 60, opponent: 1.65, drift: 0.78 },
  pro: { keeper: 0.7, save: 72, opponent: 2.35, drift: 1 },
  legend: { keeper: 0.86, save: 86, opponent: 3.05, drift: 1.2 }
};

const opponents = ["North Rovers", "Capital FC", "Red Harbour", "Royal Atesh", "Old City XI"];

let aim = { x: 480, y: 168 };
let power = 50;
let powerDirection = 1;
let match = 1;
let shot = 1;
let playerGoals = 0;
let opponentGoals = 0;
let coins = 0;
let points = 0;
let state = "aiming";
let shotData = null;
let keeperX = keeperHome.x;
let keeperDive = 0;
let lastTime = 0;
let messageUntil = 0;
let stats = { accuracy: 1, power: 1, curve: 1 };
let table = [];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function difficulty() {
  return difficulties[difficultySelect.value];
}

function opponentName() {
  return opponents[match - 1] || "Champions XI";
}

function setMessage(text, duration = 1600) {
  messageText.textContent = text;
  messageUntil = performance.now() + duration;
}

function createTable() {
  table = [
    { name: teamSelect.value, played: 0, gd: 0, points: 0, player: true },
    ...opponents.map((name) => ({ name, played: 0, gd: 0, points: 0, player: false }))
  ];
}

function renderTable() {
  const sorted = [...table].sort((a, b) => b.points - a.points || b.gd - a.gd || a.name.localeCompare(b.name));
  leagueTable.innerHTML = sorted.map((club) => `
    <div class="league-row ${club.player ? "is-player" : ""}">
      <span>${club.name}</span>
      <strong>${club.played}</strong>
      <strong>${club.gd}</strong>
      <strong>${club.points}</strong>
    </div>
  `).join("");
}

function updateHud() {
  const team = teamSelect.value;
  teamText.textContent = team;
  matchText.textContent = state === "seasonOver" ? "Done" : `${match} / ${MAX_MATCHES}`;
  pointsText.textContent = String(points);
  roundText.textContent = shot <= MAX_SHOTS ? `Shot ${shot} / ${MAX_SHOTS}` : "Result";
  scoreText.textContent = `${playerGoals} - ${opponentGoals}`;
  powerText.textContent = `${Math.round(power)}%`;
  powerFill.style.width = `${power}%`;
  coinsText.textContent = `${coins} coin${coins === 1 ? "" : "s"}`;
  opponentText.textContent = state === "seasonOver" ? "Season complete" : `vs ${opponentName()}`;
  accuracyText.textContent = stats.accuracy;
  powerStatText.textContent = stats.power;
  curveText.textContent = stats.curve;
  accuracyButton.disabled = coins < UPGRADE_COST || stats.accuracy >= 5 || state === "shooting";
  powerButton.disabled = coins < UPGRADE_COST || stats.power >= 5 || state === "shooting";
  curveButton.disabled = coins < UPGRADE_COST || stats.curve >= 5 || state === "shooting";
  renderTable();
}

function resetMatch() {
  aim = { x: 480, y: 168 };
  power = 50;
  powerDirection = 1;
  shot = 1;
  playerGoals = 0;
  opponentGoals = 0;
  state = "aiming";
  shotData = null;
  keeperX = keeperHome.x;
  keeperDive = 0;
  setMessage(`Match ${match}: ${teamSelect.value} vs ${opponentName()}.`, 2200);
  updateHud();
}

function newSeason() {
  match = 1;
  coins = 0;
  points = 0;
  stats = { accuracy: 1, power: 1, curve: 1 };
  createTable();
  resetMatch();
}

function upgrade(stat) {
  if (coins < UPGRADE_COST || stats[stat] >= 5 || state === "shooting") return;
  coins -= UPGRADE_COST;
  stats[stat] += 1;
  setMessage(`${stat[0].toUpperCase()}${stat.slice(1)} upgraded.`, 1200);
  updateHud();
}

function moveAim(deltaX, deltaY = 0) {
  if (state !== "aiming") return;
  const curveNudge = (stats.curve - 1) * 2;
  aim.x = clamp(aim.x + deltaX + Math.sign(deltaX) * curveNudge, goal.x + 30, goal.x + goal.w - 30);
  aim.y = clamp(aim.y + deltaY, goal.y + 42, goal.y + goal.h - 34);
}

function pointerAim(event) {
  if (state !== "aiming") return;
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * W;
  const y = ((event.clientY - rect.top) / rect.height) * H;
  aim.x = clamp(x, goal.x + 30, goal.x + goal.w - 30);
  aim.y = clamp(y, goal.y + 42, goal.y + goal.h - 34);
}

function simulateOpponentShot() {
  const d = difficulty();
  const pressure = match * 0.1;
  const chance = clamp((d.opponent + pressure - stats.accuracy * 0.12) / 5, 0.18, 0.78);
  if (Math.random() < chance) opponentGoals += 1;
}

function shoot() {
  if (state === "seasonOver") {
    newSeason();
    return;
  }
  if (state === "matchOver") {
    nextMatch();
    return;
  }
  if (state !== "aiming") return;

  const d = difficulty();
  const idealPower = 72 + stats.power * 3;
  const powerError = Math.abs(power - idealPower);
  const statHelp = stats.accuracy * 9;
  const missChance = (power < 22 || power > 96 ? 0.2 : powerError / 330) * d.drift;
  const accuracy = clamp(1 - missChance + statHelp / 220, 0.48, 0.96);
  const drift = (Math.random() - 0.5) * (120 - accuracy * 86);
  const lift = (Math.random() - 0.5) * (88 - accuracy * 46);
  const curve = (stats.curve - 1) * (aim.x < keeperHome.x ? -9 : 9);
  const target = {
    x: aim.x + drift + curve,
    y: aim.y + lift + (power > 94 ? -24 : 0)
  };

  const read = Math.random();
  const keeperTarget = {
    x: keeperHome.x + (target.x - keeperHome.x) * (d.keeper + read * 0.24),
    y: keeperHome.y + (target.y - keeperHome.y) * (0.36 + read * 0.22)
  };

  shotData = {
    start: performance.now(),
    duration: 760,
    from: { ...ballStart },
    target,
    keeperTarget,
    result: null
  };
  state = "shooting";
  setMessage("Strike!", 700);
}

function resolveShot() {
  const d = difficulty();
  const target = shotData.target;
  const inGoal =
    target.x > goal.x + 16 &&
    target.x < goal.x + goal.w - 16 &&
    target.y > goal.y + 18 &&
    target.y < goal.y + goal.h - 10;
  const saveDistance = Math.hypot(target.x - shotData.keeperTarget.x, target.y - shotData.keeperTarget.y);
  const saved = inGoal && saveDistance < d.save - stats.curve * 3;

  if (inGoal && !saved) {
    playerGoals += 1;
    coins += 1;
    shotData.result = "goal";
    setMessage("Goal! Coin earned.", 1700);
  } else if (saved) {
    shotData.result = "saved";
    setMessage("Saved. The keeper read it.", 1700);
  } else {
    shotData.result = "miss";
    setMessage("Missed. Keep it between the posts.", 1700);
  }

  simulateOpponentShot();
  state = "result";
  updateHud();
  setTimeout(nextShot, 1250);
}

function nextShot() {
  if (state !== "result") return;
  shot += 1;
  if (shot > MAX_SHOTS) {
    finishMatch();
    return;
  }
  state = "aiming";
  shotData = null;
  aim = { x: 480, y: 168 };
  keeperX = keeperHome.x;
  keeperDive = 0;
  setMessage("Use coins for upgrades, then pick your corner.", 1700);
  updateHud();
}

function finishMatch() {
  const playerClub = table.find((club) => club.player);
  const opponentClub = table.find((club) => club.name === opponentName());
  const earned = playerGoals > opponentGoals ? 3 : playerGoals === opponentGoals ? 1 : 0;
  const opponentEarned = playerGoals < opponentGoals ? 3 : playerGoals === opponentGoals ? 1 : 0;

  points += earned;
  playerClub.played += 1;
  playerClub.gd += playerGoals - opponentGoals;
  playerClub.points += earned;
  opponentClub.played += 1;
  opponentClub.gd += opponentGoals - playerGoals;
  opponentClub.points += opponentEarned;

  state = "matchOver";
  const result = earned === 3 ? "Win" : earned === 1 ? "Draw" : "Loss";
  setMessage(`${result}: ${playerGoals}-${opponentGoals}. Press Shoot for next match.`, 100000);
  updateHud();
}

function nextMatch() {
  match += 1;
  if (match > MAX_MATCHES) {
    state = "seasonOver";
    const place = [...table].sort((a, b) => b.points - a.points || b.gd - a.gd).findIndex((club) => club.player) + 1;
    setMessage(`Season complete. ${teamSelect.value} finished #${place}. Press Shoot for a new season.`, 100000);
    updateHud();
    return;
  }
  resetMatch();
}

function drawPitch() {
  const stripeH = 64;
  for (let y = 0; y < H; y += stripeH) {
    ctx.fillStyle = Math.floor(y / stripeH) % 2 === 0 ? "#147542" : "#0f633a";
    ctx.fillRect(0, y, W, stripeH);
  }

  ctx.strokeStyle = "rgba(236, 248, 239, 0.86)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(98, H);
  ctx.lineTo(290, 286);
  ctx.lineTo(670, 286);
  ctx.lineTo(862, H);
  ctx.stroke();

  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(ballStart.x, ballStart.y, 72, Math.PI * 1.13, Math.PI * 1.87);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.fillRect(goal.x - 22, goal.y - 16, goal.w + 44, goal.h + 28);
}

function drawGoal() {
  ctx.strokeStyle = "#f9fffb";
  ctx.lineWidth = 11;
  ctx.strokeRect(goal.x, goal.y, goal.w, goal.h);

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(249, 255, 251, 0.38)";
  for (let x = goal.x + 36; x < goal.x + goal.w; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, goal.y + 4);
    ctx.lineTo(x, goal.y + goal.h);
    ctx.stroke();
  }
  for (let y = goal.y + 32; y < goal.y + goal.h; y += 32) {
    ctx.beginPath();
    ctx.moveTo(goal.x + 4, y);
    ctx.lineTo(goal.x + goal.w - 4, y);
    ctx.stroke();
  }
}

function drawKeeper() {
  const x = keeperX;
  const y = keeperHome.y + keeperDive * 12;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(keeperDive * (x < keeperHome.x ? -0.36 : 0.36));
  ctx.strokeStyle = "#78d9ff";
  ctx.lineWidth = 15;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-68, 8);
  ctx.lineTo(-20, -18);
  ctx.moveTo(20, -18);
  ctx.lineTo(68, 8);
  ctx.stroke();
  ctx.fillStyle = "#2bb7e8";
  ctx.fillRect(-24, -22, 48, 70);
  ctx.fillStyle = "#101d22";
  ctx.beginPath();
  ctx.arc(0, -44, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#101d22";
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(-11, 46);
  ctx.lineTo(-42, 92);
  ctx.moveTo(11, 46);
  ctx.lineTo(42, 92);
  ctx.stroke();
  ctx.restore();
}

function drawAim() {
  if (state !== "aiming") return;
  ctx.strokeStyle = "#ffd24a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(aim.x, aim.y, 22, 0, Math.PI * 2);
  ctx.moveTo(aim.x - 34, aim.y);
  ctx.lineTo(aim.x + 34, aim.y);
  ctx.moveTo(aim.x, aim.y - 34);
  ctx.lineTo(aim.x, aim.y + 34);
  ctx.stroke();
}

function drawBall(x, y, radius = 17) {
  ctx.fillStyle = "#fbfbf5";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#152227";
  ctx.lineWidth = Math.max(2, radius * 0.12);
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.65, y - radius * 0.2);
  ctx.lineTo(x, y + radius * 0.42);
  ctx.lineTo(x + radius * 0.62, y - radius * 0.18);
  ctx.moveTo(x, y - radius * 0.8);
  ctx.lineTo(x, y + radius * 0.42);
  ctx.stroke();
}

function drawShot(now) {
  if (!shotData) {
    drawBall(ballStart.x, ballStart.y);
    return;
  }

  const t = clamp((now - shotData.start) / shotData.duration, 0, 1);
  const eased = easeOutCubic(t);
  const arc = Math.sin(t * Math.PI) * 105;
  const x = shotData.from.x + (shotData.target.x - shotData.from.x) * eased;
  const y = shotData.from.y + (shotData.target.y - shotData.from.y) * eased - arc;
  const radius = 17 - eased * 6;
  keeperX = keeperHome.x + (shotData.keeperTarget.x - keeperHome.x) * easeOutCubic(clamp(t * 1.2, 0, 1));
  keeperDive = clamp(t * 1.4, 0, 1);
  drawBall(x, y, radius);

  if (t >= 1 && state === "shooting") resolveShot();
}

function tick(now) {
  const delta = Math.min(40, now - lastTime || 16);
  lastTime = now;

  if (state === "aiming") {
    power += powerDirection * delta * (0.055 + difficulty().keeper * 0.012);
    if (power >= 100) {
      power = 100;
      powerDirection = -1;
    } else if (power <= 12) {
      power = 12;
      powerDirection = 1;
    }
    updateHud();
  }

  if (now > messageUntil && state === "aiming") {
    messageText.textContent = "Aim with mouse/touch or arrows. Spend coins on upgrades.";
  }

  ctx.clearRect(0, 0, W, H);
  drawPitch();
  drawGoal();
  drawKeeper();
  drawAim();
  drawShot(now);
  requestAnimationFrame(tick);
}

canvas.addEventListener("pointerdown", pointerAim);
canvas.addEventListener("pointermove", (event) => {
  if (event.buttons) pointerAim(event);
});

leftButton.addEventListener("click", () => moveAim(-34));
rightButton.addEventListener("click", () => moveAim(34));
shootButton.addEventListener("click", shoot);
resetButton.addEventListener("click", resetMatch);
newSeasonButton.addEventListener("click", newSeason);
teamSelect.addEventListener("change", newSeason);
difficultySelect.addEventListener("change", newSeason);
accuracyButton.addEventListener("click", () => upgrade("accuracy"));
powerButton.addEventListener("click", () => upgrade("power"));
curveButton.addEventListener("click", () => upgrade("curve"));

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") moveAim(-28);
  if (event.key === "ArrowRight") moveAim(28);
  if (event.key === "ArrowUp") moveAim(0, -18);
  if (event.key === "ArrowDown") moveAim(0, 18);
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    shoot();
  }
  if (event.key.toLowerCase() === "r") resetMatch();
});

newSeason();
requestAnimationFrame(tick);
