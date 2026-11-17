(function () {
"use strict";

var cv = document.getElementById("game"), ctx = cv.getContext("2d");
var W = 960, H = 540;
cv.width = W; cv.height = H;
ctx.imageSmoothingEnabled = false;

var C = CONFIG, GRAV = 1800, ATK_T = 0.34, ROLL_T = 0.35, ROLL_CD = 0.8;

// ---------- carregar sprites ----------
function loadImg(src) {
  var o = { img: new Image(), ok: false };
  o.img.onload = function () { o.ok = true; };
  o.img.src = src;
  return o;
}
function loadAnim(d) {
  var a = loadImg(d.arquivo);
  a.quadros = d.quadros || 1; a.fps = d.fps || 8;
  a.right = d.olhaParaDireita !== undefined ? d.olhaParaDireita : C.spritesOlhamParaDireita;
  return a;
}
var PA = {}, EA = {}, k;
for (k in C.jogador.animacoes) PA[k] = loadAnim(C.jogador.animacoes[k]);
for (k in C.inimigo.animacoes) EA[k] = loadAnim(C.inimigo.animacoes[k]);
var COINA = loadAnim(C.moeda), BG = loadImg(C.fundo.arquivo);
var T_TOP = loadImg(C.terreno.topo), T_BODY = loadImg(C.terreno.corpo), T_PLAT = loadImg(C.terreno.plataforma);

// desenha um quadro; (cx, feetY) = centro dos pés. prog (0..1) opcional = progresso fixo da animação
function drawAnim(a, t, cx, feetY, dir, w, h, prog) {
  if (!a || !a.ok) return false;
  var fw = a.img.width / a.quadros, fh = a.img.height, fr;
  if (prog != null) fr = Math.min(a.quadros - 1, Math.floor(prog * a.quadros));
  else fr = Math.floor(t * a.fps) % a.quadros;
  ctx.save();
  ctx.translate(cx, feetY);
  if ((dir < 0) === a.right) ctx.scale(-1, 1);
  ctx.drawImage(a.img, fr * fw, 0, fw, fh, -w / 2, -h, w, h);
  ctx.restore();
  return true;
}

// ---------- som ----------
var ac;
function sfx(f, d, type, v) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    var o = ac.createOscillator(), g = ac.createGain(), n = ac.currentTime;
    o.type = type || "square"; o.frequency.value = f;
    g.gain.setValueAtTime(v || 0.05, n);
    g.gain.exponentialRampToValueAtTime(0.0001, n + (d || 0.08));
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(n + (d || 0.08));
  } catch (e) {}
}

// ---------- teclado ----------
var keys = {}, pressed = {};
addEventListener("keydown", function (e) {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.code) >= 0) e.preventDefault();
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
});
addEventListener("keyup", function (e) { keys[e.code] = false; });
addEventListener("blur", function () { keys = {}; });
function L() { return keys.KeyA || keys.ArrowLeft; }
function R() { return keys.KeyD || keys.ArrowRight; }
function D() { return keys.KeyS || keys.ArrowDown; }
function jumpHeld() { return keys.Space || keys.KeyW || keys.ArrowUp; }
function jumpP() { return pressed.Space || pressed.KeyW || pressed.ArrowUp; }
function atkP() { return pressed.KeyJ || pressed.KeyX; }
function rollP() { return pressed.KeyK || pressed.KeyC || pressed.ShiftLeft || pressed.ShiftRight; }

// ---------- utilidades ----------
function mk(seed) {
  var a = seed;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function ov(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

// ---------- estado ----------
var state = "menu", plats, enemies, coins, parts, door, LEVEL_W = 3000, pl, camX = 0, shake = 0, safe, rnd;

function addEnemy(p, ex) {
  enemies.push({ x: ex, y: p.y - 54, w: 36, h: 54, plat: p, hp: C.inimigo.vida, dir: rnd() < 0.5 ? -1 : 1,
                 kb: 0, flash: 0, t: rnd() * 5 });
}
function coinsRow(x, y, n) {
  for (var i = 0; i < n; i++) coins.push({ x: x + i * 38, y: y, vy: 0, floorY: y, drop: false, t: rnd() * 6, got: false });
}
function build() {
  rnd = mk(C.fase.seed || Date.now());
  plats = []; enemies = []; coins = []; parts = [];
  var x = 0, i, k, n;
  for (i = 0; i < C.fase.segmentos; i++) {
    var len = i === 0 ? 800 : 500 + rnd() * 400;
    var g = { x: x, y: 480, w: len, h: 100, solid: true };
    plats.push(g);
    n = i === 0 ? 1 : 1 + Math.floor(rnd() * 2);
    for (k = 0; k < n; k++) {
      var w = 130 + rnd() * 80, px = x + 80 + rnd() * (len - w - 160), py = 480 - 120 - rnd() * 50;
      var p = { x: px, y: py, w: w, h: 14, solid: false };
      plats.push(p);
      if (i > 0 && rnd() < 0.5) addEnemy(p, px + w / 2);
      coinsRow(px + 20, py - 26, Math.max(2, Math.floor((w - 20) / 38)));
    }
    if (i > 0) {
      var ne = 1 + Math.floor(rnd() * (1 + Math.min(i, 3) / 1.5));
      for (k = 0; k < ne; k++) addEnemy(g, x + 120 + (len - 240) * (k + rnd() * 0.8) / ne);
    }
    coinsRow(x + 100 + rnd() * 100, 456, 3 + Math.floor(rnd() * 4));
    x += len;
    if (i < C.fase.segmentos - 1) x += 100 + rnd() * 40;
  }
  LEVEL_W = x;
  door = { x: x - 110, y: 480 - 76, w: 46, h: 76 };
}
function newGame() {
  build();
  pl = { x: 80, y: 432, w: 28, h: 48, vx: 0, vy: 0, ground: false, floor: null, dir: 1,
         hp: C.jogador.vida, maxHp: C.jogador.vida, coins: 0, kills: 0, atk: -1, hit: [], roll: -1, rollCd: 0,
         inv: 0, stun: 0, coyote: 0, jbuf: 0, drop: 0, animT: 0, anim: "parado", time: 0 };
  camX = 0; safe = { x: 80, y: 432 }; state = "play";
}

function burst(x, y, color, n) {
  for (var i = 0; i < n; i++) {
    var a = Math.random() * 6.283, s = 60 + Math.random() * 220;
    parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.4 + Math.random() * 0.4, max: 0.8, c: color, s: 2 + Math.random() * 3 });
  }
}

function hurtPlayer(fromX) {
  if (pl.inv > 0 || state !== "play") return;
  pl.hp--; pl.inv = 1; pl.stun = 0.18; pl.atk = -1; pl.roll = -1;
  pl.vx = (pl.x < fromX ? -1 : 1) * 240; pl.vy = -260;
  shake = 10; burst(pl.x + 14, pl.y + 24, "#e23b4e", 12); sfx(120, 0.2, "sawtooth", 0.08);
  if (pl.hp <= 0) { state = "dead"; burst(pl.x + 14, pl.y + 24, "#e23b4e", 40); sfx(80, 0.6, "sawtooth", 0.1); }
}

// ---------- atualização ----------
function updatePlayer(dt) {
  var p = pl, i, q;
  p.time += dt;
  p.inv = Math.max(0, p.inv - dt); p.rollCd = Math.max(0, p.rollCd - dt); p.drop = Math.max(0, p.drop - dt);
  var mx = (R() ? 1 : 0) - (L() ? 1 : 0);
  if (jumpP()) p.jbuf = 0.12; else p.jbuf = Math.max(0, p.jbuf - dt);
  p.coyote = p.ground ? 0.1 : Math.max(0, p.coyote - dt);

  if (rollP() && p.rollCd <= 0 && p.roll < 0 && p.atk < 0 && p.stun <= 0) {
    p.roll = 0; p.rollCd = ROLL_CD; p.inv = Math.max(p.inv, ROLL_T); sfx(180, 0.12, "sawtooth");
  }
  if (atkP() && p.atk < 0 && p.roll < 0 && p.stun <= 0) { p.atk = 0; p.hit = []; sfx(300, 0.07, "sawtooth"); }

  if (p.stun > 0) { p.stun -= dt; p.vx *= 1 - Math.min(1, 6 * dt); }
  else if (p.roll >= 0) {
    p.roll += dt; p.vx = p.dir * C.jogador.velocidade * 1.7;
    if (p.roll >= ROLL_T) p.roll = -1;
  } else {
    var sp = C.jogador.velocidade * (p.atk >= 0 ? 0.35 : 1);
    if (mx !== 0) { p.vx = mx * sp; if (p.atk < 0) p.dir = mx; } else p.vx = 0;
    if (p.jbuf > 0 && p.coyote > 0) {
      if (D() && p.floor && !p.floor.solid) { p.drop = 0.25; p.ground = false; p.coyote = 0; p.jbuf = 0; }
      else { p.vy = -C.jogador.pulo; p.jbuf = 0; p.coyote = 0; p.ground = false; sfx(420, 0.1, "square", 0.04); }
    }
  }
  p.vy += GRAV * dt;
  if (p.vy < 0 && !jumpHeld() && p.stun <= 0) p.vy += GRAV * 1.2 * dt;
  if (p.vy > 900) p.vy = 900;

  // ataque
  if (p.atk >= 0) {
    p.atk += dt;
    if (p.atk > 0.08 && p.atk < 0.24) {
      var al = 62, hb = { x: p.dir > 0 ? p.x + p.w : p.x - al, y: p.y - 6, w: al, h: p.h + 12 };
      for (i = enemies.length - 1; i >= 0; i--) {
        var e = enemies[i];
        if (p.hit.indexOf(e) < 0 && ov(hb, e)) {
          p.hit.push(e); e.hp--; e.flash = 0.15; e.kb = p.dir * 300; shake = 5;
          burst(e.x + e.w / 2, e.y + e.h / 2, "#c8ffb0", 8); sfx(160, 0.1, "square", 0.07);
          if (e.hp <= 0) {
            p.kills++;
            var nc = 2 + Math.floor(Math.random() * 3);
            for (var c = 0; c < nc; c++) coins.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vy: -250 - Math.random() * 200, vx: (Math.random() - 0.5) * 200, floorY: e.plat.y - 10, drop: true, t: 0, got: false });
            burst(e.x + e.w / 2, e.y + e.h / 2, "#7dd26a", 22); sfx(100, 0.25, "sawtooth", 0.07);
            enemies.splice(i, 1);
          }
        }
      }
    }
    if (p.atk >= ATK_T) p.atk = -1;
  }

  // movimento + colisão X
  p.x += p.vx * dt;
  for (i = 0; i < plats.length; i++) {
    q = plats[i];
    if (q.solid && ov(p, q)) { if (p.vx > 0) p.x = q.x - p.w; else if (p.vx < 0) p.x = q.x + q.w; }
  }
  if (p.x < 0) p.x = 0;
  if (p.x > LEVEL_W - p.w) p.x = LEVEL_W - p.w;

  // movimento + colisão Y
  var prevBottom = p.y + p.h, prevTop = p.y;
  p.y += p.vy * dt; p.ground = false; p.floor = null;
  for (i = 0; i < plats.length; i++) {
    q = plats[i];
    if (!ov(p, q)) continue;
    if (q.solid) {
      if (prevBottom <= q.y + 2) { p.y = q.y - p.h; p.vy = 0; p.ground = true; p.floor = q; }
      else if (prevTop >= q.y + q.h - 2) { p.y = q.y + q.h; if (p.vy < 0) p.vy = 0; }
    } else if (p.vy >= 0 && prevBottom <= q.y + 2 && p.drop <= 0) {
      p.y = q.y - p.h; p.vy = 0; p.ground = true; p.floor = q;
    }
  }
  if (p.ground && p.floor.solid && p.x > p.floor.x + 60 && p.x + p.w < p.floor.x + p.floor.w - 60) { safe.x = p.x; safe.y = p.y; }

  // caiu no buraco
  if (p.y > H + 120) {
    p.hp--; sfx(120, 0.3, "sawtooth", 0.08); shake = 10;
    if (p.hp <= 0) { state = "dead"; p.y = H + 120; return; }
    p.x = safe.x; p.y = safe.y; p.vx = 0; p.vy = 0; p.inv = 1.2;
  }
  // chegou no portal
  if (ov(p, door)) { state = "win"; sfx(660, 0.4, "square", 0.06); burst(door.x + 23, door.y + 38, "#6ff2ff", 50); }

  // animação
  var an = p.roll >= 0 ? "rolando" : p.atk >= 0 ? "ataque" : !p.ground ? "pulando" : (p.vx !== 0 ? "correndo" : "parado");
  if (an !== p.anim) { p.anim = an; p.animT = 0; } else p.animT += dt;
}

function updateEnemies(dt) {
  for (var i = 0; i < enemies.length; i++) {
    var e = enemies[i], v = C.inimigo.velocidade;
    e.t += dt; e.flash = Math.max(0, e.flash - dt);
    var dx = (pl.x + pl.w / 2) - (e.x + e.w / 2), dy = pl.y - e.y;
    var chase = state === "play" && Math.abs(dx) < C.inimigo.visao && Math.abs(dy) < 90;
    if (chase && Math.abs(dx) > 6) { e.dir = dx > 0 ? 1 : -1; v *= 1.8; }
    e.x += (e.dir * v + e.kb) * dt;
    e.kb *= 1 - Math.min(1, 8 * dt);
    if (e.x < e.plat.x) { e.x = e.plat.x; e.dir = 1; }
    if (e.x + e.w > e.plat.x + e.plat.w) { e.x = e.plat.x + e.plat.w - e.w; e.dir = -1; }
    if (state === "play" && ov(e, pl)) hurtPlayer(e.x);
  }
}

function updateCoins(dt) {
  for (var i = coins.length - 1; i >= 0; i--) {
    var c = coins[i]; c.t += dt;
    if (c.drop) {
      c.vy += GRAV * dt; c.y += c.vy * dt; c.x += (c.vx || 0) * dt;
      if (c.y >= c.floorY) { c.y = c.floorY; c.vy = 0; c.drop = false; }
    }
    var dx = pl.x + pl.w / 2 - c.x, dy = pl.y + pl.h / 2 - c.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (!c.drop && d < 80 && state === "play") { c.x += dx / d * 260 * dt; c.y += dy / d * 260 * dt; }
    if (state === "play" && d < 24) {
      pl.coins++; coins.splice(i, 1); sfx(880 + Math.random() * 200, 0.07, "square", 0.04);
      burst(c.x, c.y, "#ffd34a", 5);
    }
  }
}

function updateParts(dt) {
  for (var i = parts.length - 1; i >= 0; i--) {
    var p = parts[i]; p.life -= dt; p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
}

// ---------- desenho ----------
function drawBg() {
  if (BG.ok) {
    var s = H / BG.img.height, w = BG.img.width * s, off = -((camX * 0.3) % w);
    for (var x = off; x < W; x += w) ctx.drawImage(BG.img, x, 0, w, H);
    return;
  }
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0b0716"); g.addColorStop(1, "#2a1646");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  var layers = [[0.15, "#1a1030", 330, 70, 0.004], [0.3, "#140c26", 400, 60, 0.007], [0.5, "#0f0a1d", 450, 40, 0.012]];
  for (var l = 0; l < layers.length; l++) {
    var Ly = layers[l]; ctx.fillStyle = Ly[1]; ctx.beginPath(); ctx.moveTo(0, H);
    for (var xx = 0; xx <= W; xx += 20) {
      var wx = xx + camX * Ly[0];
      ctx.lineTo(xx, Ly[2] - Math.abs(Math.sin(wx * Ly[4])) * Ly[3] - Math.sin(wx * Ly[4] * 2.3) * 12);
    }
    ctx.lineTo(W, H); ctx.fill();
  }
}

function drawPlayerFallback(p, t) {
  var cx = p.x + p.w / 2, d = p.dir, fy = p.y + p.h;
  ctx.save();
  if (p.roll >= 0) { // rolando
    ctx.translate(cx, p.y + p.h - 18); ctx.rotate(p.roll * 18 * d);
    ctx.fillStyle = "#7a4a2a"; ctx.fillRect(-16, -16, 32, 32); ctx.restore(); return;
  }
  var step = p.ground && p.vx !== 0 ? Math.sin(t * 16) * 6 : 0;
  ctx.fillStyle = "#2b2b44"; ctx.fillRect(cx - 9 + step, fy - 16, 7, 16); ctx.fillRect(cx + 2 - step, fy - 16, 7, 16);
  ctx.fillStyle = "#8c3b2a"; ctx.fillRect(cx - 12, fy - 36, 24, 22);
  ctx.fillStyle = "#e8b98a"; ctx.fillRect(cx - 8, fy - 48, 16, 14);
  ctx.fillStyle = "#d62f3d"; ctx.fillRect(cx - 9, fy - 50, 18, 5);
  ctx.fillStyle = "#111"; ctx.fillRect(cx + (d > 0 ? 2 : -5), fy - 44, 3, 3);
  // machado
  var ang = p.atk >= 0 ? (-1.4 + (p.atk / ATK_T) * 3.0) * d : -0.5 * d;
  ctx.translate(cx + d * 8, fy - 28); ctx.rotate(ang);
  ctx.fillStyle = "#6b4a2b"; ctx.fillRect(d > 0 ? 0 : -34, -2, 34, 4);
  ctx.fillStyle = "#c9d2dc"; ctx.fillRect(d > 0 ? 24 : -36, -10, 12, 20);
  ctx.restore();
}

function drawEnemyFallback(e) {
  ctx.fillStyle = e.flash > 0 ? "#ffffff" : "#3f7d4e";
  ctx.fillRect(e.x, e.y + 8, e.w, e.h - 8);
  ctx.fillRect(e.x + 4, e.y, e.w - 8, 12);
  ctx.fillStyle = "#ff3b3b";
  ctx.fillRect(e.x + (e.dir > 0 ? 18 : 4), e.y + 6, 6, 5);
  ctx.fillStyle = "#2a4f33"; ctx.fillRect(e.x, e.y + e.h - 6, e.w, 6);
}

function draw() {
  drawBg();
  var sx = shake > 0 ? (Math.random() - 0.5) * shake : 0, sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  ctx.save(); ctx.translate(-Math.round(camX) + sx, sy);
  var i, q;
  for (i = 0; i < plats.length; i++) {
    q = plats[i];
    if (q.x > camX + W || q.x + q.w < camX) continue;
    if (q.solid && T_TOP.ok && T_BODY.ok) {
      var tw = C.terreno.largura, th = Math.round(T_TOP.img.height * tw / T_TOP.img.width);
      var bh = Math.round(T_BODY.img.height * tw / T_BODY.img.width), top0 = q.y - C.terreno.sobra;
      ctx.fillStyle = "#1d1226"; ctx.fillRect(q.x, q.y + th - 10, q.w, q.h + 90);
      ctx.save(); ctx.beginPath(); ctx.rect(q.x, q.y - 40, q.w, q.h + 140); ctx.clip();
      for (var tx = q.x; tx < q.x + q.w; tx += tw) {
        ctx.drawImage(T_TOP.img, tx, top0, tw, th);
        for (var ty = top0 + th; ty < q.y + q.h + 80; ty += bh) ctx.drawImage(T_BODY.img, tx, ty, tw, bh);
      }
      ctx.restore();
    } else if (q.solid) {
      ctx.fillStyle = "#1d1830"; ctx.fillRect(q.x, q.y, q.w, q.h + 80);
      ctx.strokeStyle = "#2a2342"; ctx.lineWidth = 2; ctx.beginPath();
      for (var yy = q.y + 24; yy < q.y + q.h + 80; yy += 24) { ctx.moveTo(q.x, yy); ctx.lineTo(q.x + q.w, yy); }
      ctx.stroke();
      ctx.fillStyle = "#6a4fa8"; ctx.fillRect(q.x, q.y, q.w, 5);
    } else if (T_PLAT.ok) {
      ctx.drawImage(T_PLAT.img, q.x - 4, q.y - 8, q.w + 8, 30);
    } else {
      ctx.fillStyle = "#3b3060"; ctx.fillRect(q.x, q.y, q.w, q.h);
      ctx.fillStyle = "#8a6fd8"; ctx.fillRect(q.x, q.y, q.w, 3);
    }
  }
  // portal
  var pg = ctx.createRadialGradient(door.x + 23, door.y + 38, 4, door.x + 23, door.y + 38, 50);
  pg.addColorStop(0, "rgba(111,242,255,0.95)"); pg.addColorStop(1, "rgba(111,242,255,0)");
  ctx.fillStyle = pg; ctx.fillRect(door.x - 30, door.y - 20, 106, 120);
  ctx.fillStyle = "#0d2a33"; ctx.fillRect(door.x, door.y, door.w, door.h);
  ctx.fillStyle = "#6ff2ff"; ctx.fillRect(door.x + 6, door.y + 6, door.w - 12, door.h - 6);

  // moedas
  for (i = 0; i < coins.length; i++) {
    var c = coins[i], sz = C.moeda.tamanho;
    if (c.x < camX - 30 || c.x > camX + W + 30) continue;
    var bob = c.drop ? 0 : Math.sin(c.t * 4) * 3;
    if (!drawAnim(COINA, c.t, c.x, c.y + bob + sz / 2, 1, sz, sz)) {
      ctx.fillStyle = "#ffd34a"; ctx.beginPath(); ctx.arc(c.x, c.y + bob, 8, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#fff3b0"; ctx.fillRect(c.x - 3, c.y + bob - 5, 3, 6);
    }
  }
  // inimigos
  for (i = 0; i < enemies.length; i++) {
    var e = enemies[i];
    if (e.x < camX - 80 || e.x > camX + W + 80) continue;
    if (EA.andando.ok) {
      if (e.flash > 0) ctx.globalAlpha = 0.6;
      drawAnim(EA.andando, e.t, e.x + e.w / 2, e.y + e.h, e.dir, C.inimigo.largura, C.inimigo.altura);
      ctx.globalAlpha = 1;
    } else drawEnemyFallback(e);
    if (e.hp < C.inimigo.vida) {
      ctx.fillStyle = "#300"; ctx.fillRect(e.x - 2, e.y - 10, e.w + 4, 5);
      ctx.fillStyle = "#e23b4e"; ctx.fillRect(e.x - 2, e.y - 10, (e.w + 4) * e.hp / C.inimigo.vida, 5);
    }
  }
  // jogador
  if (state !== "dead") {
    var blink = pl.inv > 0 && pl.roll < 0 && Math.floor(pl.inv * 20) % 2 === 0;
    if (blink) ctx.globalAlpha = 0.4;
    if (pl.roll >= 0) ctx.globalAlpha = 0.75;
    var a = PA[pl.anim];
    if (!a || !a.ok) a = PA.parado;
    var prog = (a === PA[pl.anim]) ? (pl.anim === "ataque" ? pl.atk / ATK_T : (pl.anim === "rolando" ? pl.roll / ROLL_T : null)) : null;
    if (!drawAnim(a, pl.animT, pl.x + pl.w / 2, pl.y + pl.h, pl.dir, C.jogador.largura, C.jogador.altura, prog)) drawPlayerFallback(pl, pl.animT);
    ctx.globalAlpha = 1;
    // corte do machado
    if (pl.atk > 0.06 && pl.atk < 0.26) {
      var a0 = pl.dir > 0 ? -1.0 : Math.PI - 1.0;
      ctx.strokeStyle = "rgba(255,255,255," + (0.8 * (1 - (pl.atk - 0.06) / 0.2)) + ")";
      ctx.lineWidth = 6; ctx.beginPath();
      ctx.arc(pl.x + pl.w / 2 + pl.dir * 12, pl.y + pl.h / 2, 48, a0, a0 + 2); ctx.stroke();
    }
  }
  // partículas
  for (i = 0; i < parts.length; i++) {
    var p = parts[i]; ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s, p.s);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  drawHUD();
}

function text(s, x, y, size, color, align) {
  ctx.font = "bold " + size + "px monospace"; ctx.textAlign = align || "left";
  ctx.fillStyle = "#000"; ctx.fillText(s, x + 2, y + 2);
  ctx.fillStyle = color || "#fff"; ctx.fillText(s, x, y);
}
function drawHUD() {
  if (state === "menu") {
    ctx.fillStyle = "rgba(5,3,12,0.8)"; ctx.fillRect(0, 0, W, H);
    text("O MACHADEIRO", W / 2, 170, 56, "#ffd34a", "center");
    text("Mate os monstros, pegue moedas e chegue no portal!", W / 2, 220, 18, "#cfc6ff", "center");
    text("SETAS / A D  mover        ESPAÇO / W  pular", W / 2, 290, 18, "#fff", "center");
    text("J / X  machado          K / SHIFT  rolar (esquiva)", W / 2, 320, 18, "#fff", "center");
    text("S + pular  descer da plataforma fina", W / 2, 350, 18, "#fff", "center");
    if (Math.floor(Date.now() / 500) % 2) text("Aperte ENTER para começar", W / 2, 430, 24, "#6ff2ff", "center");
    return;
  }
  for (var i = 0; i < pl.maxHp; i++) {
    ctx.fillStyle = i < pl.hp ? "#e23b4e" : "#3a2a33"; ctx.fillRect(16 + i * 26, 16, 22, 22);
    ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(18 + i * 26, 18, 8, 4);
  }
  ctx.fillStyle = "#ffd34a"; ctx.beginPath(); ctx.arc(28, 62, 10, 0, 6.283); ctx.fill();
  text("x " + pl.coins, 46, 69, 22, "#ffd34a");
  text("Mortes: " + pl.kills, 16, 100, 16, "#c8ffb0");
  var prog = Math.min(1, pl.x / (LEVEL_W - 150));
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(W - 216, 16, 200, 10);
  ctx.fillStyle = "#6ff2ff"; ctx.fillRect(W - 216, 16, 200 * prog, 10);
  if (state === "dead") {
    ctx.fillStyle = "rgba(60,0,10,0.7)"; ctx.fillRect(0, 0, W, H);
    text("VOCÊ MORREU", W / 2, 240, 56, "#ff4b5c", "center");
    text("Moedas: " + pl.coins + "   Monstros: " + pl.kills, W / 2, 290, 22, "#fff", "center");
    text("ENTER para tentar de novo", W / 2, 350, 24, "#6ff2ff", "center");
  } else if (state === "win") {
    ctx.fillStyle = "rgba(0,30,40,0.75)"; ctx.fillRect(0, 0, W, H);
    text("VOCÊ VENCEU!", W / 2, 230, 56, "#6ff2ff", "center");
    text("Moedas: " + pl.coins + "   Monstros: " + pl.kills + "   Tempo: " + pl.time.toFixed(1) + "s", W / 2, 290, 22, "#fff", "center");
    text("ENTER para jogar outra fase", W / 2, 350, 24, "#ffd34a", "center");
  }
}

// ---------- loop ----------
var last = 0;
function frame(now) {
  var dt = Math.min(0.033, (now - last) / 1000 || 0.016); last = now;
  if (!pl) { newGame(); state = "menu"; }
  else if (pressed.Enter && state !== "play") newGame();
  if (state === "play") updatePlayer(dt);
  updateEnemies(dt); updateCoins(dt); updateParts(dt);
  shake = Math.max(0, shake - 40 * dt);
  var target = pl.x + pl.w / 2 - W / 2 + pl.dir * 60;
  camX += (target - camX) * Math.min(1, 6 * dt);
  camX = Math.max(0, Math.min(LEVEL_W - W, camX));
  draw();
  pressed = {};
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
