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
const goal = { x: 247, y: 85, w: 466, h: 184 };
const ballStart = { x: 480, y: 548 };
const keeperHome = { x: 480, y: 208 };
const MAX_SHOTS = 5;
const MAX_MATCHES = 5;
const UPGRADE_COST = 2;

const difficulties = {
  rookie: { keeper: 0.5, save: 55, opponent: 1.55, drift: 0.74, reaction: 0.18 },
  pro: { keeper: 0.68, save: 70, opponent: 2.25, drift: 1, reaction: 0.1 },
  legend: { keeper: 0.84, save: 84, opponent: 3, drift: 1.22, reaction: 0.02 }
};

const opponents = ["North Rovers", "Capital FC", "Red Harbour", "Royal Atesh", "Old City XI"];
const teamKits = {
  "Baku Falcons": ["#ef476f", "#ffd166"],
  "Absheron United": ["#70d6ff", "#073b4c"],
  "Caspian City": ["#06d6a0", "#118ab2"],
  "Flame Stars": ["#ff7b00", "#fff3b0"]
};

let aim = { x: 480, y: 165 };
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
let keeper = { x: keeperHome.x, y: keeperHome.y, lean: 0, extension: 0, targetX: keeperHome.x };
let lastTime = 0;
let messageUntil = 0;
let stats = { accuracy: 1, power: 1, curve: 1 };
let table = [];
let particles = [];
let ripples = [];
let confetti = [];
let shake = 0;
let pointerDown = false;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
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
  teamText.textContent = teamSelect.value;
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

function resetKeeper() {
  keeper = { x: keeperHome.x, y: keeperHome.y, lean: 0, extension: 0, targetX: keeperHome.x };
}

function resetMatch() {
  aim = { x: 480, y: 165 };
  power = 50;
  powerDirection = 1;
  shot = 1;
  playerGoals = 0;
  opponentGoals = 0;
  state = "aiming";
  shotData = null;
  particles = [];
  ripples = [];
  confetti = [];
  shake = 0;
  resetKeeper();
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
  burst(120 + stats[stat] * 24, 36, "#ffd24a", 14, 1.2);
  setMessage(`${stat[0].toUpperCase()}${stat.slice(1)} upgraded.`, 1200);
  updateHud();
}

function moveAim(deltaX, deltaY = 0) {
  if (state !== "aiming") return;
  const curveNudge = (stats.curve - 1) * 2;
  aim.x = clamp(aim.x + deltaX + Math.sign(deltaX) * curveNudge, goal.x + 30, goal.x + goal.w - 30);
  aim.y = clamp(aim.y + deltaY, goal.y + 38, goal.y + goal.h - 28);
}

function pointerAim(event) {
  if (state !== "aiming") return;
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * W;
  const y = ((event.clientY - rect.top) / rect.height) * H;
  aim.x = clamp(x, goal.x + 30, goal.x + goal.w - 30);
  aim.y = clamp(y, goal.y + 38, goal.y + goal.h - 28);
}

function burst(x, y, color, count = 18, force = 1) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const speed = (2 + Math.random() * 4) * force;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 1.2,
      life: 680 + Math.random() * 460,
      maxLife: 1000,
      size: 2 + Math.random() * 4,
      color
    });
  }
}

function goalConfetti() {
  const kit = teamKits[teamSelect.value] || ["#ffd24a", "#70d6ff"];
  for (let i = 0; i < 48; i += 1) {
    confetti.push({
      x: 130 + Math.random() * 700,
      y: -20 - Math.random() * 120,
      vx: -0.8 + Math.random() * 1.6,
      vy: 1.8 + Math.random() * 2.6,
      spin: Math.random() * Math.PI,
      rot: Math.random() * Math.PI,
      color: kit[i % kit.length],
      life: 2300 + Math.random() * 1000
    });
  }
}

function simulateOpponentShot() {
  const d = difficulty();
  const pressure = match * 0.1;
  const chance = clamp((d.opponent + pressure - stats.accuracy * 0.12) / 5, 0.18, 0.78);
  if (Math.random() < chance) opponentGoals += 1;
}

function buildShotTarget() {
  const d = difficulty();
  const idealPower = 76 + stats.power * 2.7;
  const powerError = Math.abs(power - idealPower);
  const pressureDrift = shot >= 4 ? 1.12 : 1;
  const statHelp = stats.accuracy * 10;
  const accuracy = clamp(1 - (powerError / 330) * d.drift + statHelp / 240, 0.48, 0.97);
  const wild = power < 19 || power > 97 ? 1.7 : 1;
  const drift = (Math.random() - 0.5) * (130 - accuracy * 92) * wild * pressureDrift;
  const lift = (Math.random() - 0.5) * (92 - accuracy * 48) * wild;
  const side = aim.x < keeperHome.x ? -1 : 1;
  const curve = side * (stats.curve - 1) * (12 + power / 16);

  return {
    x: aim.x + drift + curve,
    y: aim.y + lift + (power > 94 ? -28 : 0),
    curve: curve * 1.6,
    idealPower
  };
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
  const target = buildShotTarget();
  const read = Math.random();
  const fakeOut = stats.curve * 0.025;
  const keeperRead = clamp(d.keeper + read * 0.22 - fakeOut, 0.38, 0.96);
  const keeperTarget = {
    x: keeperHome.x + (target.x - keeperHome.x) * keeperRead,
    y: keeperHome.y + (target.y - keeperHome.y) * (0.36 + read * 0.23)
  };

  shotData = {
    start: performance.now(),
    duration: clamp(850 - power * 3.1 - stats.power * 18, 500, 820),
    from: { ...ballStart },
    target,
    keeperTarget,
    trail: [],
    spin: 0,
    result: null,
    resolved: false
  };
  keeper.targetX = keeperTarget.x;
  state = "shooting";
  shake = 2.4;
  burst(ballStart.x, ballStart.y + 14, "#ecf8ef", 14, 0.7);
  setMessage("Strike!", 700);
}

function resolveShot() {
  if (shotData.resolved) return;
  shotData.resolved = true;
  const d = difficulty();
  const target = shotData.target;
  const inGoal =
    target.x > goal.x + 17 &&
    target.x < goal.x + goal.w - 17 &&
    target.y > goal.y + 18 &&
    target.y < goal.y + goal.h - 10;
  const saveDistance = Math.hypot(target.x - shotData.keeperTarget.x, target.y - shotData.keeperTarget.y);
  const saved = inGoal && saveDistance < d.save - stats.curve * 3.5;

  if (inGoal && !saved) {
    playerGoals += 1;
    coins += 1;
    shotData.result = "goal";
    ripples.push({ x: target.x, y: target.y, life: 900, radius: 0 });
    goalConfetti();
    burst(target.x, target.y, "#ffd24a", 30, 1.1);
    shake = 5.5;
    setMessage("Goal! Net smashed. Coin earned.", 1800);
  } else if (saved) {
    shotData.result = "saved";
    burst(shotData.keeperTarget.x, shotData.keeperTarget.y, "#70d6ff", 24, 0.9);
    shake = 4;
    setMessage("Saved. The keeper got a glove on it.", 1800);
  } else {
    shotData.result = "miss";
    burst(clamp(target.x, goal.x, goal.x + goal.w), clamp(target.y, goal.y, goal.y + goal.h), "#ff6b6b", 18, 0.8);
    shake = 3;
    setMessage("Missed. Too much whip on it.", 1800);
  }

  simulateOpponentShot();
  state = "result";
  updateHud();
  setTimeout(nextShot, 1350);
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
  aim = { x: 480, y: 165 };
  resetKeeper();
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

function drawStadiumBack(now) {
  const sky = ctx.createLinearGradient(0, 0, 0, 120);
  sky.addColorStop(0, "#102b33");
  sky.addColorStop(1, "#091b20");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, 140);

  ctx.fillStyle = "#0d2026";
  ctx.fillRect(0, 22, W, 88);
  for (let row = 0; row < 4; row += 1) {
    for (let x = -8; x < W; x += 22) {
      const glow = (Math.sin(now / 450 + x * 0.08 + row) + 1) * 0.5;
      ctx.fillStyle = glow > 0.62 ? "#ffd24a" : row % 2 ? "#70d6ff" : "#ef476f";
      ctx.globalAlpha = 0.3 + glow * 0.38;
      ctx.fillRect(x, 31 + row * 18, 10, 8);
    }
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#101f24";
  ctx.fillRect(78, 116, 804, 36);
  ctx.fillStyle = "#ffd24a";
  ctx.font = "900 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PENALTY RUSH", W / 2, 140);
}

function drawPitch() {
  const base = ctx.createLinearGradient(0, 145, 0, H);
  base.addColorStop(0, "#1b8d50");
  base.addColorStop(1, "#0b5b35");
  ctx.fillStyle = base;
  ctx.fillRect(0, 145, W, H - 145);

  for (let x = -140; x < W + 160; x += 92) {
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + 110, H);
    ctx.lineTo(x + 388, 145);
    ctx.lineTo(x + 278, 145);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(236, 248, 239, 0.78)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(92, H);
  ctx.lineTo(287, 288);
  ctx.lineTo(673, 288);
  ctx.lineTo(868, H);
  ctx.stroke();

  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(ballStart.x, ballStart.y, 75, Math.PI * 1.12, Math.PI * 1.88);
  ctx.stroke();
}

function drawGoal() {
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fillRect(goal.x - 28, goal.y - 18, goal.w + 56, goal.h + 36);

  ctx.strokeStyle = "rgba(249, 255, 251, 0.32)";
  ctx.lineWidth = 1;
  for (let x = goal.x + 34; x < goal.x + goal.w; x += 34) {
    ctx.beginPath();
    ctx.moveTo(x, goal.y + 5);
    ctx.lineTo(x + Math.sin(x) * 8, goal.y + goal.h);
    ctx.stroke();
  }
  for (let y = goal.y + 28; y < goal.y + goal.h; y += 28) {
    ctx.beginPath();
    ctx.moveTo(goal.x + 5, y);
    ctx.quadraticCurveTo(goal.x + goal.w / 2, y + 8, goal.x + goal.w - 5, y);
    ctx.stroke();
  }

  for (const ripple of ripples) {
    ctx.strokeStyle = `rgba(255, 210, 74, ${clamp(ripple.life / 900, 0, 1)})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "#f9fffb";
  ctx.lineWidth = 12;
  ctx.lineJoin = "round";
  ctx.strokeRect(goal.x, goal.y, goal.w, goal.h);
  ctx.strokeStyle = "rgba(7, 19, 22, 0.5)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(goal.x, goal.y + goal.h);
  ctx.lineTo(goal.x + goal.w, goal.y + goal.h);
  ctx.stroke();
}

function drawKeeper() {
  const x = keeper.x;
  const y = keeper.y;
  const lean = keeper.lean;
  const kit = "#2bb7e8";
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean * 0.22);

  ctx.strokeStyle = "#9be7ff";
  ctx.lineWidth = 16;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-66 - keeper.extension * 18, 6 + Math.abs(lean) * 10);
  ctx.lineTo(-22, -15);
  ctx.moveTo(22, -15);
  ctx.lineTo(66 + keeper.extension * 18, 6 + Math.abs(lean) * 10);
  ctx.stroke();

  ctx.fillStyle = kit;
  ctx.fillRect(-25, -24, 50, 72);
  ctx.fillStyle = "#071316";
  ctx.beginPath();
  ctx.arc(0, -46, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ecf8ef";
  ctx.fillRect(-7, -52, 14, 6);

  ctx.strokeStyle = "#071316";
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(-11, 46);
  ctx.lineTo(-44 - Math.max(0, -lean) * 20, 93);
  ctx.moveTo(11, 46);
  ctx.lineTo(44 + Math.max(0, lean) * 20, 93);
  ctx.stroke();
  ctx.restore();
}

function drawAim() {
  if (state !== "aiming") return;
  const sweet = Math.max(0, 1 - Math.abs(power - (76 + stats.power * 2.7)) / 30);
  ctx.strokeStyle = `rgba(255, 210, 74, ${0.62 + sweet * 0.38})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(aim.x, aim.y, 24 + sweet * 6, 0, Math.PI * 2);
  ctx.moveTo(aim.x - 42, aim.y);
  ctx.lineTo(aim.x + 42, aim.y);
  ctx.moveTo(aim.x, aim.y - 42);
  ctx.lineTo(aim.x, aim.y + 42);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 210, 74, 0.14)";
  ctx.beginPath();
  ctx.arc(aim.x, aim.y, 52 + stats.accuracy * 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawBall(x, y, radius = 17, spin = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  const grad = ctx.createRadialGradient(-radius * 0.35, -radius * 0.45, 2, 0, 0, radius);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, "#d7e0dc");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#152227";
  ctx.lineWidth = Math.max(2, radius * 0.12);
  ctx.beginPath();
  ctx.moveTo(-radius * 0.65, -radius * 0.2);
  ctx.lineTo(0, radius * 0.42);
  ctx.lineTo(radius * 0.62, -radius * 0.18);
  ctx.moveTo(0, -radius * 0.8);
  ctx.lineTo(0, radius * 0.42);
  ctx.stroke();
  ctx.restore();
}

function shotPosition(now) {
  const t = clamp((now - shotData.start) / shotData.duration, 0, 1);
  const eased = easeInOut(t);
  const apex = Math.sin(t * Math.PI) * (120 + power * 0.28);
  const control = {
    x: (shotData.from.x + shotData.target.x) / 2 + shotData.target.curve,
    y: 340 - apex * 0.18
  };
  const x = (1 - eased) * (1 - eased) * shotData.from.x + 2 * (1 - eased) * eased * control.x + eased * eased * shotData.target.x;
  const y = (1 - eased) * (1 - eased) * shotData.from.y + 2 * (1 - eased) * eased * control.y + eased * eased * shotData.target.y - apex;
  return { x, y, t };
}

function drawShot(now) {
  if (!shotData) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(ballStart.x, ballStart.y + 19, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    drawBall(ballStart.x, ballStart.y);
    return;
  }

  const pos = shotPosition(now);
  shotData.spin += 0.22 + power / 520;
  shotData.trail.push({ x: pos.x, y: pos.y, life: 360 });
  if (shotData.trail.length > 18) shotData.trail.shift();

  for (const dot of shotData.trail) {
    const a = clamp(dot.life / 360, 0, 1);
    ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.28})`;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 4 + a * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  keeper.x = lerp(keeperHome.x, shotData.keeperTarget.x, easeOutCubic(clamp((pos.t - difficulty().reaction) * 1.45, 0, 1)));
  keeper.y = lerp(keeperHome.y, shotData.keeperTarget.y, easeOutCubic(clamp((pos.t - difficulty().reaction) * 1.2, 0, 1))) + Math.sin(pos.t * Math.PI) * 6;
  keeper.lean = clamp((keeper.x - keeperHome.x) / 150, -1, 1);
  keeper.extension = clamp(pos.t * 1.7, 0, 1);

  const radius = 18 - pos.t * 6;
  ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y + 34 + pos.t * 16, 24 - pos.t * 8, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  drawBall(pos.x, pos.y, radius, shotData.spin);

  if (pos.t >= 1 && state === "shooting") resolveShot();
}

function updateEffects(delta) {
  shake = Math.max(0, shake - delta * 0.012);
  for (const p of particles) {
    p.life -= delta;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;
    p.vx *= 0.986;
  }
  particles = particles.filter((p) => p.life > 0);

  for (const r of ripples) {
    r.life -= delta;
    r.radius += delta * 0.09;
  }
  ripples = ripples.filter((r) => r.life > 0);

  for (const c of confetti) {
    c.life -= delta;
    c.x += c.vx;
    c.y += c.vy;
    c.vy += 0.015;
    c.rot += c.spin * 0.08;
  }
  confetti = confetti.filter((c) => c.life > 0 && c.y < H + 40);

  if (shotData) {
    for (const dot of shotData.trail) dot.life -= delta;
    shotData.trail = shotData.trail.filter((dot) => dot.life > 0);
  }
}

function drawEffects() {
  for (const p of particles) {
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color.replace(")", `, ${a})`).replace("rgb", "rgba");
    if (!p.color.startsWith("rgb")) ctx.fillStyle = p.color;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const c of confetti) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.fillStyle = c.color;
    ctx.fillRect(-4, -2, 8, 4);
    ctx.restore();
  }
}

function tick(now) {
  const delta = Math.min(40, now - lastTime || 16);
  lastTime = now;
  updateEffects(delta);

  if (state === "aiming") {
    power += powerDirection * delta * (0.055 + difficulty().keeper * 0.012);
    if (power >= 100) {
      power = 100;
      powerDirection = -1;
    } else if (power <= 12) {
      power = 12;
      powerDirection = 1;
    }
    const sway = Math.sin(now / 650) * (0.5 + difficulty().keeper * 1.2);
    keeper.x = lerp(keeper.x, keeperHome.x + sway * 12, 0.08);
    keeper.y = lerp(keeper.y, keeperHome.y, 0.08);
    keeper.lean = sway * 0.06;
    keeper.extension = lerp(keeper.extension, 0, 0.1);
    updateHud();
  }

  if (now > messageUntil && state === "aiming") {
    messageText.textContent = "Drag the target. Hit the glowing power zone for cleaner strikes.";
  }

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawStadiumBack(now);
  drawPitch();
  drawGoal();
  drawKeeper();
  drawAim();
  drawShot(now);
  drawEffects();
  ctx.restore();
  requestAnimationFrame(tick);
}

canvas.addEventListener("pointerdown", (event) => {
  pointerDown = true;
  pointerAim(event);
});
canvas.addEventListener("pointermove", (event) => {
  if (pointerDown || event.buttons) pointerAim(event);
});
window.addEventListener("pointerup", () => {
  pointerDown = false;
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
