'use strict';
/* =========================================================================
   MONC'S SHOW — TV (host) + celular (controle)
   Uma única página: ?tv abre a TV, ?sala=ABCD abre o controle do celular.
   ========================================================================= */
const PARAMS = new URLSearchParams(location.search);
const LOCAL = PARAMS.has('local');         // testes: BroadcastChannel no mesmo navegador
const FAST = PARAMS.has('fast');
const LSX = PARAMS.get('p') || '';         // testes: separa o armazenamento de vários 'celulares' no mesmo navegador           // testes: acelera todos os tempos
const T = ms => FAST ? Math.max(15, Math.round(ms / 20)) : ms;
const SUPA_URL = '__SUPA_URL__';
const SUPA_KEY = '__SUPA_KEY__';

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n).toLocaleString('pt-BR');
const uid = () => Math.random().toString(36).slice(2, 10);
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#ec4899', '#14b8a6'];
const AVATARS = ['🐶', '🐱', '🦊', '🐼', '🐸', '🦁', '🐵', '🐧', '🦄', '🐙', '🐯', '🐨', '🤖', '👽', '🐲', '🦖'];
const MAX_PLAYERS = 8, STAR_PRICE = 20, START_COINS = 10, STEAL_PRICE = STAR_PRICE * 2;
const REWARDS = [10, 7, 5, 4, 3, 2, 2, 1];
const LEVEL_NAME = { f: 'Fácil', m: 'Médio', d: 'Difícil' };
const LIMIT = { f: 15000, m: 18000, d: 20000 };
const OPT_COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c'];
const OPT_SHAPES = ['▲', '◆', '●', '■'];

const ITEMS = {
  ink:    { n: 'Tinta',        e: '🦑', price: 5, target: true, d: 'Mancha a tela de um rival nas 3 primeiras perguntas do próximo quiz.' },
  freeze: { n: 'Congelar',     e: '🧊', price: 5, target: true, d: 'O rival fica 3s travado nas 3 primeiras perguntas do próximo quiz.' },
  hook:   { n: 'Gancho',       e: '🪝', price: 6, target: true, d: 'Rouba 6 moedas de um rival (10 se o alvo for o 1º colocado).' },
  shield: { n: 'Escudo',       e: '🛡️', price: 6, passive: true, d: 'Automático: bloqueia o próximo ataque que você sofrer.' },
  trap:   { n: 'Armadilha',    e: '🪤', price: 6, d: 'Fica na casa onde você está. Quem cair nela te paga 5 moedas.' },
  swap:   { n: 'Troca',        e: '🔄', price: 9, target: true, d: 'Troca de lugar no tabuleiro com um rival.' },
  gold:   { n: 'Dado de ouro', e: '🎯', price: 8, d: 'Você escolhe o número do dado (1 a 10).' },
  double: { n: 'Dado duplo',   e: '✌️', price: 7, d: 'Rola dois dados e soma os dois.' },
};
const ITEM_KEYS = Object.keys(ITEMS);

const DYNS = {
  speed:  { n: 'Velocidade',     e: '⚡', d: 'Cinco perguntas. Acertou rápido, ganhou mais pontos!' },
  most:   { n: 'Quem Sabe Mais', e: '🧠', d: 'Cinco perguntas. Vence quem acertar mais. Empate? Ganha o mais rápido.' },
  theme:  { n: 'Tema Fixo',      e: '🎯', d: 'A roleta escolhe o tema. Cinco perguntas do mesmo assunto!' },
  elim:   { n: 'Eliminação',     e: '💀', d: 'Errou, tá fora! O último que sobrar vence.' },
  number: { n: 'Chute Numérico', e: '🔢', d: 'Três perguntas de número. Vence quem chegar mais perto!' },
};
const LEVELS = {
  speed: ['f', 'f', 'm', 'm', 'd'],
  most:  ['f', 'm', 'm', 'd', 'd'],
  theme: ['f', 'f', 'm', 'm', 'd'],
  elim:  ['f', 'f', 'm', 'm', 'd', 'd', 'd', 'd'],
};

const SPACE = {
  S: { n: 'Início',   c: '#f8fafc', icon: '🏁' },
  B: { n: 'Azul',     c: '#2563eb', icon: '' },
  R: { n: 'Vermelha', c: '#dc2626', icon: '' },
  E: { n: 'Roleta',   c: '#16a34a', icon: '❓' },
  D: { n: 'Duelo',    c: '#ea580c', icon: '⚔️' },
  G: { n: 'Presente', c: '#db2777', icon: '🎁' },
  S2:{ n: 'Loja',     c: '#0d9488', icon: '🛒' },
  K: { n: 'Banco',    c: '#ca8a04', icon: '🏦' },
  V: { n: 'Vilão',    c: '#6d28d9', icon: '😈' },
  T: { n: 'Ladrão de Estrela', c: '#111827', icon: '🦹' },
};

/* =========================================================================
   TABULEIRO — 54 casas, 3 bifurcações e um retorno pelo centro
   ========================================================================= */
const JUNCTIONS = {
  J0: [100, 680, 'S'], J1: [520, 700, 'B'], J2: [960, 660, 'B'], J3: [1100, 380, 'B'],
  J4: [880, 120, 'B'], J5: [500, 110, 'B'], J6: [140, 300, 'B'],
};
// tipos: B azul, R vermelha, E roleta, D duelo, G presente, L loja, K banco, V vilão
const SEGS = [
  { f: 'J0', t: 'J1', ty: 'BEBRB', pts: [[100, 680], [200, 745], [310, 690], [420, 745], [520, 700]] },
  { f: 'J1', t: 'J2', ty: 'BGBDB', label: '🌊 Pela orla (mais longo, mais seguro)', pts: [[520, 700], [600, 765], [720, 745], [840, 770], [960, 660]] },
  { f: 'J1', t: 'J2', ty: 'RLRB', label: '🏪 Atalho do comércio (loja, mas arriscado)', pts: [[520, 700], [640, 640], [760, 600], [870, 620], [960, 660]] },
  { f: 'J2', t: 'J3', ty: 'BDEBR', pts: [[960, 660], [1080, 720], [1150, 600], [1080, 490], [1100, 380]] },
  { f: 'J3', t: 'J4', ty: 'BGBEB', label: '⛰️ Volta da serra (mais longo)', pts: [[1100, 380], [1160, 270], [1130, 150], [1010, 70], [880, 120]] },
  { f: 'J3', t: 'J4', ty: 'VRE', label: '🌑 Atalho sombrio (curto, mas tem vilão!)', pts: [[1100, 380], [980, 350], [900, 260], [880, 120]] },
  { f: 'J4', t: 'J5', ty: 'BRKBD', pts: [[880, 120], [790, 55], [690, 120], [590, 55], [500, 110]] },
  { f: 'J5', t: 'J6', ty: 'ETLBR', label: '⬅️ Seguir pela trilha', pts: [[500, 110], [400, 175], [290, 105], [190, 170], [140, 300]] },
  { f: 'J6', t: 'J0', ty: 'BDGB', pts: [[140, 300], [60, 390], [95, 500], [55, 600], [100, 680]] },
  { f: 'J5', t: 'J1', ty: 'REVBGB', label: '↩️ Retorno pelo centro', pts: [[500, 110], [470, 230], [570, 330], [450, 430], [560, 560], [520, 700]] },
];

function buildBoard() {
  const nodes = [], jIdx = {}, branch = {}, paths = [], seg = {};
  const typeOf = ch => ch === 'L' ? 'S2' : ch;
  for (const [k, [x, y, t]] of Object.entries(JUNCTIONS)) { jIdx[k] = nodes.length; nodes.push({ id: nodes.length, x, y, type: t, next: [], j: true }); }
  for (const s of SEGS) {
    const pts = s.pts, lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = lens[lens.length - 1], n = s.ty.length, ids = [];
    for (let i = 1; i <= n; i++) {
      const d = total * i / (n + 1);
      let k = 1; while (lens[k] < d) k++;
      const r = (d - lens[k - 1]) / (lens[k] - lens[k - 1]);
      const x = pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * r, y = pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * r;
      ids.push(nodes.length); nodes.push({ id: nodes.length, x: Math.round(x), y: Math.round(y), type: typeOf(s.ty[i - 1]), next: [] });
    }
    const chain = [jIdx[s.f], ...ids, jIdx[s.t]];
    for (let i = 0; i < chain.length - 1; i++) nodes[chain[i]].next.push(chain[i + 1]);
    if (s.label) branch[jIdx[s.f] + '>' + ids[0]] = s.label;
    seg[jIdx[s.f] + '>' + ids[0]] = chain;
    paths.push(chain);
  }
  return { nodes, branch, paths, seg, start: jIdx.J0 };
}
const BOARD = buildBoard();
const NODES = BOARD.nodes;

/* =========================================================================
   TRANSPORTE — Supabase Realtime (broadcast) ou BroadcastChannel local
   ========================================================================= */
function createTransport(room, onMsg, onStatus) {
  if (LOCAL || !window.supabase) {
    const bc = new BroadcastChannel('qp-' + room);
    bc.onmessage = e => onMsg(e.data);
    setTimeout(() => onStatus('ok'), 0);
    return { send: m => bc.postMessage(m) };
  }
  const sb = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 40 } },
  });
  let ch = null, okAt = 0, state = 'connecting';
  const join = () => {
    if (ch) sb.removeChannel(ch);
    ch = sb.channel('qp-' + room, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'm' }, ({ payload }) => onMsg(payload));
    ch.subscribe(st => {
      if (st === 'SUBSCRIBED') { state = 'ok'; okAt = Date.now(); onStatus('ok'); }
      else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') { state = 'err'; onStatus('err'); }
    });
  };
  join();
  let badSince = 0;
  setInterval(() => {   // vigia: se ficar fora por muito tempo, refaz a inscrição
    if (state === 'ok') { badSince = 0; return; }
    if (!badSince) badSince = Date.now();
    else if (Date.now() - badSince > 9000) { badSince = Date.now(); join(); }
  }, 3000);
  return { send: m => { try { ch && ch.send({ type: 'broadcast', event: 'm', payload: m }); } catch (e) { } } };
}

/* =========================================================================
   SOM (WebAudio) e VOZ (speechSynthesis)
   ========================================================================= */
const SFX = {
  ctx: null, on: true,
  init() { try { this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)(); this.ctx.resume(); } catch (e) { } },
  tone(f, d, type = 'sine', v = 0.12, delay = 0) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + d + 0.02);
  },
  step() { this.tone(660, 0.07, 'triangle', 0.08); },
  coin() { this.tone(988, 0.08, 'square', 0.06); this.tone(1319, 0.18, 'square', 0.06, 0.08); },
  lose() { this.tone(330, 0.15, 'sawtooth', 0.07); this.tone(220, 0.25, 'sawtooth', 0.07, 0.12); },
  dice() { this.tone(500 + rnd(500), 0.04, 'square', 0.04); },
  pop() { this.tone(880, 0.06, 'sine', 0.1); this.tone(1320, 0.08, 'sine', 0.08, 0.05); },
  ok() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.1, i * 0.08)); },
  bad() { this.tone(200, 0.35, 'sawtooth', 0.08); },
  tick() { this.tone(1200, 0.03, 'square', 0.04); },
  fanfare() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.11, i * 0.11)); },
  evil() { [196, 185, 175, 147].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.07, i * 0.18)); },
  whoosh() { for (let i = 0; i < 8; i++) this.tone(300 + i * 90, 0.05, 'sine', 0.05, i * 0.025); },
};

const Voice = {
  muted: false, voice: null,
  init() {
    if (!('speechSynthesis' in window)) return;
    const choose = () => {
      const vs = speechSynthesis.getVoices().filter(v => /pt[-_]?BR/i.test(v.lang));
      this.voice = vs.find(v => /natural|online/i.test(v.name)) || vs.find(v => /google/i.test(v.name)) || vs[0] || null;
    };
    choose(); speechSynthesis.onvoiceschanged = choose;
  },
};
let sayToken = 0;
function say(text, opt = {}) {
  const token = ++sayToken;
  const bubble = $('#bubble'), host = $('#host');
  if (bubble) { bubble.textContent = text; bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop'); }
  const spoken = String(text).replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
  const est = Math.min(10000, 700 + spoken.length * 62);
  return new Promise(res => {
    let done = false;
    const fin = () => { if (done) return; done = true; if (token === sayToken && host) host.classList.remove('talk'); res(); };
    if (host) host.classList.add('talk');
    if (FAST) { setTimeout(fin, 20); return; }
    if (Voice.muted || !('speechSynthesis' in window) || !spoken) { setTimeout(fin, opt.wait ? est * 0.55 : 900); return; }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(spoken);
      u.lang = 'pt-BR'; if (Voice.voice) u.voice = Voice.voice; u.rate = 1.08; u.pitch = 1.05;
      u.onend = fin; u.onerror = fin;
      speechSynthesis.speak(u);
    } catch (e) { }
    setTimeout(fin, est + 1500);
  });
}

/* =========================================================================
   TV — estado do jogo
   ========================================================================= */
let G = null, net = null, UIC = 0, GID = 0, connOK = false;
const pending = {};
const P = id => G.players.find(p => p.id === id);
const others = p => G.players.filter(o => o.id !== p.id);

function newGame(room) {
  return {
    room, phase: 'lobby', players: [], order: [], turn: 1, maxTurns: 10, pIdx: 0,
    star: null, bank: 5, traps: {}, cur: null, dynBag: [], lastDyn: null,
    used: {}, usedNum: [], rej: {}, seed: uid(),
  };
}

function setUI(p, ui) {
  ui.id = ++UIC;
  if (ui._ms) ui._dl = Date.now() + ui._ms;
  p.ui = ui; scheduleSync();
}
function waitUI(p, msg, sub) { setUI(p, { screen: 'wait', msg, sub }); }
function waitAll(msg, sub, except) { G.players.forEach(p => { if (!except || p.id !== except.id) waitUI(p, msg, sub); }); }

function ask(p, ui, ms, def, ack) {
  return new Promise(res => {
    if (ms) ui._ms = ms;
    setUI(p, ui);
    const myId = p.ui.id; let done = false, tm = null;
    const fin = v => { if (done) return; done = true; clearTimeout(tm); if (pending[p.id] && pending[p.id].uid === myId) delete pending[p.id]; res(v); };
    pending[p.id] = { uid: myId, ack, resolve: fin };
    if (ms) tm = setTimeout(() => { if (p.ui.id === myId) waitUI(p, '⏰ Tempo esgotado!'); fin(def); }, ms + 600);
  });
}

function collect(parts, makeUI, ms, onAnswer, ack = '✅ Resposta enviada!') {
  return new Promise(res => {
    const gid = ++GID, ans = {}; let finished = false, tm;
    const t0 = Date.now();
    const finish = () => {
      if (finished) return; finished = true; clearTimeout(tm);
      parts.forEach(p => { if (pending[p.id] && pending[p.id].gid === gid) delete pending[p.id]; });
      res(ans);
    };
    parts.forEach(p => {
      const ui = makeUI(p); ui._ms = ms; setUI(p, ui);
      pending[p.id] = {
        uid: p.ui.id, gid, ack, resolve: a => {
          if (finished) return;
          ans[p.id] = { a, t: Math.min(ms, Date.now() - t0) };
          const stop = onAnswer && onAnswer(p, ans[p.id], ans);
          if (stop || Object.keys(ans).length >= parts.length) finish();
        },
      };
    });
    tm = setTimeout(finish, ms + 700);
  });
}

let syncTimer = null, seq = 0;
function scheduleSync() { if (!syncTimer) syncTimer = setTimeout(() => { syncTimer = null; sendSync(); }, 50); }
function meOf(p) { return { name: p.name, emoji: p.emoji, color: p.color, coins: p.coins, stars: p.stars, items: p.items, rank: rankOf(p) }; }
function sendSync() {
  if (!G || !net) return;
  const now = Date.now(), ps = {};
  G.players.forEach(p => {
    const ui = Object.assign({}, p.ui);
    if (ui._dl) ui.left = Math.max(0, ui._dl - now);
    delete ui._dl; delete ui._ms;
    ps[p.id] = { ui, me: meOf(p) };
  });
  net.send({ t: 's', seq: ++seq, ph: G.phase, ps, rej: G.rej, taken: G.players.map(p => p.emoji) });
}

function onTVMsg(m) {
  if (!m || !G) return;
  if (m.t === 'join') return onJoin(m);
  const p = m.pid && P(m.pid);
  if (!p) return;
  p.lastSeen = Date.now();
  if (!p.online) { p.online = true; renderSide(); }
  if (m.t === 'hello') { scheduleSync(); return; }
  if (m.t === 'act') {
    const pend = pending[p.id];
    if (!pend || pend.uid !== m.uid) { scheduleSync(); return; }
    delete pending[p.id];
    waitUI(p, pend.ack || '✅ Recebido!');
    pend.resolve(m.a || {});
  }
}

function onJoin(m) {
  const name = String(m.name || '').trim().slice(0, 14) || 'Jogador';
  let p = P(m.pid);
  if (p) {
    p.online = true; p.lastSeen = Date.now();
    if (G.phase === 'lobby') { p.name = name; if (!G.players.some(o => o !== p && o.emoji === m.emoji) && AVATARS.includes(m.emoji)) p.emoji = m.emoji; }
    renderLobby(); renderSide(); scheduleSync(); return;
  }
  if (G.phase !== 'lobby') { G.rej[m.pid] = 'started'; scheduleSync(); return; }
  if (G.players.length >= MAX_PLAYERS) { G.rej[m.pid] = 'full'; scheduleSync(); return; }
  let emoji = AVATARS.includes(m.emoji) ? m.emoji : AVATARS[0];
  if (G.players.some(o => o.emoji === emoji)) emoji = AVATARS.find(a => !G.players.some(o => o.emoji === a));
  const color = COLORS.find(c => !G.players.some(o => o.color === c));
  delete G.rej[m.pid];
  p = {
    id: m.pid, name, emoji, color, node: BOARD.start, coins: START_COINS, stars: 0, items: [],
    online: true, lastSeen: Date.now(), debuff: { ink: 0, freeze: 0 },
    stats: { correct: 0, earned: 0, attacks: 0 }, ui: null,
  };
  G.players.push(p);
  setUI(p, { screen: 'lobby' });
  SFX.pop();
  say(pick([`${name} chegou na festa!`, `Que bom te ver, ${name}!`, `Olha só quem chegou: ${name}!`]));
  renderLobby();
}

setInterval(() => {    // marca quem está offline
  if (!G) return;
  let ch = false;
  G.players.forEach(p => { const on = Date.now() - (p.lastSeen || 0) < 16000; if (on !== p.online) { p.online = on; ch = true; } });
  if (ch) { renderSide(); renderLobby(); }
}, 4000);

function save() { try { localStorage.setItem('qp_tv', JSON.stringify({ G, ts: Date.now() })); } catch (e) { } }

/* ---------- moedas, itens, ranking ---------- */
function rankOf(p) {
  const s = G.players.slice().sort((a, b) => b.stars - a.stars || b.coins - a.coins);
  const i = s.findIndex(x => x.id === p.id);
  let r = i; while (r > 0 && s[r - 1].stars === p.stars && s[r - 1].coins === p.coins) r--;
  return r + 1;
}
function addCoins(p, n, silent) {
  const before = p.coins;
  p.coins = Math.max(0, p.coins + n);
  const d = p.coins - before;
  if (d > 0) p.stats.earned += d;
  if (d !== 0 && !silent) { floatText(p, (d > 0 ? '+' : '') + d + ' 🪙', d > 0 ? '#fde047' : '#fca5a5'); d > 0 ? SFX.coin() : SFX.lose(); }
  renderSide(); scheduleSync();
  return d;
}
function giveItem(p, k) {
  if (p.items.length >= 3) { addCoins(p, 3); return false; }
  p.items.push(k); renderSide(); scheduleSync(); return true;
}
function removeItem(p, k) { const i = p.items.indexOf(k); if (i >= 0) p.items.splice(i, 1); renderSide(); scheduleSync(); }
const finalStretch = () => G.turn > G.maxTurns - 3;
// quem está atrás tem mais chance de ganhar itens de ataque/recuperação; quem lidera, itens de defesa
const ITEM_W_BACK = { hook: 4, swap: 3, gold: 3, double: 3, ink: 2, freeze: 2, trap: 1, shield: 1 };
const ITEM_W_FRONT = { shield: 3, trap: 3, ink: 2, freeze: 2, hook: 1, double: 1, gold: 1, swap: 1 };
function randomItemFor(p) {
  const n = G.players.length, back = n > 1 && rankOf(p) > Math.ceil(n / 2);
  const W = back ? ITEM_W_BACK : ITEM_W_FRONT;
  let t = Math.random() * Object.values(W).reduce((a, b) => a + b, 0);
  for (const [k, w] of Object.entries(W)) { t -= w; if (t <= 0) return k; }
  return 'hook';
}

function placeStar(avoid) {
  const cands = NODES.filter(n => !n.j && n.type !== 'S' && n.id !== avoid && !G.traps[n.id]);
  const far = cands.filter(n => G.players.every(p => Math.hypot(NODES[p.node].x - n.x, NODES[p.node].y - n.y) > 160));
  G.star = pick(far.length ? far : cands).id;
}

/* =========================================================================
   TV — renderização
   ========================================================================= */
const BS = 1.15, BX = 24, BY = 104;   // escala e posição do tabuleiro no palco 1920x1080
const toStage = (x, y) => [BX + x * BS, BY + y * BS];

function fitStage() {
  const st = $('#stage'); if (!st) return;
  const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  st.style.transform = `translate(${(innerWidth - 1920 * s) / 2}px, ${(innerHeight - 1080 * s) / 2}px) scale(${s})`;
}

function stageMode(m) { const st = $('#stage'); st.className = 'mode-' + m; }

function hostSVG() {
  return `<svg viewBox="0 0 200 220" class="hostsvg" aria-hidden="true">
    <line x1="100" y1="34" x2="100" y2="8" stroke="#cbd5e1" stroke-width="5"/>
    <circle cx="100" cy="8" r="9" fill="#fde047" class="ant"/>
    <rect x="22" y="32" width="156" height="120" rx="34" fill="#7c3aed" stroke="#c4b5fd" stroke-width="6"/>
    <rect x="40" y="48" width="120" height="88" rx="22" fill="#1e1b4b"/>
    <g class="eyes"><ellipse cx="76" cy="84" rx="12" ry="15" fill="#fff"/><ellipse cx="124" cy="84" rx="12" ry="15" fill="#fff"/>
    <circle cx="78" cy="87" r="6" fill="#0f172a"/><circle cx="126" cy="87" r="6" fill="#0f172a"/></g>
    <rect class="mouth" x="82" y="108" width="36" height="12" rx="6" fill="#f472b6"/>
    <circle cx="52" cy="112" r="7" fill="#f472b6" opacity=".5"/><circle cx="148" cy="112" r="7" fill="#f472b6" opacity=".5"/>
    <path d="M70 158 L100 172 L70 186 Z M130 158 L100 172 L130 186 Z" fill="#ef4444"/><circle cx="100" cy="172" r="7" fill="#b91c1c"/>
    <rect x="62" y="186" width="76" height="30" rx="12" fill="#4c1d95"/>
  </svg>`;
}

function buildTV() {
  document.body.className = 'tv';
  document.body.innerHTML = `
  <div id="stage" class="mode-lobby">
    <div id="lobby"></div>
    <div id="game">
      <div id="topbar">
        <div class="logo">⭐ MONC'S SHOW</div>
        <div id="turninfo"></div>
        <div class="tb-right"><span id="roomtag"></span><span id="conn" class="conn"></span>
          <button id="mute" class="mini" title="Voz do apresentador">🔊</button><button id="sfxbtn" class="mini" title="Efeitos sonoros">🎵</button></div>
      </div>
      <div id="boardWrap"></div>
      <div id="side"><div id="plist"></div></div>
    </div>
    <div id="host"><div id="bubble">Olá! Eu sou o Pixel, o apresentador!</div>${hostSVG()}<div class="hostname">PIXEL</div></div>
    <div id="ov"></div>
    <div id="fx"></div>
  </div>`;
  fitStage(); addEventListener('resize', fitStage);
  $('#mute').onclick = () => { Voice.muted = !Voice.muted; $('#mute').textContent = Voice.muted ? '🔇' : '🔊'; if (Voice.muted) try { speechSynthesis.cancel(); } catch (e) { } };
  $('#sfxbtn').onclick = () => { SFX.on = !SFX.on; $('#sfxbtn').style.opacity = SFX.on ? 1 : .4; };
  buildBoardSVG();
}

function smoothPath(pts) {
  if (pts.length < 3) return `M${pts.map(p => p.join(',')).join(' L')}`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function buildBoardSVG() {
  const paths = BOARD.paths.map(ch => smoothPath(ch.map(i => [NODES[i].x, NODES[i].y])));
  const deco = [['🌴', 640, 470], ['🌴', 260, 470], ['🌊', 760, 790], ['⛰️', 1010, 220], ['🌲', 300, 300], ['🏝️', 820, 470], ['🌵', 990, 520], ['🌻', 200, 600], ['🍄', 380, 600], ['🌲', 1180, 760], ['🌲', 30, 160]];
  const nodesSVG = NODES.map(n => {
    const sp = SPACE[n.type], r = n.j ? 22 : 19;
    let label = sp.icon;
    let fs = 19;
    if (n.type === 'B') { label = '+3'; fs = 14; }
    if (n.type === 'R') { label = '−3'; fs = 14; }
    if (n.type === 'S') { label = '🏁'; }
    return `<g class="node t-${n.type}" data-id="${n.id}" transform="translate(${n.x},${n.y})">
      <circle r="${r + 4}" class="nshadow"/>
      <circle r="${r}" fill="${sp.c}" class="nbody"/>
      <circle r="${r - 5}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"/>
      <text class="nlabel" font-size="${fs}" fill="${n.type === 'S' ? '#0f172a' : '#fff'}">${label}</text></g>`;
  }).join('');
  $('#boardWrap').innerHTML = `<svg id="board" viewBox="0 0 1200 800">
    <defs>
      <radialGradient id="bgG" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#2dd4bf" stop-opacity=".22"/><stop offset="1" stop-color="#0f172a" stop-opacity="0"/></radialGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect x="4" y="4" width="1192" height="792" rx="40" fill="#14532d" stroke="#4ade80" stroke-opacity=".35" stroke-width="4"/>
    <rect x="4" y="4" width="1192" height="792" rx="40" fill="url(#bgG)"/>
    ${deco.map(([e, x, y]) => `<text x="${x}" y="${y}" font-size="34" opacity=".55" text-anchor="middle">${e}</text>`).join('')}
    <g class="centerlogo"><text x="735" y="400" text-anchor="middle" class="cl1">MONC'S</text><text x="735" y="452" text-anchor="middle" class="cl2">SHOW</text></g>
    ${paths.map(d => `<path d="${d}" class="road"/>`).join('')}
    ${paths.map(d => `<path d="${d}" class="road2"/>`).join('')}
    <g id="brG"></g>
    <g id="arrows"></g>
    ${nodesSVG}
    <g id="hl"></g><g id="traps"></g><g id="bankpot"></g><g id="starG"></g><g id="prevG"></g><g id="tokens"></g><g id="stepsG"></g>
  </svg>
  <div id="dicebox" class="hidden"></div>`;
  // setas de direção nas bifurcações
  const ar = [];
  NODES.forEach(n => n.next.forEach(nx => {
    const m = NODES[nx]; if (!n.j && !m.j && n.next.length === 1) return;
    const ang = Math.atan2(m.y - n.y, m.x - n.x) * 180 / Math.PI, mx = (n.x + m.x) / 2, my = (n.y + m.y) / 2;
    ar.push(`<path d="M-7,-7 L5,0 L-7,7" transform="translate(${mx},${my}) rotate(${ang})" class="arrow"/>`);
  }));
  $('#arrows').innerHTML = ar.join('');
}

const BR_COLORS = ['#22d3ee', '#fb923c', '#a3e635'];

// todas as casas onde o jogador pode cair andando `steps` casas a partir de `from`.
// ci = índice da opção escolhida na PRIMEIRA bifurcação encontrada (fb).
function dests(from, steps) {
  const list = []; let fb = null;
  const walk = (node, left, ci) => {
    if (left === 0) { list.push({ end: node, ci }); return; }
    const nx = NODES[node].next;
    if (nx.length > 1 && ci == null) fb = node;
    nx.forEach((id, i) => walk(id, left - 1, ci == null && nx.length > 1 ? i : ci));
  };
  walk(from, steps, null);
  const seen = new Set();
  return { fb, list: list.filter(d => { const k = d.end + ':' + d.ci; if (seen.has(k)) return false; seen.add(k); return true; }) };
}
function spaceDesc(id) {
  if (id === G.star) return '⭐ Estrela';
  const t = NODES[id].type, m = finalStretch() ? 2 : 1;
  const D = { B: `🔵 Azul (+${3 * m})`, R: `🔴 Vermelha (−${3 * m})`, S: '🏁 Início' };
  let s = D[t] || `${SPACE[t].icon} ${SPACE[t].n}`;
  if (G.traps[id] !== undefined) s += ' + 🪤 armadilha';
  return s;
}

/* ---------- efeitos visuais ---------- */
const pXY = p => toStage(...tokenPos(p));
const nXY = id => toStage(NODES[id].x, NODES[id].y);
function coinFlight(from, to, count) {
  count = Math.max(1, Math.min(12, count | 0));
  const fx = $('#fx');
  for (let i = 0; i < count; i++) {
    const c = document.createElement('div'); c.className = 'coinfly'; c.textContent = '🪙';
    c.style.left = from[0] + 'px'; c.style.top = from[1] + 'px'; fx.appendChild(c);
    const dx = to[0] - from[0], dy = to[1] - from[1], h = -110 - rnd(70), jx = (Math.random() - 0.5) * 50;
    const a = c.animate([
      { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 },
      { transform: `translate(-50%,-50%) translate(${dx / 2 + jx}px,${dy / 2 + h}px) scale(1.25)`, opacity: 1, offset: 0.5 },
      { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.7)`, opacity: 1 },
    ], { duration: T(800), delay: T(i * 90), easing: 'ease-in-out', fill: 'forwards' });
    a.onfinish = () => { c.remove(); SFX.tick(); };
  }
  return sleep(T(820 + count * 90));
}
function burst(xy, chars, n = 12, spread = 150, cls = '') {
  const fx = $('#fx');
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div'); d.className = 'particle ' + cls;
    d.textContent = Array.isArray(chars) ? pick(chars) : chars;
    d.style.left = xy[0] + 'px'; d.style.top = xy[1] + 'px'; fx.appendChild(d);
    const ang = Math.random() * Math.PI * 2, dist = spread * (0.5 + Math.random() * 0.6);
    d.animate([
      { transform: 'translate(-50%,-50%) scale(.3) rotate(0deg)', opacity: 1 },
      { transform: `translate(-50%,-50%) translate(${Math.cos(ang) * dist}px,${Math.sin(ang) * dist}px) scale(1.1) rotate(${rnd(360) - 180}deg)`, opacity: 0 },
    ], { duration: T(900 + rnd(400)), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }).onfinish = () => d.remove();
  }
}
function flash(xy, cls) {
  const d = document.createElement('div'); d.className = 'flash ' + cls;
  d.style.left = xy[0] + 'px'; d.style.top = xy[1] + 'px';
  $('#fx').appendChild(d); setTimeout(() => d.remove(), T(1200));
}
// anima peões em arco (usado na troca de lugar)
function arcTokens(moves) {
  moves.forEach(({ p, from, to }) => {
    const el = document.querySelector(`#tokens [data-p="${p.id}"]`); if (!el) return;
    const mx = (from[0] + to[0]) / 2, my = Math.min(from[1], to[1]) - 160;
    el.animate([
      { transform: `translate(${from[0]}px,${from[1]}px) scale(1)` },
      { transform: `translate(${mx}px,${my}px) scale(1.8)`, offset: 0.5 },
      { transform: `translate(${to[0]}px,${to[1]}px) scale(1)` },
    ], { duration: T(1100), easing: 'ease-in-out' });
  });
  return sleep(T(1100));
}

function tokenPos(p) {
  const same = G.players.filter(o => o.node === p.node);
  const i = same.indexOf(p), n = same.length, n0 = NODES[p.node];
  if (n <= 1) return [n0.x, n0.y - 4];
  const a = (i / n) * Math.PI * 2 - Math.PI / 2, r = 20;
  return [n0.x + Math.cos(a) * r, n0.y + Math.sin(a) * r];
}

function renderBoard() {
  if (!$('#tokens')) return;
  // estrela
  const sn = G.star != null ? NODES[G.star] : null;
  $('#starG').innerHTML = sn ? `<g transform="translate(${sn.x},${sn.y})"><g class="starmark"><circle r="30" fill="#fde047" opacity=".45" filter="url(#glow)"/><circle r="24" fill="#1e1b4b" stroke="#fde047" stroke-width="4"/><text font-size="34" text-anchor="middle" dy="12">⭐</text><text y="-36" class="starprice" text-anchor="middle">${STAR_PRICE} 🪙</text></g></g>` : '';
  // armadilhas
  $('#traps').innerHTML = Object.entries(G.traps).map(([nid, pid]) => { const n = NODES[nid], o = P(pid); return o ? `<g transform="translate(${n.x + 17},${n.y + 15})"><circle r="13" fill="${o.color}" stroke="#fff" stroke-width="2"/><text font-size="15" text-anchor="middle" dy="5">🪤</text></g>` : ''; }).join('');
  // banco
  const kn = NODES.find(n => n.type === 'K');
  $('#bankpot').innerHTML = `<g transform="translate(${kn.x},${kn.y + 44})"><rect x="-38" y="-15" width="76" height="28" rx="14" fill="#422006" stroke="#fde047" stroke-width="2"/><text text-anchor="middle" dy="6" class="bankt">🏦 ${G.bank}</text></g>`;
  // destaque do jogador da vez
  const cp = G.cur && P(G.cur);
  $('#hl').innerHTML = cp ? `<circle cx="${NODES[cp.node].x}" cy="${NODES[cp.node].y}" r="34" class="pulse" stroke="${cp.color}"/>` : '';
  // peões
  const tg = $('#tokens');
  G.players.forEach(p => {
    let el = tg.querySelector(`[data-p="${p.id}"]`);
    if (!el) {
      el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      el.setAttribute('data-p', p.id); el.classList.add('token');
      el.innerHTML = `<circle class="shieldb" r="27"/><circle r="17" fill="${p.color}" stroke="#fff" stroke-width="3"/><text font-size="20" text-anchor="middle" dy="7">${p.emoji}</text>
        <g class="inkb"><circle cx="-8" cy="-4" r="9"/><circle cx="7" cy="5" r="7"/><circle cx="9" cy="-9" r="4"/></g>
        <rect class="iceb" x="-23" y="-23" width="46" height="46" rx="9"/>`;
      tg.appendChild(el);
    }
    el.classList.toggle('has-shield', p.items.includes('shield'));
    el.classList.toggle('is-frozen', p.debuff.freeze > 0);
    el.classList.toggle('is-inked', p.debuff.ink > 0);
    const [x, y] = tokenPos(p);
    el.style.transform = `translate(${x}px, ${y}px) scale(${G.cur === p.id ? 1.3 : 1})`;
    if (G.cur === p.id) tg.appendChild(el);
  });
  // contador de passos sobre o peão da vez
  const sg = $('#stepsG');
  if (cp && G.steps > 0) {
    const [x, y] = tokenPos(cp);
    sg.innerHTML = `<g transform="translate(${x},${y - 46})" class="stepsbadge"><circle r="22"/><text dy="9">${G.steps}</text></g>`;
  } else sg.innerHTML = '';
  // bifurcação à frente (caminhos coloridos) e preview das casas de destino
  const pv = G.preview;
  let br = '', pr = '';
  if (pv && pv.fb != null) {
    const fbn = NODES[pv.fb];
    fbn.next.forEach((id, i) => {
      const chain = BOARD.seg[pv.fb + '>' + id]; if (!chain) return;
      const col = BR_COLORS[i % BR_COLORS.length];
      br += `<path d="${smoothPath(chain.map(k => [NODES[k].x, NODES[k].y]))}" class="brpath" stroke="${col}"/>`;
      const f = NODES[id], ang = Math.atan2(f.y - fbn.y, f.x - fbn.x);
      const lx = fbn.x + Math.cos(ang) * 52, ly = fbn.y + Math.sin(ang) * 52;
      br += `<g transform="translate(${lx},${ly})" class="brtag"><circle r="19" fill="${col}"/><text dy="8">${i + 1}</text></g>`;
    });
  }
  if (pv && cp) pv.list.forEach(d => {
    const n = NODES[d.end], col = d.ci == null ? '#fde047' : BR_COLORS[d.ci % BR_COLORS.length];
    pr += `<g transform="translate(${n.x},${n.y})" class="ghost"><circle r="31" class="ghostring" stroke="${col}"/><circle r="17" fill="${cp.color}" opacity=".45"/><text dy="7" font-size="20" text-anchor="middle" opacity=".7">${cp.emoji}</text>
      <g transform="translate(0,-44)"><rect x="-18" y="-16" width="36" height="28" rx="10" fill="${col}"/><text dy="5" font-size="16" text-anchor="middle">🎯</text></g></g>`;
  });
  $('#brG').innerHTML = br; $('#prevG').innerHTML = pr;
}

function renderSide() {
  if (!G || G.phase === 'lobby' || !$('#plist')) return;
  const list = G.order.length ? G.order.map(P).filter(Boolean) : G.players;
  $('#plist').innerHTML = list.map(p => `
    <div class="pcard ${G.cur === p.id ? 'cur' : ''} ${p.online ? '' : 'off'} ${p.items.includes('shield') ? 'shielded' : ''} ${p.debuff.freeze ? 'frozen' : ''} ${p.debuff.ink ? 'inked' : ''}" style="--pc:${p.color}">
      <div class="prank">${rankOf(p)}º</div>
      <div class="pav" style="background:${p.color}">${p.emoji}${p.items.includes('shield') ? '<span class="shbadge">🛡️</span>' : ''}</div>
      <div class="pinfo"><div class="pname">${esc(p.name)}${p.online ? '' : ' <span class="offtag">offline</span>'}</div>
        <div class="pitems">${p.items.map(k => `<span title="${ITEMS[k].n}">${ITEMS[k].e}</span>`).join('') || '<span class="none">sem itens</span>'}${p.debuff.ink ? '<span class="deb">🦑</span>' : ''}${p.debuff.freeze ? '<span class="deb">🧊</span>' : ''}</div></div>
      <div class="pstats"><div class="pstar">⭐ ${p.stars}</div><div class="pcoin">🪙 ${p.coins}</div></div>
    </div>`).join('');
  const ti = $('#turninfo');
  if (ti) ti.innerHTML = `<span class="turnpill">Turno <b>${Math.min(G.turn, G.maxTurns)}</b> de ${G.maxTurns}</span>${finalStretch() ? '<span class="finalpill">🔥 RETA FINAL — casas valem o dobro</span>' : ''}`;
  renderBoard();
}

function setConn(st) {
  connOK = st === 'ok';
  const c = $('#conn'); if (c) { c.className = 'conn ' + (connOK ? 'ok' : 'bad'); c.title = connOK ? 'Conectado' : 'Reconectando…'; }
  const lc = $('#lconn'); if (lc) lc.textContent = connOK ? '🟢 Sala online' : '🟠 Conectando…';
}

function floatText(p, text, color) {
  const [x, y] = toStage(...tokenPos(p));
  const d = document.createElement('div');
  d.className = 'floater'; d.textContent = text; d.style.left = x + 'px'; d.style.top = (y - 30) + 'px'; d.style.color = color;
  $('#fx').appendChild(d); setTimeout(() => d.remove(), 1800);
}

/* ---------- overlays ---------- */
function banner(emoji, title, sub, ms = 2600, cls = '') {
  const ov = $('#ov');
  const b = document.createElement('div');
  b.className = 'banner ' + cls;
  b.innerHTML = `<div class="bemoji">${emoji}</div><div><div class="btitle">${title}</div>${sub ? `<div class="bsub">${sub}</div>` : ''}</div>`;
  ov.appendChild(b);
  return sleep(T(ms)).then(() => { b.classList.add('out'); setTimeout(() => b.remove(), 400); });
}
function overlay(html, cls = '') {
  const ov = $('#ov');
  let o = $('#panel'); if (!o) { o = document.createElement('div'); o.id = 'panel'; ov.appendChild(o); }
  o.className = 'panel ' + cls; o.innerHTML = html; return o;
}
function closeOverlay() { const o = $('#panel'); if (o) o.remove(); }

/* =========================================================================
   TV — lobby
   ========================================================================= */
function joinURL() { return location.origin + location.pathname + '?sala=' + G.room + (LOCAL ? '&local' : '') + (FAST ? '&fast' : ''); }

function renderLobby() {
  if (!G || G.phase !== 'lobby') return;
  const L = $('#lobby');
  if (!L.dataset.built) {
    L.dataset.built = 1;
    L.innerHTML = `
      <div class="lob-left">
        <div class="biglogo"><span>⭐</span> MONC'S<br>SHOW</div>
        <div class="qrbox"><div id="qr"></div></div>
        <div class="joinhint">Aponte a câmera do celular para o QR code<br>ou entre com o código</div>
        <div class="roomcode">${G.room}</div>
        <div class="joinurl" id="joinurl"></div>
        <div id="lconn" class="lconn">🟠 Conectando…</div>
      </div>
      <div class="lob-right">
        <div class="lob-title">Jogadores <span id="pcount"></span></div>
        <div id="lplayers"></div>
        <div class="lob-cfg">
          <div class="cfg-label">Número de turnos</div>
          <div class="cfg-row"><button id="tminus" class="round">−</button><div id="tval"></div><button id="tplus" class="round">+</button></div>
          <div id="tdur" class="cfg-dur"></div>
        </div>
        <button id="startbtn" class="startbtn">▶ COMEÇAR O SHOW</button>
        <div class="lob-tip">Dica: clique em um jogador para removê-lo. Até 8 jogadores.</div>
      </div>`;
    const url = joinURL();
    $('#joinurl').textContent = url.replace(/^https?:\/\//, '');
    try { new QRCode($('#qr'), { text: url, width: 330, height: 330, colorDark: '#0f172a', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M }); }
    catch (e) { $('#qr').innerHTML = `<div style="padding:30px;color:#0f172a;font-size:22px;width:270px">QR indisponível.<br>Use o código abaixo.</div>`; }
    $('#tminus').onclick = () => { G.maxTurns = Math.max(10, G.maxTurns - 1); renderLobby(); };
    $('#tplus').onclick = () => { G.maxTurns = Math.min(20, G.maxTurns + 1); renderLobby(); };
    $('#startbtn').onclick = () => { if (G.players.length >= 2) startGame(); };
    $('#lplayers').onclick = e => {
      const c = e.target.closest('[data-pid]'); if (!c) return;
      const p = P(c.dataset.pid); if (!p) return;
      if (confirm(`Remover ${p.name} da sala?`)) { G.players = G.players.filter(x => x !== p); G.rej[p.id] = 'kicked'; renderLobby(); scheduleSync(); }
    };
  }
  $('#pcount').textContent = `${G.players.length}/${MAX_PLAYERS}`;
  $('#lplayers').innerHTML = Array.from({ length: MAX_PLAYERS }, (_, i) => {
    const p = G.players[i];
    return p ? `<div class="lp in ${p.online ? '' : 'off'}" data-pid="${p.id}" style="--pc:${p.color}"><div class="lpav" style="background:${p.color}">${p.emoji}</div><div class="lpname">${esc(p.name)}</div></div>`
      : `<div class="lp empty"><div class="lpav">?</div><div class="lpname">aguardando…</div></div>`;
  }).join('');
  $('#tval').textContent = G.maxTurns;
  const mins = Math.round(G.maxTurns * (1.6 + Math.max(2, G.players.length) * 0.45));
  $('#tdur').textContent = `≈ ${mins} min com ${Math.max(2, G.players.length)} jogadores`;
  const sb = $('#startbtn');
  sb.disabled = G.players.length < 2;
  sb.textContent = G.players.length < 2 ? 'Precisa de pelo menos 2 jogadores' : '▶ COMEÇAR O SHOW';
}

/* =========================================================================
   TV — fluxo principal do jogo
   ========================================================================= */
async function startGame() {
  SFX.init();
  G.phase = 'intro';
  G.order = shuffle(G.players.map(p => p.id));
  G.players.forEach(p => { p.node = BOARD.start; p.coins = START_COINS; p.stars = 0; p.items = []; p.debuff = { ink: 0, freeze: 0 }; p.stats = { correct: 0, earned: 0, attacks: 0 }; });
  G.turn = 1; G.pIdx = 0; G.traps = {}; G.bank = 5;
  placeStar();
  stageMode('board'); renderSide(); scheduleSync();
  waitAll('🎬 O show vai começar!', 'Olhe para a TV');
  SFX.fanfare();
  overlay(`<div class="intro"><div class="introT">QUE COMECE O SHOW!</div>
    <div class="introOrder">${G.order.map((id, i) => { const p = P(id); return `<div class="io" style="--pc:${p.color};animation-delay:${i * 0.15}s"><b>${i + 1}º</b><span class="lpav" style="background:${p.color}">${p.emoji}</span>${esc(p.name)}</div>`; }).join('')}</div>
    <div class="introRules">🎲 Role o dado e ande · ⭐ Passou pela estrela? Compre por ${STAR_PRICE} moedas · 🎤 No fim de cada turno tem quiz · 🏆 Vence quem tiver mais estrelas</div></div>`, 'center');
  await say(`Boa noite, boa noite! Eu sou o Pixel, e este é o Monc's Show! Serão ${G.maxTurns} turnos. Passou pela estrela, pode comprar por ${STAR_PRICE} moedas. E no fim de cada turno: quiz! A ordem foi sorteada. Boa sorte!`, { wait: true });
  await sleep(T(1200));
  closeOverlay();
  G.phase = 'turns'; save();
  gameLoop();
}

async function gameLoop() {
  try {
    while (G.turn <= G.maxTurns) {
      if (G.phase === 'turns') {
        if (G.pIdx === 0) await turnIntro();
        while (G.pIdx < G.order.length) {
          save();
          const p = P(G.order[G.pIdx]);
          if (p) await playerTurn(p);
          G.pIdx++;
        }
        G.phase = 'quiz';
      }
      if (G.phase === 'quiz') {
        save();
        G.cur = null; renderSide();
        await quizRound();
        G.turn++; G.pIdx = 0; G.phase = 'turns';
      }
    }
    G.phase = 'final'; save();
    await finale();
  } catch (e) {
    console.error(e);
    banner('⚠️', 'Ops, deu um erro', String(e && e.message || e), 6000);
  }
}

async function turnIntro() {
  stageMode('board'); renderSide();
  if (G.turn === G.maxTurns - 2) {
    SFX.fanfare();
    const last = G.players.slice().sort((a, b) => rankOf(b) - rankOf(a))[0];
    banner('🔥', 'RETA FINAL!', 'Faltam 3 turnos: casas azuis e vermelhas valem o DOBRO', 3800, 'hot');
    await say(`Atenção! Começou a reta final! Faltam só três turnos, e as casas azuis e vermelhas agora valem o dobro! E pra apimentar, ${last.name}, que está em último, ganha dez moedas de incentivo!`, { wait: true });
    addCoins(last, 10);
    await sleep(T(800));
  } else {
    if (G.turn > 1) await comebackBonus();
    banner('🎲', `TURNO ${G.turn} DE ${G.maxTurns}`, G.turn === G.maxTurns ? 'Último turno!' : '', 1800);
    await say(G.turn === G.maxTurns ? 'Último turno! É agora ou nunca!' : pick([`Turno ${G.turn}! Vamos nessa!`, `Começando o turno ${G.turn}!`, `Turno ${G.turn}. Quem vai brilhar?`]));
  }
}

async function comebackBonus() {
  const n = G.players.length; if (n < 2) return;
  const byRank = G.players.slice().sort((a, b) => rankOf(b) - rankOf(a));
  const ps = byRank.slice(0, n >= 4 ? 2 : 1).filter(p => rankOf(p) > 1);
  if (!ps.length) return;
  ps.forEach(p => addCoins(p, 3));
  await say(`Ajudinha da produção: ${ps.map(p => p.name).join(' e ')} ${ps.length > 1 ? 'ganham' : 'ganha'} três moedas pra correr atrás!`);
}

const usableItems = p => [...new Set(p.items)].filter(k => !ITEMS[k].passive && !(k === 'trap' && G.traps[p.node] !== undefined));

async function playerTurn(p) {
  G.cur = p.id; stageMode('board'); renderSide();
  waitAll(`${p.emoji} Vez de ${p.name}`, 'Acompanhe na TV', p);
  say(pick([`Vez de ${p.name}! Capricha nesse dado!`, `${p.name}, o tabuleiro é todo seu!`, `Bora, ${p.name}! Mostra quem manda!`, `${p.name}, sua vez! Sem pressão... mas todo mundo tá olhando.`]));
  let used = false, dice = 1, fixed = null;
  diceIdle(p, 1);
  for (;;) {
    const r = await ask(p, { screen: 'turn', items: used ? [] : usableItems(p), dice }, T(60000), { a: 'roll' }, '🎲 Rolando…');
    if (!r || r.a === 'roll') break;
    if (r.a === 'item' && !used && p.items.includes(r.k)) {
      diceHide();
      const res = await useItem(p, r.k);
      if (res === false) { diceIdle(p, dice); continue; }
      used = true; renderSide();
      if (res && res.fixed) { fixed = res.fixed; break; }
      if (res && res.dice) dice = res.dice;
      diceIdle(p, dice);
    }
  }
  const rolls = fixed ? [fixed] : Array.from({ length: dice }, () => 1 + rnd(10));
  const total = rolls.reduce((a, b) => a + b, 0);
  waitUI(p, `🎲 Você tirou ${total}!`, 'Andando…');
  await diceResult(rolls, !!fixed);
  say(total >= 9 ? pick([`${total}! Que dadada!`, `Uau, ${total} casas!`]) : total <= 2 ? pick([`Só ${total}... devagar e sempre.`, `${total}? Ai, ai, ai.`]) : `${total} casas!`);
  await move(p, total);
  diceHide();
  await land(p);
  renderSide();
  await sleep(T(700));
}

/* ---------- dado ---------- */
let diceTimer = null;
function diceIdle(p, n) {
  const db = $('#dicebox'); db.classList.remove('hidden');
  placeDice(p);
  db.innerHTML = `<div class="dwho" style="--pc:${p.color}">${p.emoji} ${esc(p.name)}</div><div class="dice-row">${Array.from({ length: n }, () => `<div class="die rolling">?</div>`).join('')}</div><div class="dhint">👆 Toque em <b>ROLAR</b> no celular</div>`;
  clearInterval(diceTimer);
  diceTimer = setInterval(() => { db.querySelectorAll('.die.rolling').forEach(d => d.textContent = 1 + rnd(10)); }, 90);
}
async function diceResult(rolls, fixed) {
  const db = $('#dicebox'); clearInterval(diceTimer);
  for (let i = 0; i < 10; i++) { db.querySelectorAll('.die').forEach(d => d.textContent = 1 + rnd(10)); SFX.dice(); await sleep(T(fixed ? 30 : 70)); }
  const dies = db.querySelectorAll('.die');
  rolls.forEach((r, i) => { if (dies[i]) { dies[i].textContent = r; dies[i].classList.remove('rolling'); dies[i].classList.add('done'); } });
  SFX.pop();
  const total = rolls.reduce((a, b) => a + b, 0);
  $('.dhint', db).innerHTML = rolls.length > 1 ? `Total: <b>${total}</b>` : fixed ? '🎯 Dado de ouro!' : '&nbsp;';
  await sleep(T(900));
}
function diceSteps(n) { const h = $('#dicebox .dhint'); if (h) h.innerHTML = `Faltam <b>${n}</b> casa${n === 1 ? '' : 's'}`; }
function diceHide() { clearInterval(diceTimer); $('#dicebox').classList.add('hidden'); }

/* ---------- movimento ---------- */
function setPreview(p, left) { G.steps = left; G.preview = left > 0 ? dests(p.node, left) : null; renderBoard(); placeDice(p); }

// coloca a caixa do dado no espaço livre mais longe do jogador e das casas de destino
const DICE_SPOTS = [[300, 470], [770, 430]];
function placeDice(p) {
  const db = $('#dicebox'); if (!db || !p) return;
  const pts = [[NODES[p.node].x, NODES[p.node].y]];
  if (G.preview) { G.preview.list.forEach(d => pts.push([NODES[d.end].x, NODES[d.end].y])); if (G.preview.fb != null) pts.push([NODES[G.preview.fb].x, NODES[G.preview.fb].y]); }
  let best = DICE_SPOTS[0], bd = -1;
  DICE_SPOTS.forEach(sp => { const d = Math.min(...pts.map(q => Math.hypot(q[0] - sp[0], q[1] - sp[1]))); if (d > bd) { bd = d; best = sp; } });
  db.style.left = best[0] * BS + 'px'; db.style.top = best[1] * BS + 'px';
}

async function move(p, steps) {
  let left = steps;
  setPreview(p, left);
  await sleep(T(900));            // dá tempo de ver onde pode cair
  while (left > 0) {
    diceSteps(left);
    const node = NODES[p.node];
    let nx = node.next[0];
    if (node.next.length > 1) {
      const pv = dests(p.node, left);
      const opts = node.next.map((id, i) => ({
        id, color: BR_COLORS[i % BR_COLORS.length],
        label: BOARD.branch[node.id + '>' + id] || 'Seguir',
        land: [...new Set(pv.list.filter(d => d.ci === i).map(d => d.end))],
      }));
      branchLegend(opts, left);
      say(`${p.name}, escolha o caminho!`);
      const r = await ask(p, { screen: 'choose', title: '🔀 Escolha o caminho', sub: `Faltam ${left} casas · as cores são as mesmas da TV`,
        opts: opts.map((o, i) => ({ label: `${i + 1} · ${o.label}`, sub: 'Você cai em: ' + o.land.map(spaceDesc).join(' ou '), color: o.color })) },
        T(25000), { i: rnd(opts.length) }, '👍 Caminho escolhido');
      nx = (opts[r && r.i] || opts[0]).id;
      waitUI(p, '🚶 Andando…');
    }
    p.node = nx; left--;
    SFX.step(); setPreview(p, left);
    await sleep(T(340));
    if (p.node === G.star) { await offerStar(p, left === 0); if (left === 0) p._onStar = true; }
    else if (left > 0 && NODES[p.node].type === 'K') bankPass(p);
  }
  diceSteps(0);
  G.steps = 0; G.preview = null; renderBoard();
}

function branchLegend(opts, left) {
  const h = $('#dicebox .dhint'); if (!h) return;
  h.innerHTML = `<div class="legend-t">🔀 Escolha no celular · faltam <b>${left}</b></div>` + opts.map((o, i) =>
    `<div class="legend" style="--bc:${o.color}"><span class="lg-n">${i + 1}</span><span class="lg-l">${esc(o.label)}</span><span class="lg-d">🎯 ${o.land.map(spaceDesc).join(' / ')}</span></div>`).join('');
}

function bankPass(p) {
  const v = Math.min(2, p.coins);
  if (v > 0) { coinFlight(pXY(p), nXY(p.node), v); addCoins(p, -v); G.bank += v; renderBoard(); }
}

async function offerStar(p, landing) {
  const sn = G.star;
  if (p.coins < STAR_PRICE) {
    SFX.lose();
    banner('⭐', `${p.name} passou pela estrela`, `Mas só tem ${p.coins} moedas… precisa de ${STAR_PRICE}`, 2200);
    await say(pick([`${p.name} passou pela estrela, mas cadê o dinheiro?`, `Ihh, ${p.name}, faltou grana pra estrela!`]), { wait: true });
    return;
  }
  say(`${p.name} chegou na estrela! Vai comprar?`);
  const r = await ask(p, { screen: 'choose', title: `⭐ Comprar uma estrela por ${STAR_PRICE} moedas?`, sub: `Você tem ${p.coins} moedas`, opts: [{ label: '⭐ Sim, comprar!' }, { label: 'Não, obrigado' }] }, T(20000), { i: 0 }, '⭐');
  if (r && r.i === 0) {
    await coinFlight(pXY(p), nXY(G.star), 8);
    addCoins(p, -STAR_PRICE, true); p.stars++;
    burst(nXY(G.star), ['⭐', '✨', '🌟'], 16, 180);
    SFX.fanfare(); floatText(p, '+1 ⭐', '#fde047');
    overlay(`<div class="starwin"><div class="sw-star">⭐</div><div class="sw-t">${esc(p.name)} ganhou uma estrela!</div><div class="sw-s">Agora tem ${p.stars} ⭐</div></div>`, 'center');
    await say(pick([`${p.name} comprou uma estrela! Que momento!`, `Estrela pra ${p.name}! A plateia vai à loucura!`]), { wait: true });
    await sleep(T(600));
    closeOverlay();
    placeStar(sn); renderSide();
    SFX.whoosh();
    banner('✨', 'A estrela mudou de lugar!', '', 1600);
    await sleep(T(900));
  } else {
    await say(`${p.name} recusou a estrela! Que coragem... ou que loucura?`);
  }
}

/* ---------- casas ---------- */
async function land(p) {
  const n = NODES[p.node];
  if (p._onStar) { delete p._onStar; return; }
  // armadilha
  const tr = G.traps[p.node];
  if (tr !== undefined && tr !== p.id) {
    const o = P(tr);
    delete G.traps[p.node]; renderBoard();
    if (o) {
      const v = Math.min(5, p.coins);
      SFX.lose();
      burst(pXY(p), ['🪤', '💥'], 10, 120); flash(pXY(p), 'boom');
      if (v) await coinFlight(pXY(p), pXY(o), v);
      addCoins(p, -v); addCoins(o, v);
      banner('🪤', `${p.name} caiu na armadilha de ${o.name}!`, `Pagou ${v} moedas`, 2400);
      await say(`Hahaha! ${p.name} caiu na armadilha de ${o.name}! Pagou ${v} moedas!`, { wait: true });
    }
  }
  const mult = finalStretch() ? 2 : 1;
  switch (n.type) {
    case 'B': {
      addCoins(p, 3 * mult);
      await say(pick([`Casa azul! ${p.name} ganhou ${3 * mult} moedas!`, `Moedinhas pra ${p.name}!`]));
      break;
    }
    case 'R': {
      const d = addCoins(p, -3 * mult);
      await say(d ? pick([`Casa vermelha! ${p.name} perdeu ${-d} moedas!`, `Ihh, casa vermelha. Que fase, ${p.name}!`]) : `Casa vermelha, mas ${p.name} já estava liso!`);
      break;
    }
    case 'E': await roulette(p); break;
    case 'D': await duel(p); break;
    case 'G': {
      const k = randomItemFor(p);
      SFX.pop();
      const ok = giveItem(p, k);
      banner('🎁', `${p.name} ganhou um presente!`, ok ? `${ITEMS[k].e} ${ITEMS[k].n}` : 'Mochila cheia: virou 3 moedas', 2400);
      await say(ok ? `Presente! ${p.name} ganhou: ${ITEMS[k].n}!` : `Presente! Mas a mochila de ${p.name} tá cheia. Leva três moedas!`, { wait: true });
      break;
    }
    case 'S2': await shop(p); break;
    case 'K': {
      const v = G.bank; if (v) await coinFlight(nXY(p.node), pXY(p), v); G.bank = 0; renderBoard();
      SFX.fanfare();
      addCoins(p, v);
      banner('🏦', `${p.name} caiu no banco!`, `Levou o acumulado: ${v} moedas`, 2600);
      await say(`Caiu no banco! ${p.name} leva tudo: ${v} moedas!`, { wait: true });
      break;
    }
    case 'V': await villain(p); break;
    case 'T': await thief(p); break;
    default: break;
  }
}

async function roulette(p) {
  const outs = [
    { l: '+6 moedas', e: '💰' }, { l: '−4 moedas', e: '💸' }, { l: 'Ganhe um item', e: '🎁' }, { l: 'Teleporte!', e: '🌀' },
    { l: 'Cada um te dá 2', e: '🤑' }, { l: 'Pergunta bônus', e: '❔' }, { l: 'Você dá 1 a cada um', e: '🎅' }, { l: '+3 moedas', e: '🪙' },
  ];
  const idx = rnd(outs.length);
  await spinWheel('🎡 ROLETA DA SORTE', outs.map(o => o.e + ' ' + o.l), idx, `${p.emoji} ${esc(p.name)}`);
  const o = outs[idx];
  closeOverlay();
  switch (idx) {
    case 0: addCoins(p, 6); await say(`Seis moedas pra ${p.name}!`, { wait: true }); break;
    case 1: addCoins(p, -4); await say(`Ai! ${p.name} perdeu quatro moedas!`, { wait: true }); break;
    case 2: { const k = randomItemFor(p); const ok = giveItem(p, k); SFX.pop(); banner(ITEMS[k].e, ok ? `${p.name} ganhou ${ITEMS[k].n}` : 'Mochila cheia: +3 moedas', '', 2000); await say(ok ? `${p.name} ganhou ${ITEMS[k].n}!` : `Mochila cheia! Três moedas então.`, { wait: true }); break; }
    case 3: {
      const dest = pick(NODES.filter(n => n.id !== p.node && n.id !== G.star)).id;
      SFX.whoosh(); p.node = dest; renderBoard();
      await say(`Teleporte! ${p.name} foi parar do outro lado do tabuleiro!`, { wait: true });
      break;
    }
    case 4: {
      let tot = 0; const fl = []; others(p).forEach(x => { const v = Math.min(2, x.coins); if (v) fl.push(coinFlight(pXY(x), pXY(p), v)); addCoins(x, -v, true); tot += v; }); await Promise.all(fl);
      addCoins(p, tot);
      await say(`Todo mundo paga duas moedas pra ${p.name}! Dói no bolso, né?`, { wait: true }); break;
    }
    case 5: {
      const q = drawQ(randTheme(), 'm');
      say(`Pergunta bônus pra ${p.name}! Acertou, leva oito moedas!`);
      const ans = await soloQuestion(p, q, '❔ Pergunta bônus (+8)');
      if (ans) { addCoins(p, 8); await say(`Acertou! Oito moedas!`, { wait: true }); }
      else { await say(`Errou! Fica pra próxima.`, { wait: true }); }
      break;
    }
    case 6: {
      others(p).forEach(x => { if (p.coins > 0) { addCoins(p, -1, true); addCoins(x, 1, true); } });
      SFX.lose(); renderSide();
      await say(`Espírito natalino! ${p.name} dá uma moeda pra cada jogador!`, { wait: true }); break;
    }
    case 7: addCoins(p, 3); await say(`Três moedinhas pra ${p.name}!`, { wait: true }); break;
  }
}

function spinWheel(title, labels, idx, who) {
  const n = labels.length, seg = 360 / n;
  const cols = ['#f43f5e', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];
  const R = 250;
  const slices = labels.map((l, i) => {
    const a0 = (i * seg - 90) * Math.PI / 180, a1 = ((i + 1) * seg - 90) * Math.PI / 180;
    const x0 = Math.cos(a0) * R, y0 = Math.sin(a0) * R, x1 = Math.cos(a1) * R, y1 = Math.sin(a1) * R;
    const am = (i + 0.5) * seg;
    return `<path d="M0,0 L${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1} Z" fill="${cols[i % cols.length]}" stroke="#fff" stroke-width="3"/>
      <text transform="rotate(${am}) translate(0,${-R + 28}) rotate(90)" class="wtext" text-anchor="start" dy="7">${esc(l)}</text>`;
  }).join('');
  overlay(`<div class="wheelbox"><div class="wtitle">${title}</div>${who ? `<div class="wwho">${who}</div>` : ''}
    <div class="wheelwrap"><svg viewBox="-270 -270 540 540" class="wheel"><g id="wheelG">${slices}</g><circle r="38" fill="#0f172a" stroke="#fde047" stroke-width="6"/><text class="wcenter" text-anchor="middle" dy="10">?</text></svg>
    <div class="wpointer">▼</div></div><div id="wres" class="wres"></div></div>`, 'center');
  const g = $('#wheelG');
  const final = 360 * 6 + (360 - (idx * seg + seg / 2)) + (Math.random() - 0.5) * seg * 0.5;
  g.style.transition = `transform ${T(3600)}ms cubic-bezier(.12,.75,.12,1)`;
  let ticks = 0; const ti = setInterval(() => { if (ticks++ < 25) SFX.tick(); else clearInterval(ti); }, T(120));
  requestAnimationFrame(() => requestAnimationFrame(() => { g.style.transform = `rotate(${final}deg)`; }));
  return sleep(T(3800)).then(async () => {
    clearInterval(ti); SFX.pop();
    const r = $('#wres'); if (r) r.textContent = labels[idx];
    await sleep(T(1300));
  });
}

async function shop(p) {
  say(`Bem-vindo à loja, ${p.name}! Vai levar alguma coisa?`);
  overlay(`<div class="shopbox"><div class="wtitle">🛒 LOJINHA</div><div class="wwho">${p.emoji} ${esc(p.name)} está comprando… (🪙 ${p.coins})</div>
    <div class="shopgrid">${ITEM_KEYS.map(k => `<div class="shopit"><span class="si-e">${ITEMS[k].e}</span><b>${ITEMS[k].n}</b><span class="si-p">${ITEMS[k].price} 🪙</span></div>`).join('')}</div></div>`, 'center');
  const full = p.items.length >= 3;
  const opts = ITEM_KEYS.map(k => ({ label: `${ITEMS[k].e} ${ITEMS[k].n} — ${ITEMS[k].price} 🪙`, sub: ITEMS[k].d, dis: full || p.coins < ITEMS[k].price }));
  opts.push({ label: '🚪 Sair da loja' });
  const r = await ask(p, { screen: 'choose', title: full ? '🛒 Loja (sua mochila está cheia!)' : `🛒 Loja — você tem ${p.coins} 🪙`, opts }, T(30000), { i: opts.length - 1 }, '🛍️');
  closeOverlay();
  const k = ITEM_KEYS[r && r.i];
  if (k && !full && p.coins >= ITEMS[k].price) {
    addCoins(p, -ITEMS[k].price, true); giveItem(p, k); SFX.coin();
    banner(ITEMS[k].e, `${p.name} comprou ${ITEMS[k].n}`, '', 2000);
    await say(`${p.name} comprou ${ITEMS[k].n}! Hum... alguém vai se dar mal.`, { wait: true });
  } else await say(`${p.name} só veio olhar a vitrine.`);
}

async function thief(p) {
  SFX.evil();
  const targets = others(p).filter(o => o.stars > 0);
  banner('🦹', 'ESCONDERIJO DO LADRÃO', `Por ${STEAL_PRICE} moedas, ${p.name} pode roubar uma estrela!`, 2600, 'hot');
  if (!targets.length || p.coins < STEAL_PRICE) {
    const lead = G.players.slice().sort((a, b) => rankOf(a) - rankOf(b)).find(o => o.id !== p.id && o.coins > 0);
    await say(!targets.length ? `Ninguém tem estrela pra roubar ainda! Mas o ladrão é camarada...` : `Sem ${STEAL_PRICE} moedas, ${p.name}? O ladrão é camarada...`, { wait: true });
    if (lead) {
      const v = Math.min(5, lead.coins);
      await coinFlight(pXY(lead), pXY(p), v); addCoins(lead, -v); addCoins(p, v);
      await say(`Ele afanou ${v} moedas de ${lead.name} e deu pra ${p.name}!`, { wait: true });
    }
    return;
  }
  say(`${p.name}, quer pagar ${STEAL_PRICE} moedas para roubar uma estrela? Escolha a vítima!`);
  const r = await ask(p, { screen: 'pick', title: `🦹 Roubar uma estrela por ${STEAL_PRICE} 🪙?`, sub: 'Escolha de quem roubar (o escudo não protege!)', opts: targets.map(o => ({ id: o.id, name: o.name, emoji: o.emoji, color: o.color, coins: o.coins, stars: o.stars })), cancel: true }, T(30000), null, '🦹');
  const v = r && r.id && P(r.id);
  if (!v || !targets.includes(v)) { await say(`${p.name} desistiu do roubo. A consciência falou mais alto!`, { wait: true }); return; }
  await coinFlight(pXY(p), nXY(p.node), 10);
  addCoins(p, -STEAL_PRICE, true);
  // estrela voando da vítima para o ladrão
  const st = document.createElement('div'); st.className = 'coinfly bigstar'; st.textContent = '⭐';
  const a0 = pXY(v), a1 = pXY(p); st.style.left = a0[0] + 'px'; st.style.top = a0[1] + 'px'; $('#fx').appendChild(st);
  st.animate([{ transform: 'translate(-50%,-50%) scale(.5)' }, { transform: `translate(-50%,-50%) translate(${(a1[0] - a0[0]) / 2}px,${(a1[1] - a0[1]) / 2 - 200}px) scale(2.4)`, offset: 0.5 }, { transform: `translate(-50%,-50%) translate(${a1[0] - a0[0]}px,${a1[1] - a0[1]}px) scale(1)` }], { duration: T(1500), easing: 'ease-in-out', fill: 'forwards' });
  SFX.whoosh(); await sleep(T(1500)); st.remove();
  v.stars--; p.stars++; p.stats.attacks++;
  burst(pXY(p), ['⭐', '✨'], 16, 170); SFX.fanfare(); renderSide(); scheduleSync();
  banner('🦹', `${p.name} roubou uma estrela de ${v.name}!`, `Pagou ${STEAL_PRICE} moedas`, 3000, 'hot');
  await say(`Que golpe! ${p.name} roubou uma estrela de ${v.name}! Isso vai dar briga!`, { wait: true });
}

async function villain(p) {
  SFX.evil();
  const outs = [
    { l: 'Perde 8 moedas', e: '💸' }, { l: 'Dá 5 ao último', e: '🎁' }, { l: 'Estrela muda', e: '⭐' },
    { l: 'Perde um item', e: '🗑️' }, { l: 'Troca c/ mais pobre', e: '🔁' }, { l: 'Volta ao início', e: '🏁' },
  ];
  say(`Hahaha! Você caiu na casa do vilão, ${p.name}! Vamos ver qual maldade eu preparei...`);
  $('#host').classList.add('evil');
  const idx = rnd(outs.length);
  await spinWheel('😈 CASA DO VILÃO', outs.map(o => o.e + ' ' + o.l), idx, `${p.emoji} ${esc(p.name)}`);
  closeOverlay();
  const lastP = G.players.slice().sort((a, b) => a.coins - b.coins)[0];
  switch (idx) {
    case 0: addCoins(p, -8); await say(`Oito moedas a menos! Muahaha!`, { wait: true }); break;
    case 1: {
      const lastR = G.players.slice().sort((a, b) => rankOf(b) - rankOf(a)).find(x => x.id !== p.id);
      const v = Math.min(5, p.coins); if (v) await coinFlight(pXY(p), pXY(lastR), v); addCoins(p, -v); addCoins(lastR, v);
      await say(`${p.name} dá ${v} moedas para ${lastR.name}! Robin Hood ao contrário... ou não!`, { wait: true }); break;
    }
    case 2: placeStar(G.star); SFX.whoosh(); renderBoard(); await say(`A estrela fugiu para outro lugar! Todo mundo vai ter que correr atrás!`, { wait: true }); break;
    case 3: {
      if (p.items.length) { const k = pick(p.items); removeItem(p, k); await say(`Lá se vai o seu ${ITEMS[k].n}!`, { wait: true }); }
      else { addCoins(p, -5); await say(`Sem itens? Então perde cinco moedas!`, { wait: true }); }
      break;
    }
    case 4: {
      if (lastP.id !== p.id) { await Promise.all([coinFlight(pXY(p), pXY(lastP), 6), coinFlight(pXY(lastP), pXY(p), 6)]); const a = p.coins, b = lastP.coins; p.coins = b; lastP.coins = a; SFX.whoosh(); floatText(p, '🔁', '#fff'); renderSide(); scheduleSync(); await say(`${p.name} trocou todas as moedas com ${lastP.name}! Que reviravolta!`, { wait: true }); }
      else { addCoins(p, -5); await say(`Você já é o mais pobre... então perde cinco moedas!`, { wait: true }); }
      break;
    }
    case 5: p.node = BOARD.start; SFX.whoosh(); renderBoard(); await say(`De volta para o início! Boa viagem, ${p.name}!`, { wait: true }); break;
  }
  $('#host').classList.remove('evil');
}

/* ---------- itens ---------- */
async function useItem(p, k) {
  const it = ITEMS[k];
  if (it.target) {
    const opts = others(p);
    const r = await ask(p, { screen: 'pick', title: `${it.e} ${it.n}: escolha o alvo`, sub: it.d, opts: opts.map(o => ({ id: o.id, name: o.name, emoji: o.emoji, color: o.color, coins: o.coins, stars: o.stars })), cancel: true }, T(30000), null, it.e);
    const v = r && r.id && P(r.id);
    if (!v || v.id === p.id) return false;
    removeItem(p, k); p.stats.attacks++;
    if (v.items.includes('shield')) {
      SFX.whoosh();
      const tok = document.querySelector(`#tokens [data-p="${v.id}"]`); if (tok) tok.classList.add('shield-hit');
      flash(pXY(v), 'shield'); burst(pXY(v), ['🛡️', '✨', '💥'], 14, 170);
      await sleep(T(700));
      if (tok) tok.classList.remove('shield-hit');
      removeItem(v, 'shield');
      SFX.pop();
      banner('🛡️', `${v.name} tinha ESCUDO!`, `O ${it.n} de ${p.name} foi bloqueado`, 2600);
      await say(`Bloqueado! ${v.name} tinha um escudo! ${p.name} perdeu o item à toa!`, { wait: true });
      return true;
    }
    switch (k) {
      case 'ink': SFX.whoosh(); burst(pXY(v), ['●', '●', '💧'], 18, 160, 'ink'); flash(pXY(v), 'ink'); v.debuff.ink = 3; renderSide(); banner('🦑', `${p.name} jogou tinta em ${v.name}!`, 'A tela vai ficar manchada no próximo quiz', 2600); await say(`Splash! ${p.name} jogou tinta em ${v.name}! Boa sorte enxergando as respostas!`, { wait: true }); break;
      case 'freeze': SFX.whoosh(); burst(pXY(v), ['❄️', '❄️', '🧊', '✨'], 18, 170); flash(pXY(v), 'ice'); v.debuff.freeze = 3; renderSide(); banner('🧊', `${p.name} congelou ${v.name}!`, '3 segundos travado no próximo quiz', 2600); await say(`Brrr! ${v.name} foi congelado por ${p.name}! Vai começar o quiz atrasado!`, { wait: true }); break;
      case 'hook': { const amt = Math.min(rankOf(v) === 1 ? 10 : 6, v.coins); burst(pXY(v), '🪝', 1, 10); if (amt) await coinFlight(pXY(v), pXY(p), amt); addCoins(v, -amt); addCoins(p, amt); banner('🪝', `${p.name} fisgou ${amt} moedas de ${v.name}!`, '', 2400); await say(`Gancho! ${p.name} roubou ${amt} moedas de ${v.name}!`, { wait: true }); break; }
      case 'swap': { const fp = tokenPos(p), fv = tokenPos(v); const a = p.node; p.node = v.node; v.node = a; SFX.whoosh(); renderBoard(); await arcTokens([{ p, from: fp, to: tokenPos(p) }, { p: v, from: fv, to: tokenPos(v) }]); burst(pXY(p), '✨', 8, 90); burst(pXY(v), '✨', 8, 90); banner('🔄', `${p.name} trocou de lugar com ${v.name}!`, '', 2400); await say(`Troca-troca! ${p.name} e ${v.name} trocaram de lugar!`, { wait: true }); break; }
    }
    renderSide(); return true;
  }
  if (k === 'trap') {
    if (G.traps[p.node] !== undefined) return false;
    removeItem(p, k); G.traps[p.node] = p.id; p.stats.attacks++; renderBoard(); burst(pXY(p), ['🪤', '✨'], 8, 90);
    banner('🪤', `${p.name} armou uma armadilha!`, 'Quem cair nessa casa paga 5 moedas', 2200);
    await say(`${p.name} deixou uma armadilha escondida... cuidado onde pisam!`);
    return true;
  }
  if (k === 'gold') {
    const r = await ask(p, { screen: 'choose', title: '🎯 Dado de ouro: escolha o número', grid: true, opts: Array.from({ length: 10 }, (_, i) => ({ label: String(i + 1) })), cancel: true }, T(30000), null, '🎯');
    if (!r || r.cancel || r.i == null) return false;
    removeItem(p, k);
    say(`${p.name} usou o dado de ouro!`);
    return { fixed: r.i + 1 };
  }
  if (k === 'double') {
    removeItem(p, k);
    banner('✌️', `${p.name} vai rolar dois dados!`, '', 1600);
    say(`Dado duplo! ${p.name} vai longe!`);
    return { dice: 2 };
  }
  return false;
}

/* ---------- duelo ---------- */
async function duel(p) {
  const os = others(p);
  SFX.fanfare();
  say(`Duelo! ${p.name}, escolha quem você vai desafiar!`);
  banner('⚔️', 'DUELO!', `${p.name} vai escolher um adversário`, 2200, 'hot');
  const r = await ask(p, { screen: 'pick', title: '⚔️ Escolha seu adversário', sub: 'Quiz relâmpago 1x1: quem acertar primeiro vence', opts: os.map(o => ({ id: o.id, name: o.name, emoji: o.emoji, color: o.color, coins: o.coins, stars: o.stars })) }, T(25000), { id: pick(os).id }, '⚔️');
  const o = (r && P(r.id) && r.id !== p.id) ? P(r.id) : pick(os);
  const maxBet = Math.min(p.coins, o.coins);
  const bets = [5, 10, 15].filter(b => b <= maxBet);
  let bet = 0;
  if (bets.length) {
    const rb = await ask(p, { screen: 'choose', title: `💰 Quanto apostar contra ${o.name}?`, sub: 'Quem vencer leva a aposta do outro', opts: bets.map(b => ({ label: `${b} moedas` })) }, T(20000), { i: 0 }, '💰');
    bet = bets[(rb && rb.i) || 0] || bets[0];
  }
  overlay(`<div class="vs"><div class="vsp" style="--pc:${p.color}"><div class="vsav" style="background:${p.color}">${p.emoji}</div>${esc(p.name)}</div>
    <div class="vsx">VS</div><div class="vsp" style="--pc:${o.color}"><div class="vsav" style="background:${o.color}">${o.emoji}</div>${esc(o.name)}</div>
    <div class="vsbet">${bet ? `Aposta: ${bet} 🪙` : 'Duelo pela honra (+3 🪙 ao vencedor)'}</div></div>`, 'center');
  await say(`${p.name} desafia ${o.name}! ${bet ? `Valendo ${bet} moedas!` : 'Valendo a honra!'} Quem acertar primeiro, vence!`, { wait: true });
  await sleep(T(600));
  let winner = null;
  for (let i = 0; i < 3 && !winner; i++) {
    const q = drawQ(randTheme(), i === 0 ? 'm' : pick(['m', 'd']));
    winner = await duelQuestion(p, o, q, i);
  }
  closeOverlay();
  if (winner) {
    const loser = winner === p ? o : p;
    SFX.fanfare();
    if (bet) { const v = Math.min(bet, loser.coins); if (v) await coinFlight(pXY(loser), pXY(winner), v); addCoins(loser, -v); addCoins(winner, v); }
    else addCoins(winner, 3);
    banner('🏆', `${winner.name} venceu o duelo!`, bet ? `Levou ${bet} moedas de ${loser.name}` : '+3 moedas', 2600);
    await say(pick([`${winner.name} venceu o duelo! ${loser.name}, vai ter revanche?`, `Vitória de ${winner.name}! Que duelo!`]), { wait: true });
  } else {
    banner('🤝', 'Empate!', 'Ninguém acertou. Cada um fica com o seu.', 2200);
    await say('Ninguém acertou! Empate técnico!', { wait: true });
  }
}

async function duelQuestion(a, b, q, n) {
  const parts = [a, b], wrong = new Set();
  let win = null;
  renderQuestionTV(q, { dyn: '⚔️ Duelo', n: n + 1, tot: 3, phase: 'read', parts, duel: true });
  parts.forEach(p => setUI(p, { screen: 'wait', msg: '👀 Leia a pergunta na TV', sub: q.q }));
  await say(q.q, { wait: true }); await sleep(T(300));
  const lim = LIMIT[q.lv];
  renderQuestionTV(q, { dyn: '⚔️ Duelo', n: n + 1, tot: 3, phase: 'ask', parts, lim, duel: true });
  const ans = await collect(parts, p => qUI(p, q, '⚔️ Duelo', n + 1, 3, false), lim, (p, x) => {
    if (x.a.i === q.correct) { win = p; return true; }
    wrong.add(p.id); SFX.bad(); markAnswered(p, true);
    return wrong.size >= 2;
  });
  renderQuestionTV(q, { dyn: '⚔️ Duelo', n: n + 1, tot: 3, phase: 'reveal', parts, ans, duel: true });
  if (win) { SFX.ok(); win.stats.correct++; }
  parts.forEach(p => setUI(p, resultUI(q, ans[p.id], win === p ? '🏆 Você venceu o duelo!' : win ? `${win.name} respondeu primeiro…` : null)));
  await sleep(T(2600));
  return win;
}

async function soloQuestion(p, q, label) {
  renderQuestionTV(q, { dyn: label, n: 1, tot: 1, phase: 'read', parts: [p] });
  setUI(p, { screen: 'wait', msg: '👀 Leia a pergunta na TV', sub: q.q });
  await say(q.q, { wait: true });
  const lim = LIMIT[q.lv];
  renderQuestionTV(q, { dyn: label, n: 1, tot: 1, phase: 'ask', parts: [p], lim });
  const ans = await collect([p], x => qUI(x, q, label, 1, 1, false), lim);
  renderQuestionTV(q, { dyn: label, n: 1, tot: 1, phase: 'reveal', parts: [p], ans });
  const ok = ans[p.id] && ans[p.id].a.i === q.correct;
  ok ? SFX.ok() : SFX.bad();
  if (ok) p.stats.correct++;
  setUI(p, resultUI(q, ans[p.id]));
  await sleep(T(2400));
  closeOverlay();
  return ok;
}

/* =========================================================================
   QUIZ
   ========================================================================= */
function randTheme(avoid) { return pick(Object.keys(QB).filter(t => t !== avoid)); }
function drawQ(theme, lv) {
  const key = theme + lv, bank = QB[theme][lv];
  let used = G.used[key] || [];
  if (used.length >= bank.length) used = [];
  const free = bank.map((_, i) => i).filter(i => !used.includes(i));
  const i = pick(free); used.push(i); G.used[key] = used;
  const [q, ...rest] = bank[i];
  const order = shuffle([0, 1, 2, 3]);
  return { q, th: theme, lv, opts: order.map(j => rest[j]), correct: order.indexOf(0) };
}
function drawNum() {
  if (G.usedNum.length >= NUMQ.length) G.usedNum = [];
  const free = NUMQ.map((_, i) => i).filter(i => !G.usedNum.includes(i));
  const i = pick(free); G.usedNum.push(i);
  const [q, a, unit] = NUMQ[i];
  return { q, a, unit };
}
function nextDyn() {
  if (!G.dynBag.length) {
    let bag = shuffle(Object.keys(DYNS));
    if (bag[0] === G.lastDyn) bag.push(bag.shift());
    G.dynBag = bag;
  }
  return G.dynBag.shift();
}
function qUI(p, q, dynLabel, n, tot, withFx = true) {
  const fx = withFx ? { freeze: p.debuff.freeze > 0 ? 3000 : 0, ink: p.debuff.ink > 0 } : {};
  return { screen: 'q', q: q.q, opts: q.opts, th: q.th, lv: q.lv, dyn: dynLabel, n, tot, fx };
}
function resultUI(q, a, extra) {
  const ok = a && a.a.i === q.correct;
  return { screen: 'res', ok: !!ok, none: !a, msg: extra || (ok ? pick(['✅ Acertou!', '✅ Mandou bem!', '✅ Na mosca!']) : a ? '❌ Errou!' : '⏰ Não respondeu'), sub: `Resposta: ${q.opts[q.correct]}` };
}

function markAnswered(p, wrong) {
  const el = document.querySelector(`#answered [data-p="${p.id}"]`);
  if (el) { el.classList.add('done'); if (wrong) el.classList.add('wrong'); }
}

function renderQuestionTV(q, s) {
  const th = THEMES[q.th];
  const parts = s.parts || [];
  const head = `<div class="qhead"><span class="qdyn">${s.dyn}</span><span class="qnum">Pergunta ${s.n} de ${s.tot}</span>
    <span class="qtheme" style="--tc:${th.color}">${th.emoji} ${th.name}</span><span class="qlv lv-${q.lv}">${LEVEL_NAME[q.lv]}</span></div>`;
  const optsHTML = q.opts.map((o, i) => {
    let who = '';
    if (s.phase === 'reveal' && s.ans) who = parts.filter(p => s.ans[p.id] && s.ans[p.id].a.i === i).map(p => `<span class="ow" style="background:${p.color}">${p.emoji}</span>`).join('');
    const cls = s.phase === 'reveal' ? (i === q.correct ? 'right' : 'wrongopt') : '';
    return `<div class="opt ${cls}" style="--oc:${OPT_COLORS[i]};animation-delay:${i * 0.08}s"><span class="oshape">${OPT_SHAPES[i]}</span><span class="otext">${esc(o)}</span><span class="owho">${who}</span></div>`;
  }).join('');
  const answered = `<div id="answered">${parts.map(p => {
    const a = s.ans && s.ans[p.id];
    const st = s.phase === 'reveal' ? (a && a.a.i === q.correct ? 'done ok' : 'done wrong') : '';
    return `<span data-p="${p.id}" class="ans ${st}" style="--pc:${p.color}">${p.emoji}</span>`;
  }).join('')}</div>`;
  const timer = s.phase === 'ask' ? `<div class="qtimer"><div class="qtbar" style="animation-duration:${s.lim}ms"></div></div>` : '<div class="qtimer"></div>';
  overlay(`<div class="quiz ${s.phase}">${head}<div class="qtext">${esc(q.q)}</div>${timer}
    <div class="opts ${s.phase === 'read' ? 'hiddenopts' : ''}">${optsHTML}</div>${answered}</div>`, 'quizpanel');
}

async function runChoiceQuestion(q, parts, n, tot, dynLabel, withFx) {
  renderQuestionTV(q, { dyn: dynLabel, n, tot, phase: 'read', parts });
  G.players.forEach(p => setUI(p, parts.includes(p) ? { screen: 'wait', msg: '👀 Leia a pergunta na TV', sub: q.q } : { screen: 'wait', msg: '💀 Você foi eliminado', sub: 'Torça (ou seque) pelos outros!' }));
  await say(q.q, { wait: true });
  await sleep(T(250));
  const lim = LIMIT[q.lv];
  renderQuestionTV(q, { dyn: dynLabel, n, tot, phase: 'ask', parts, lim });
  let ticker = setInterval(() => SFX.tick(), 1000);
  const ans = await collect(parts, p => qUI(p, q, dynLabel, n, tot, withFx), lim, p => { markAnswered(p); SFX.pop(); });
  clearInterval(ticker);
  if (withFx) parts.forEach(p => { if (p.debuff.ink > 0) p.debuff.ink--; if (p.debuff.freeze > 0) p.debuff.freeze--; });
  renderQuestionTV(q, { dyn: dynLabel, n, tot, phase: 'reveal', parts, ans });
  const okN = parts.filter(p => ans[p.id] && ans[p.id].a.i === q.correct);
  okN.length ? SFX.ok() : SFX.bad();
  parts.forEach(p => setUI(p, resultUI(q, ans[p.id])));
  const ansTxt = q.opts[q.correct];
  if (!okN.length) say(pick([`Ninguém acertou! A resposta era: ${ansTxt}.`, `Zero acertos! Era ${ansTxt}.`]));
  else if (okN.length === parts.length && parts.length > 1) say(pick([`Todo mundo acertou! Era ${ansTxt}.`, `Fácil demais! Todos acertaram.`]));
  else if (okN.length === 1 && parts.length > 2) say(`Só ${okN[0].name} acertou! Era ${ansTxt}.`);
  else say(`A resposta certa é: ${ansTxt}.`);
  await sleep(T(3300));
  return ans;
}

function renderScoresMini(sc, parts, dyn) {
  const list = rankRound(sc, parts, dyn);
  return `<div class="minisc">${list.map(x => `<div class="ms" style="--pc:${x.p.color}"><span>${x.place}º</span><span class="msav" style="background:${x.p.color}">${x.p.emoji}</span><b>${esc(x.p.name)}</b><span class="mspts">${dyn === 'speed' ? fmt(sc[x.p.id].pts) : sc[x.p.id].pts}${dyn === 'elim' && sc[x.p.id].out != null ? ' 💀' : ''}</span></div>`).join('')}</div>`;
}

function rankRound(sc, parts, dyn) {
  const key = p => { const s = sc[p.id]; return [dyn === 'elim' ? (s.out == null ? 1000 : s.out) : 0, s.pts, -s.time]; };
  const cmp = (a, b) => { const ka = key(a), kb = key(b); for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i]; return 0; };
  const sorted = parts.slice().sort(cmp);
  const out = []; let place = 1;
  sorted.forEach((p, i) => { if (i > 0 && cmp(sorted[i - 1], p) !== 0) place = i + 1; out.push({ p, place }); });
  return out;
}

async function quizRound() {
  stageMode('quiz');
  const dyn = nextDyn(); G.lastDyn = dyn;
  const D = DYNS[dyn], parts = G.players.slice();
  const sc = {}; parts.forEach(p => sc[p.id] = { pts: 0, time: 0, out: null });
  waitAll('🎤 Hora do quiz!', 'Olhe para a TV');
  SFX.fanfare();
  overlay(`<div class="dynintro"><div class="di-top">🎤 HORA DO QUIZ!</div><div class="di-e">${D.e}</div><div class="di-n">${D.n}</div><div class="di-d">${D.d}</div>
    <div class="di-r">Prêmios: 1º lugar ${REWARDS[0]} 🪙 + item à escolha · último lugar ganha um item surpresa</div></div>`, 'center');
  await say(pick([`Atenção, atenção! Hora do quiz! `, `Chegou a hora mais esperada: o quiz! `, `Larguem o dado e peguem o cérebro: hora do quiz! `]) + `Dinâmica: ${D.n}! ${D.d}`, { wait: true });
  await sleep(T(700));

  if (dyn === 'number') {
    for (let i = 0; i < 3; i++) await runNumberQuestion(drawNum(), parts, i + 1, 3, sc);
  } else {
    let theme = null;
    if (dyn === 'theme') {
      const keys = Object.keys(THEMES), idx = rnd(keys.length);
      await spinWheel('🎯 SORTEIO DO TEMA', keys.map(k => THEMES[k].emoji + ' ' + THEMES[k].name), idx);
      theme = keys[idx];
      await say(`O tema é: ${THEMES[theme].name}!`, { wait: true });
    }
    const lv = LEVELS[dyn]; let alive = parts.slice(), lastTh = null;
    for (let i = 0; i < lv.length; i++) {
      if (dyn === 'elim' && alive.length <= 1) break;
      const th = theme || randTheme(lastTh); lastTh = th;
      const q = drawQ(th, lv[i]);
      const ps = dyn === 'elim' ? alive : parts;
      const label = `${D.e} ${D.n}`;
      const ans = await runChoiceQuestion(q, ps, i + 1, lv.length, label, true);
      const lim = LIMIT[q.lv];
      const okP = ps.filter(p => ans[p.id] && ans[p.id].a.i === q.correct);
      ps.forEach(p => {
        const a = ans[p.id], ok = a && a.a.i === q.correct;
        if (ok) {
          p.stats.correct++;
          sc[p.id].pts += dyn === 'speed' ? 500 + Math.round(500 * Math.max(0, 1 - a.t / lim)) : 1;
          sc[p.id].time += a.t;
        }
      });
      if (dyn === 'elim') {
        if (okP.length) {
          const outNow = alive.filter(p => !okP.includes(p));
          outNow.forEach(p => sc[p.id].out = i);
          alive = okP;
          if (outNow.length) { SFX.lose(); banner('💀', `Eliminado${outNow.length > 1 ? 's' : ''}: ${outNow.map(p => p.name).join(', ')}`, `${alive.length} ainda na disputa`, 2000); await sleep(T(1200)); }
        } else { banner('😅', 'Ninguém acertou', 'Ninguém sai nessa rodada!', 1800); await sleep(T(1000)); }
      }
      overlay(`<div class="midscore"><div class="wtitle">${D.e} Parcial</div>${renderScoresMini(sc, parts, dyn)}</div>`, 'center');
      await sleep(T(i === lv.length - 1 ? 600 : 2200));
    }
  }
  await roundResults(dyn, sc, parts);
  G.players.forEach(p => { p.debuff.ink = 0; p.debuff.freeze = 0; });
  closeOverlay();
  stageMode('board'); renderSide();
}

async function runNumberQuestion(nq, parts, n, tot, sc) {
  const dynLabel = '🔢 Chute Numérico';
  const head = `<div class="qhead"><span class="qdyn">${dynLabel}</span><span class="qnum">Pergunta ${n} de ${tot}</span></div>`;
  overlay(`<div class="quiz read">${head}<div class="qtext">${esc(nq.q)}</div><div class="qtimer"></div><div class="numhint">Digite seu chute no celular!</div><div id="answered">${parts.map(p => `<span data-p="${p.id}" class="ans" style="--pc:${p.color}">${p.emoji}</span>`).join('')}</div></div>`, 'quizpanel');
  parts.forEach(p => setUI(p, { screen: 'wait', msg: '👀 Leia a pergunta na TV', sub: nq.q }));
  await say(nq.q, { wait: true });
  const lim = 25000;
  $('.quiz').classList.replace('read', 'ask');
  $('.qtimer').innerHTML = `<div class="qtbar" style="animation-duration:${lim}ms"></div>`;
  const ans = await collect(parts, () => ({ screen: 'num', q: nq.q, unit: nq.unit, n, tot, dyn: dynLabel }), lim, p => { markAnswered(p); SFX.pop(); });
  const rows = parts.map(p => ({ p, v: ans[p.id] ? Number(ans[p.id].a.v) : null, t: ans[p.id] ? ans[p.id].t : lim }))
    .map(r => ({ ...r, d: r.v == null || isNaN(r.v) ? Infinity : Math.abs(r.v - nq.a) }))
    .sort((a, b) => a.d - b.d || a.t - b.t);
  const answeredRows = rows.filter(r => r.d !== Infinity);
  let place = 0;
  answeredRows.forEach((r, i) => { if (i === 0 || r.d !== answeredRows[i - 1].d) place = i; const pts = answeredRows.length - place; sc[r.p.id].pts += pts; sc[r.p.id].time += r.t; r.pts = pts; });
  SFX.ok();
  overlay(`<div class="quiz reveal">${head}<div class="qtext small">${esc(nq.q)}</div>
    <div class="numans">Resposta: <b>${fmt(nq.a)}</b> ${esc(nq.unit)}</div>
    <div class="numrows">${rows.map((r, i) => `<div class="nr ${i === 0 && r.d !== Infinity ? 'best' : ''}" style="--pc:${r.p.color}"><span class="msav" style="background:${r.p.color}">${r.p.emoji}</span><b>${esc(r.p.name)}</b><span class="nrv">${r.v == null || isNaN(r.v) ? '—' : fmt(r.v)}</span><span class="nrd">${r.d === Infinity ? 'não respondeu' : r.d === 0 ? 'NA MOSCA! 🎯' : 'errou por ' + fmt(r.d)}</span><span class="nrp">${r.pts ? '+' + r.pts : ''}</span></div>`).join('')}</div></div>`, 'quizpanel');
  parts.forEach(p => { const r = rows.find(x => x.p === p); setUI(p, { screen: 'res', ok: r.d !== Infinity && r === rows[0], msg: r.d === Infinity ? '⏰ Não respondeu' : r.d === 0 ? '🎯 Na mosca!' : `Você chutou ${fmt(r.v)}`, sub: `Resposta: ${fmt(nq.a)} ${nq.unit}` + (r.pts ? ` · +${r.pts} pts` : '') }); });
  const best = rows[0];
  if (best && best.d !== Infinity) say(best.d === 0 ? `Na mosca! ${best.p.name} acertou em cheio: ${fmt(nq.a)}!` : `A resposta é ${fmt(nq.a)}! Quem chegou mais perto foi ${best.p.name}!`);
  else say(`A resposta era ${fmt(nq.a)}! Ninguém chutou?`);
  await sleep(T(4500));
}

async function roundResults(dyn, sc, parts) {
  const ranking = rankRound(sc, parts, dyn);
  const maxPlace = Math.max(...ranking.map(r => r.place));
  ranking.forEach(r => { r.reward = REWARDS[r.place - 1] ?? 1; });
  overlay(`<div class="results"><div class="wtitle">🏆 Resultado do quiz — ${DYNS[dyn].e} ${DYNS[dyn].n}</div>
    <div class="rrows">${ranking.map((r, i) => `<div class="rr" style="--pc:${r.p.color};animation-delay:${(ranking.length - i) * 0.25}s"><span class="rpl">${r.place}º</span><span class="msav" style="background:${r.p.color}">${r.p.emoji}</span><b>${esc(r.p.name)}</b>
      <span class="rpts">${dyn === 'speed' ? fmt(sc[r.p.id].pts) + ' pts' : dyn === 'number' ? sc[r.p.id].pts + ' pts' : sc[r.p.id].pts + ' acerto' + (sc[r.p.id].pts === 1 ? '' : 's')}</span>
      <span class="rrew">+${r.reward} 🪙</span><span class="ritem" id="ri-${r.p.id}"></span></div>`).join('')}</div></div>`, 'center');
  const win = ranking.filter(r => r.place === 1);
  await say(`Fim do quiz! ${win.length > 1 ? 'Empate no topo entre ' + win.map(w => w.p.name).join(' e ') : 'Quem venceu foi ' + win[0].p.name}! Todo mundo leva moedas de acordo com a colocação.`, { wait: true });
  ranking.forEach(r => addCoins(r.p, r.reward));
  await sleep(T(900));
  // 1º lugar escolhe item; último ganha item surpresa
  const picks = win.map(async r => {
    const p = r.p;
    if (p.items.length >= 3) { addCoins(p, 3); $('#ri-' + p.id) && ($('#ri-' + p.id).textContent = 'mochila cheia: +3 🪙'); return; }
    const choices = shuffle(ITEM_KEYS).slice(0, 3);
    const a = await ask(p, { screen: 'choose', title: '🏆 Você venceu! Escolha um item', opts: choices.map(k => ({ label: `${ITEMS[k].e} ${ITEMS[k].n}`, sub: ITEMS[k].d })) }, T(20000), { i: 0 }, '🎁');
    const k = choices[(a && a.i) || 0] || choices[0];
    giveItem(p, k); SFX.pop();
    const el = $('#ri-' + p.id); if (el) el.textContent = `${ITEMS[k].e} ${ITEMS[k].n}`;
  });
  G.players.filter(p => !win.some(w => w.p === p)).forEach(p => waitUI(p, '🏆 Vencedor escolhendo o item…'));
  if (maxPlace > 1) {
    ranking.filter(r => r.place === maxPlace).forEach(r => {
      const k = randomItemFor(r.p); const ok = giveItem(r.p, k);
      const el = $('#ri-' + r.p.id); if (el) el.textContent = ok ? `🎁 ${ITEMS[k].e} ${ITEMS[k].n}` : 'mochila cheia: +3 🪙';
    });
    const last = ranking.filter(r => r.place === maxPlace).map(r => r.p.name).join(' e ');
    say(`E ${last}, pra não ficar triste, ganha um item surpresa!`);
  }
  await Promise.all(picks);
  await sleep(T(2200));
}

/* ---------- final ---------- */
async function finale() {
  G.cur = null; stageMode('quiz'); renderSide();
  waitAll('🏁 Fim de jogo!', 'Olhe para a TV');
  SFX.fanfare();
  overlay(`<div class="dynintro"><div class="di-top">🏁 FIM DE JOGO!</div><div class="di-e">⭐</div><div class="di-n">Estrelas bônus</div><div class="di-d">Antes do resultado final, três estrelas bônus podem mudar tudo!</div></div>`, 'center');
  await say('Acabou! Mas calma, antes do resultado ainda temos três estrelas bônus que podem mudar tudo!', { wait: true });
  const bonuses = [
    { e: '🧠', n: 'Gênio', d: 'Quem mais acertou perguntas', f: p => p.stats.correct },
    { e: '💰', n: 'Magnata', d: 'Quem mais ganhou moedas no jogo', f: p => p.stats.earned },
    { e: '😈', n: 'Encrenqueiro', d: 'Quem mais usou itens nos outros', f: p => p.stats.attacks },
  ];
  for (const b of bonuses) {
    const best = Math.max(...G.players.map(b.f));
    const ws = best > 0 ? G.players.filter(p => b.f(p) === best) : [];
    overlay(`<div class="bonus"><div class="bo-e">${b.e}</div><div class="bo-n">Estrela ${b.n}</div><div class="bo-d">${b.d}</div><div class="bo-w" id="bow">🥁 …</div></div>`, 'center');
    await say(`Estrela ${b.n}: ${b.d}. E vai para...`, { wait: true });
    await sleep(T(900));
    SFX.fanfare();
    ws.forEach(p => p.stars++);
    $('#bow').innerHTML = ws.length ? ws.map(p => `<span class="bow1" style="--pc:${p.color}"><span class="msav" style="background:${p.color}">${p.emoji}</span>${esc(p.name)}</span>`).join('') + `<div class="bo-v">(${best})</div>` : 'Ninguém!';
    renderSide();
    await say(ws.length ? ws.map(p => p.name).join(' e ') + '!' : 'Ninguém!', { wait: true });
    await sleep(T(1200));
  }
  const ranking = G.players.slice().sort((a, b) => b.stars - a.stars || b.coins - a.coins);
  const podium = ranking.slice(0, 3);
  overlay(`<div class="final"><div class="fi-t">🏆 RESULTADO FINAL</div>
    <div class="podium">${[1, 0, 2].map(i => podium[i] ? `<div class="pod pod${i + 1} hide" id="pod${i}" style="--pc:${podium[i].color}"><div class="pav2" style="background:${podium[i].color}">${podium[i].emoji}</div><div class="pn">${esc(podium[i].name)}</div><div class="ps">⭐ ${podium[i].stars} · 🪙 ${podium[i].coins}</div><div class="pblock">${i + 1}º</div></div>` : '').join('')}</div>
    <div class="rest">${ranking.slice(3).map((p, i) => `<span class="rest1">${i + 4}º ${p.emoji} ${esc(p.name)} — ⭐ ${p.stars} · 🪙 ${p.coins}</span>`).join('')}</div>
    <button id="again" class="startbtn small">🔁 Jogar de novo</button></div>`, 'center');
  G.players.forEach(p => { const pl = rankOf(p); setUI(p, { screen: 'final', place: pl, stars: p.stars, coins: p.coins, msg: pl === 1 ? '🏆 VOCÊ VENCEU!' : pl === 2 ? '🥈 Segundo lugar!' : pl === 3 ? '🥉 Terceiro lugar!' : `${pl}º lugar` }); });
  for (const i of [2, 1, 0]) {
    if (!podium[i]) continue;
    await say(i === 0 ? "E o grande campeão do Monc's Show é..." : `Em ${i + 1}º lugar...`, { wait: true });
    await sleep(T(500));
    $('#pod' + i).classList.remove('hide'); i === 0 ? SFX.fanfare() : SFX.pop();
    await say(i === 0 ? `${podium[0].name}! Parabéns! Uma salva de palmas!` : podium[i].name + '!', { wait: true });
  }
  $('#again').onclick = () => {
    const room = G.room, ps = G.players, mt = G.maxTurns;
    G = newGame(room); G.maxTurns = mt;
    ps.forEach(p => { p.ui = null; G.players.push(p); setUI(p, { screen: 'lobby' }); });
    try { localStorage.removeItem('qp_tv'); } catch (e) { }
    closeOverlay(); $('#lobby').dataset.built = ''; stageMode('lobby'); renderLobby();
  };
  try { localStorage.removeItem('qp_tv'); } catch (e) { }
}

/* =========================================================================
   TV — inicialização
   ========================================================================= */
function makeRoom() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; return Array.from({ length: 4 }, () => A[rnd(A.length)]).join(''); }

function tvMain(resume) {
  buildTV(); Voice.init();
  if (resume) {
    G = resume; Object.keys(pending).forEach(k => delete pending[k]);
    UIC = Math.max(UIC, ...G.players.map(p => (p.ui && p.ui.id) || 0)) + 1000;
    G.players.forEach(p => { p.online = false; p.lastSeen = Date.now(); waitUI(p, '🔄 Retomando a partida…'); });
  } else G = newGame(makeRoom());
  $('#roomtag').textContent = 'Sala ' + G.room;
  net = createTransport(G.room, onTVMsg, setConn);
  setInterval(sendSync, 2500);
  document.addEventListener('click', () => SFX.init(), { once: true });
  if (resume) {
    stageMode('board'); renderSide();
    const go = () => { SFX.init(); say("E estamos de volta com o Monc's Show!"); gameLoop(); };
    overlay(`<div class="dynintro"><div class="di-top">🔄 Partida recuperada</div><div class="di-d">Peça para todos abrirem o jogo de novo no celular (mesmo link).<br>Turno ${G.turn} de ${G.maxTurns}.</div><button id="resumego" class="startbtn small">▶ Continuar</button></div>`, 'center');
    $('#resumego').onclick = () => { closeOverlay(); go(); };
  } else {
    stageMode('lobby'); renderLobby();
  }
}

/* =========================================================================
   CELULAR
   ========================================================================= */
const PH = { room: null, pid: null, name: '', emoji: '', joined: false, cur: { id: -1 }, me: null, dl: 0, pendingAct: null, taken: [], net: null, conn: false, tmr: null, lastMsg: 0 };

function phoneMain(room) {
  document.body.className = 'phone';
  PH.room = room.toUpperCase();
  const ls = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  PH.pid = ls('qp_pid_' + LSX + PH.room) || uid();
  try { localStorage.setItem('qp_pid_' + LSX + PH.room, PH.pid); } catch (e) { }
  PH.name = ls('qp_name' + LSX) || '';
  PH.emoji = ls('qp_emoji' + LSX) || pick(AVATARS);
  document.body.innerHTML = `<div id="pbar"></div><div id="pmain"></div>`;
  PH.net = createTransport(PH.room, onPhoneMsg, st => { PH.conn = st === 'ok'; renderBar(); if (PH.conn) PH.net.send({ t: 'hello', pid: PH.pid }); });
  const wasJoined = ls('qp_joined_' + LSX + PH.room) === '1';
  if (wasJoined && PH.name) { PH.joined = true; sendJoin(); showMsg('🔄 Reconectando…', 'Procurando a TV da sala ' + PH.room); }
  else renderJoin();
  setInterval(() => {
    if (PH.pendingAct && PH.pendingAct.uid === PH.cur.id) PH.net.send(PH.pendingAct.msg);
    else PH.pendingAct = null;
    if (PH.joined && !PH.me) sendJoin();
  }, 1300);
  setInterval(() => { if (PH.joined) PH.net.send({ t: 'hello', pid: PH.pid }); renderBar(); }, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { PH.net.send({ t: 'hello', pid: PH.pid }); keepAwake(); } });
}

let wakeLock = null;
async function keepAwake() { try { if ('wakeLock' in navigator && !document.hidden) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { } }

function sendJoin() { PH.net.send({ t: 'join', pid: PH.pid, name: PH.name, emoji: PH.emoji }); }

function renderJoin() {
  const main = $('#pmain');
  main.innerHTML = `<div class="pjoin">
    <div class="plogo">⭐ MONC'S<br>SHOW</div>
    <div class="proom">Sala <b>${esc(PH.room)}</b></div>
    <label class="plabel">Seu nome</label>
    <input id="nm" maxlength="14" placeholder="Digite seu nome" value="${esc(PH.name)}" autocomplete="off">
    <label class="plabel">Escolha seu personagem</label>
    <div id="avs" class="avs">${AVATARS.map(a => `<button class="av ${a === PH.emoji ? 'sel' : ''} ${PH.taken.includes(a) ? 'taken' : ''}" data-a="${a}">${a}</button>`).join('')}</div>
    <button id="go" class="pbig">ENTRAR NO SHOW 🎉</button>
  </div>`;
  $('#avs').onclick = e => { const b = e.target.closest('.av'); if (!b || b.classList.contains('taken')) return; PH.emoji = b.dataset.a; $('#avs').querySelectorAll('.av').forEach(x => x.classList.toggle('sel', x === b)); };
  $('#go').onclick = () => {
    const n = $('#nm').value.trim();
    if (!n) { $('#nm').focus(); $('#nm').classList.add('shake'); setTimeout(() => $('#nm').classList.remove('shake'), 500); return; }
    PH.name = n.slice(0, 14);
    try { localStorage.setItem('qp_name' + LSX, PH.name); localStorage.setItem('qp_emoji' + LSX, PH.emoji); localStorage.setItem('qp_joined_' + LSX + PH.room, '1'); } catch (e) { }
    PH.joined = true; keepAwake(); sendJoin();
    showMsg('⏳ Entrando…', PH.conn ? 'Falando com a TV' : 'Conectando à sala…');
  };
}

function onPhoneMsg(m) {
  if (!m || m.t !== 's') return;
  PH.lastMsg = Date.now();
  PH.taken = m.taken || [];
  if (!PH.joined) {
    $('#avs') && $('#avs').querySelectorAll('.av').forEach(b => b.classList.toggle('taken', PH.taken.includes(b.dataset.a) && b.dataset.a !== PH.emoji));
    return;
  }
  const rj = m.rej && m.rej[PH.pid];
  const mine = m.ps && m.ps[PH.pid];
  if (!mine) {
    if (rj) {
      PH.joined = false; try { localStorage.removeItem('qp_joined_' + LSX + PH.room); } catch (e) { }
      const msgs = { full: 'A sala está cheia (8 jogadores).', started: 'A partida já começou sem você.', kicked: 'Você foi removido da sala.' };
      showMsg('🚫 Não deu para entrar', msgs[rj] || '', true);
    }
    return;
  }
  PH.me = mine.me; renderBar();
  const ui = mine.ui;
  if (ui && ui.id !== PH.cur.id) {
    PH.cur = ui; PH.pendingAct = null;
    PH.dl = ui.left != null ? Date.now() + ui.left : 0;
    renderPhoneUI(ui);
  }
}

function renderBar() {
  const b = $('#pbar'); if (!b) return;
  const me = PH.me;
  const stale = PH.lastMsg && Date.now() - PH.lastMsg > 9000;
  const dot = `<span class="pdot ${PH.conn && !stale ? 'ok' : 'bad'}"></span>`;
  if (!me) { b.innerHTML = `<div class="pb-l">${dot} Sala ${esc(PH.room || '')}</div>`; return; }
  b.style.setProperty('--pc', me.color);
  b.innerHTML = `<div class="pb-l">${dot}<span class="pbav" style="background:${me.color}">${me.emoji}</span><b>${esc(me.name)}</b></div>
    <div class="pb-r"><span>${me.rank}º</span><span>⭐ ${me.stars}</span><span>🪙 ${me.coins}</span><span class="pbi">${(me.items || []).map(k => ITEMS[k] ? ITEMS[k].e : '').join('')}</span></div>`;
}

function showMsg(msg, sub, err) {
  $('#pmain').innerHTML = `<div class="pwait ${err ? 'err' : ''}"><div class="pw-msg">${esc(msg)}</div>${sub ? `<div class="pw-sub">${esc(sub)}</div>` : ''}${err ? `<button class="pbig" onclick="location.reload()">Tentar de novo</button>` : ''}</div>`;
}

function act(a) {
  const msg = { t: 'act', pid: PH.pid, uid: PH.cur.id, a };
  PH.pendingAct = { uid: PH.cur.id, msg };
  PH.net.send(msg);
  try { navigator.vibrate && navigator.vibrate(30); } catch (e) { }
}

function timerHTML() { return PH.dl ? `<div class="ptimer"><div class="ptbar"></div></div>` : ''; }
function startTimerBar(total) {
  clearInterval(PH.tmr);
  const bar = $('.ptbar'); if (!bar || !PH.dl) return;
  const tot = total || Math.max(1, PH.dl - Date.now());
  const upd = () => { const left = PH.dl - Date.now(); bar.style.width = Math.max(0, Math.min(100, left / tot * 100)) + '%'; if (left <= 0) clearInterval(PH.tmr); };
  upd(); PH.tmr = setInterval(upd, 100);
}

function renderPhoneUI(ui) {
  clearInterval(PH.tmr);
  const main = $('#pmain');
  const lock = () => main.querySelectorAll('button').forEach(b => b.disabled = true);
  switch (ui.screen) {
    case 'lobby':
      main.innerHTML = `<div class="pwait"><div class="pw-big" style="background:${PH.me.color}">${PH.me.emoji}</div><div class="pw-msg">Você está no show!</div><div class="pw-sub">Aguarde a TV começar a partida.<br>Deixe o volume da TV alto 😄</div></div>`;
      break;
    case 'wait':
      main.innerHTML = `<div class="pwait"><div class="pw-msg">${esc(ui.msg || '')}</div>${ui.sub ? `<div class="pw-sub">${esc(ui.sub)}</div>` : ''}</div>`;
      break;
    case 'turn': {
      try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch (e) { }
      main.innerHTML = `<div class="pturn"><div class="pt-t">🎲 SUA VEZ!</div>${timerHTML()}
        <button class="pbig roll" id="roll">${ui.dice > 1 ? '✌️ ROLAR 2 DADOS' : '🎲 ROLAR O DADO'}</button>
        ${ui.items && ui.items.length ? `<div class="pt-sub">ou use um item antes (1 por turno):</div><div class="plist">${ui.items.map(k => `<button class="pitem" data-k="${k}"><span class="pi-e">${ITEMS[k].e}</span><span><b>${ITEMS[k].n}</b><small>${ITEMS[k].d}</small></span></button>`).join('')}</div>` : ''}
      </div>`;
      $('#roll').onclick = () => { lock(); act({ a: 'roll' }); $('#roll').textContent = '🎲 Rolando…'; };
      main.querySelectorAll('.pitem').forEach(b => b.onclick = () => { lock(); act({ a: 'item', k: b.dataset.k }); });
      startTimerBar();
      break;
    }
    case 'pick':
      main.innerHTML = `<div class="pchoose"><div class="pc-t">${esc(ui.title)}</div>${ui.sub ? `<div class="pc-s">${esc(ui.sub)}</div>` : ''}${timerHTML()}
        <div class="plist">${ui.opts.map(o => `<button class="ppl" data-id="${o.id}" style="--pc:${o.color}"><span class="pbav" style="background:${o.color}">${o.emoji}</span><b>${esc(o.name)}</b><span class="ppl-s">⭐${o.stars} 🪙${o.coins}</span></button>`).join('')}</div>
        ${ui.cancel ? `<button class="pcancel" id="cx">Cancelar</button>` : ''}</div>`;
      main.querySelectorAll('.ppl').forEach(b => b.onclick = () => { lock(); b.classList.add('chosen'); act({ id: b.dataset.id }); });
      if (ui.cancel) $('#cx').onclick = () => { lock(); act({ cancel: true }); };
      startTimerBar();
      break;
    case 'choose':
      main.innerHTML = `<div class="pchoose"><div class="pc-t">${esc(ui.title)}</div>${ui.sub ? `<div class="pc-s">${esc(ui.sub)}</div>` : ''}${timerHTML()}
        <div class="plist ${ui.grid ? 'grid' : ''}">${ui.opts.map((o, i) => `<button class="popt ${o.color ? 'colored' : ''}" data-i="${i}" ${o.dis ? 'disabled' : ''} ${o.color ? `style="--bc:${o.color}"` : ''}><b>${esc(o.label)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`).join('')}</div>
        ${ui.cancel ? `<button class="pcancel" id="cx">Cancelar</button>` : ''}</div>`;
      main.querySelectorAll('.popt').forEach(b => b.onclick = () => { lock(); b.classList.add('chosen'); act({ i: +b.dataset.i }); });
      if (ui.cancel) $('#cx').onclick = () => { lock(); act({ cancel: true }); };
      startTimerBar();
      break;
    case 'q': {
      const th = THEMES[ui.th] || { emoji: '', name: '' };
      main.innerHTML = `<div class="pq"><div class="pq-h"><span>${esc(ui.dyn)} · ${ui.n}/${ui.tot}</span><span>${th.emoji} ${esc(th.name)} · ${LEVEL_NAME[ui.lv] || ''}</span></div>
        <div class="pq-q">${esc(ui.q)}</div>${timerHTML()}
        <div class="pq-opts">${ui.opts.map((o, i) => `<button class="pqo" data-i="${i}" style="--oc:${OPT_COLORS[i]}"><span class="pqs">${OPT_SHAPES[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
        <div id="fxl"></div></div>`;
      main.querySelectorAll('.pqo').forEach(b => b.onclick = () => { lock(); b.classList.add('chosen'); act({ i: +b.dataset.i }); });
      startTimerBar();
      const fx = ui.fx || {};
      if (fx.freeze) {
        lock();
        const ice = document.createElement('div'); ice.className = 'ice'; ice.innerHTML = `<div>🧊</div><div class="ice-n">3</div><div class="ice-t">Você foi congelado!</div>`;
        $('#fxl').appendChild(ice);
        let n = 3; const myId = ui.id;
        const iv = setInterval(() => { n--; if (PH.cur.id !== myId) { clearInterval(iv); return; } if (n <= 0) { clearInterval(iv); ice.remove(); main.querySelectorAll('.pqo').forEach(b => b.disabled = false); } else $('.ice-n', ice).textContent = n; }, 1000);
      }
      if (fx.ink) {
        const box = $('.pq-opts');
        for (let i = 0; i < 7; i++) {
          const s = document.createElement('div'); s.className = 'splat';
          s.style.left = (5 + Math.random() * 70) + '%'; s.style.top = (Math.random() * 75) + '%';
          s.style.width = s.style.height = (110 + Math.random() * 80) + 'px';
          s.style.transform = `rotate(${rnd(360)}deg)`;
          s.onclick = ev => { ev.stopPropagation(); s.classList.add('gone'); setTimeout(() => s.remove(), 250); };
          box.appendChild(s);
        }
        const tip = document.createElement('div'); tip.className = 'inktip'; tip.textContent = '🦑 Tinta! Toque nas manchas para limpar'; $('#fxl').appendChild(tip);
      }
      break;
    }
    case 'num': {
      let val = '';
      main.innerHTML = `<div class="pq"><div class="pq-h"><span>${esc(ui.dyn)} · ${ui.n}/${ui.tot}</span></div><div class="pq-q">${esc(ui.q)}</div>${timerHTML()}
        <div class="numdisp"><span id="nv">—</span> <small>${esc(ui.unit || '')}</small></div>
        <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, 'OK'].map(k => `<button class="key ${k === 'OK' ? 'ok' : ''}" data-k="${k}">${k}</button>`).join('')}</div></div>`;
      main.querySelector('.keypad').onclick = e => {
        const b = e.target.closest('.key'); if (!b || b.disabled) return;
        const k = b.dataset.k;
        if (k === '⌫') val = val.slice(0, -1);
        else if (k === 'OK') { if (!val) return; lock(); act({ v: Number(val) }); $('#nv').textContent = fmt(Number(val)) + ' ✓'; return; }
        else if (val.length < 7) val = (val + k).replace(/^0+(?=\d)/, '');
        $('#nv').textContent = val ? fmt(Number(val)) : '—';
      };
      startTimerBar();
      break;
    }
    case 'res':
      main.innerHTML = `<div class="pres ${ui.ok ? 'ok' : 'bad'}"><div class="pr-m">${esc(ui.msg)}</div><div class="pr-s">${esc(ui.sub || '')}</div></div>`;
      try { navigator.vibrate && navigator.vibrate(ui.ok ? 60 : [80, 50, 80]); } catch (e) { }
      break;
    case 'final':
      main.innerHTML = `<div class="pres final ${ui.place === 1 ? 'ok' : ''}"><div class="pr-big">${ui.place === 1 ? '🏆' : ui.place <= 3 ? ['', '', '🥈', '🥉'][ui.place] : '🎉'}</div><div class="pr-m">${esc(ui.msg)}</div><div class="pr-s">⭐ ${ui.stars} estrelas · 🪙 ${ui.coins} moedas</div><div class="pr-s">Valeu por jogar!</div></div>`;
      break;
    default:
      main.innerHTML = `<div class="pwait"><div class="pw-msg">…</div></div>`;
  }
}

/* =========================================================================
   INÍCIO
   ========================================================================= */
function homeMain() {
  document.body.className = 'phone home';
  let saved = null;
  try { const s = JSON.parse(localStorage.getItem('qp_tv') || 'null'); if (s && Date.now() - s.ts < 6 * 3600e3 && s.G && s.G.phase !== 'lobby') saved = s.G; } catch (e) { }
  document.body.innerHTML = `<div class="pjoin homebox">
    <div class="plogo">⭐ MONC'S<br>SHOW</div>
    <div class="psub">Jogo de tabuleiro + quiz para até 8 pessoas.<br>A TV mostra o show, cada um joga no celular.</div>
    <button class="pbig" id="tvbtn">📺 Abrir como TV (criar sala)</button>
    ${saved ? `<button class="pbig alt" id="resbtn">🔄 Continuar partida ${esc(saved.room)} (turno ${saved.turn})</button>` : ''}
    <div class="or">— ou —</div>
    <label class="plabel">Código da sala</label>
    <input id="code" maxlength="4" placeholder="ABCD" autocomplete="off" style="text-transform:uppercase;text-align:center;letter-spacing:.3em;font-size:28px">
    <button class="pbig alt" id="joinbtn">📱 Entrar pelo celular</button>
  </div>`;
  const keep = (LOCAL ? '&local' : '') + (FAST ? '&fast' : '');
  $('#tvbtn').onclick = () => { location.search = '?tv' + keep; };
  if (saved) $('#resbtn').onclick = () => { location.search = '?tv&resume' + keep; };
  $('#joinbtn').onclick = () => { const c = $('#code').value.trim().toUpperCase(); if (c.length === 4) location.search = '?sala=' + c + keep; };
}

window.addEventListener('DOMContentLoaded', () => {
  if (PARAMS.has('sala')) phoneMain(PARAMS.get('sala'));
  else if (PARAMS.has('tv')) {
    let resume = null;
    if (PARAMS.has('resume')) { try { const s = JSON.parse(localStorage.getItem('qp_tv') || 'null'); if (s && s.G) resume = s.G; } catch (e) { } }
    tvMain(resume);
  } else homeMain();
});
