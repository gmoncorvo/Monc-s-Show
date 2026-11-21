'use strict';
/* =========================================================================
   MONC'S SHOW — TV (host) + celular (controle)
   Uma única página: ?tv abre a TV, ?sala=ABCD abre o controle do celular.
   ========================================================================= */
const PARAMS = new URLSearchParams(location.search);
const LOCAL = PARAMS.has('local');         // testes: BroadcastChannel no mesmo navegador
const FAST = PARAMS.has('fast');
const LSX = PARAMS.get('p') || '';
const ONLINE = PARAMS.has('online');      // modo online: cada um no seu computador         // testes: separa o armazenamento de vários 'celulares' no mesmo navegador           // testes: acelera todos os tempos
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
// cores dos jogadores, cada uma com um símbolo (ajuda daltônicos)
const COLORS = ['#2A63E8', '#E5262B', '#2DBE4E', '#FFD000', '#8E44D9', '#FF8A1F', '#F2F2F2', '#1E1E22'];
const SYMS = { '#F2F2F2': '●', '#2A63E8': '▲', '#2DBE4E': '■', '#FFD000': '★', '#8E44D9': '◆', '#FF8A1F': '✚', '#E5262B': '♥', '#1E1E22': '⬢' };
const symOf = p => SYMS[p.color] || '●';
const AVATARS = ['🐶', '🐱', '🦊', '🐼', '🐸', '🦁', '🐵', '🐧', '🦄', '🐙', '🐯', '🐨', '🤖', '👽', '🐲', '🦖'];
const MAX_PLAYERS = 8, STAR_PRICE = 20, START_COINS = 10, STEAL_PRICE = 40;
const DECIDE = 30000;      // tempo de cada decisão (rolar, caminho, Moncrofone, loja, duelo)
const REWARDS = [10, 7, 5, 4, 3, 2, 2, 1];
const LEVEL_NAME = { f: 'Fácil', m: 'Médio', d: 'Difícil' };
const LIMIT = { f: 15000, m: 18000, d: 20000 };
const OPT_COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c'];
const OPT_SHAPES = ['▲', '◆', '●', '■'];
// nomes do show
const MC = 'Moncoins', STAR = 'Moncrofone', STARS = 'Moncrofones', HOST = 'Monc';
const COIN = '🪙', MIC = '🎤';
const mc = n => `${n} ${n === 1 ? 'Moncoin' : 'Moncoins'}`;
const mics = n => `${n} ${n === 1 ? STAR : STARS}`;
// tempo de leitura antes das alternativas: 2 s + 0,25 s por palavra, até 7 s
const readMs = q => T(Math.min(7000, 2000 + 250 * String(q).trim().split(/\s+/).length));

// itens em 4 níveis
const TIERS = {
  low:   { n: 'Baixo',     price: 5,  c: '#22c55e' },
  mid:   { n: 'Médio',     price: 7,  c: '#3b82f6' },
  high:  { n: 'Alto',      price: 12, c: '#f59e0b' },
  risky: { n: 'Arriscado', price: 8,  c: '#e11d48' },
};
const ITEMS = {
  ink:      { tier: 'low',  n: 'Tinta',        e: '🦑', target: true, d: 'Mancha a tela de um rival nas 3 primeiras perguntas do próximo Monquiz.' },
  hook:     { tier: 'low',  n: 'Gancho',       e: '🪝', target: true, d: 'Rouba 6 Moncoins de um rival (10 se ele estiver em 1º e você não).' },
  trap:     { tier: 'low',  n: 'Armadilha',    e: '🪤', d: 'Fica escondida na sua casa. Quem cair nela te paga 5 Moncoins.' },
  ear:      { tier: 'low',  n: 'Ponto Eletrônico', e: '🎧', quiz: true, d: 'No próximo Monquiz, elimina 1 alternativa errada em 3 perguntas suas.' },
  freeze:   { tier: 'mid',  n: 'Congelar',     e: '🧊', target: true, d: 'No próximo Monquiz, os botões do rival ficam no gelo: cada um quebra com 7 toques.' },
  shield:   { tier: 'mid',  n: 'Escudo',       e: '🛡️', passive: true, d: 'Automático: bloqueia o próximo ataque (Tinta, Gancho, Congelar, Troca, Contrato).' },
  double:   { tier: 'mid',  n: 'Dado Duplo',   e: '✌️', d: 'Rola dois dados e soma os dois.' },
  cut:      { tier: 'mid',  n: 'Corta!',       e: '🎬', passive: true, d: 'Automático: anula a próxima casa ruim (vermelha, lava, armadilha, maldade do Diretor…).' },
  gold:     { tier: 'high', n: 'Dado de Ouro', e: '🎯', d: 'Você escolhe o número do dado (1 a 10).' },
  swap:     { tier: 'high', n: 'Troca',        e: '🔄', target: true, d: 'Troca de lugar no tabuleiro com um rival.' },
  retake:   { tier: 'high', n: 'Regravar!',    e: '📼', quiz: true, d: 'No próximo Monquiz, um erro seu vira acerto (na Eliminação, te salva uma vez).' },
  contract: { tier: 'high', n: 'Contrato de Exclusividade', e: '📜', target: true, d: 'Rouba um item aleatório de um rival à sua escolha.' },
  allin:    { tier: 'risky', n: 'Tudo ou Nada', e: '🎰', quiz: true, d: 'Ficou em 1º no próximo Monquiz? Prêmio TRIPLO. Qualquer outra posição: perde 6.' },
  crazy:    { tier: 'risky', n: 'Dado Maluco',  e: '🤪', d: 'Dado de −3 a 12. Pode te fazer andar para trás!' },
  lottery:  { tier: 'risky', n: 'Sorteio da Produção', e: '🎟️', d: 'Troca TODOS os seus Moncoins com um jogador sorteado.' },
  box:      { tier: 'risky', n: 'Caixa Misteriosa', e: '📦', d: '50%: ganha 1 item de qualquer nível. 50%: dá 3 Moncoins a cada jogador.' },
};
const ITEM_KEYS = Object.keys(ITEMS);
const priceOf = k => TIERS[ITEMS[k].tier].price;
const itemsOfTier = t => ITEM_KEYS.filter(k => ITEMS[k].tier === t);
const ATTACKS = ['ink', 'hook', 'freeze', 'swap', 'contract'];   // o Escudo bloqueia estes

const DYNS = {
  speed:   { n: 'Velocidade',     e: '⚡', d: 'Cinco perguntas. Acertou rápido, ganhou mais pontos!' },
  most:    { n: 'Quem Sabe Mais', e: '🧠', d: 'Cinco perguntas. Vence quem acertar mais. Empate? Ganha o mais rápido.' },
  theme:   { n: 'Tema Fixo',      e: '🎯', d: 'A roleta escolhe o tema. Cinco perguntas do mesmo assunto!' },
  elim:    { n: 'Eliminação',     e: '💀', d: 'Errou, tá fora! Quem sobrar por último vence.' },
  number:  { n: 'Chute Numérico', e: '🔢', d: 'Três perguntas de número. Vence quem chegar mais perto!' },
  pick:    { n: 'Escolha do Competidor', e: '🙋', d: 'Um jogador sorteado escolhe o tema das cinco perguntas!' },
  bank:    { n: 'Banca do Apresentador', e: '🎲', d: 'Antes de cada pergunta, aposte de 1 a 5 Moncoins de verdade. Acertou, ganha o dobro!' },
  tf:      { n: 'Verdadeiro ou Falso Relâmpago', e: '✅', d: 'Dez afirmações, onze segundos cada. Verdadeiro ou falso? Responda rápido!' },
  hilo:    { n: 'Mais ou Menos',  e: '↕️', d: 'O Monc diz um número. A resposta certa é maior ou menor?' },
  potato:  { n: 'Batata Quente',  e: '🥔', d: 'Só quem está com a batata responde. Acertou, passa pra quem quiser. Errou, fica com uma batata!' },
  clock:   { n: 'Contra o Relógio', e: '⏱️', d: 'Quarenta segundos para acertar o máximo. Errou? Fica dois segundos travado!' },
};
const DYN_KEYS = Object.keys(DYNS);
const LEVELS = {
  speed: ['f', 'f', 'm', 'm', 'd'],
  most:  ['f', 'm', 'm', 'd', 'd'],
  theme: ['f', 'f', 'm', 'm', 'd'],
  pick:  ['f', 'f', 'm', 'm', 'd'],
  bank:  ['f', 'm', 'm', 'd', 'd'],
  elim:  ['f', 'f', 'm', 'm', 'd', 'd', 'd', 'd'],
  potato: ['f', 'f', 'f', 'm', 'm', 'm', 'd', 'd'],
};
// itens ganhos no Monquiz conforme a colocação (do 1º ao último)
const PLACE_ITEMS = {
  2: ['high', 'risky'], 3: ['high', 'mid', 'risky'], 4: ['high', 'mid', 'low', 'risky'],
  5: ['high', 'mid', 'low', 'low', 'risky'], 6: ['high', 'mid', 'low', 'low', 'low', 'risky'],
  7: ['high', 'mid', 'mid', 'low', 'low', 'low', 'risky'], 8: ['high', 'mid', 'mid', 'low', 'low', 'low', 'low', 'risky'],
};
// filtro "10+" (jogar com crianças): obras 18+, violência, morte como tema
const KID_BLOCK = /GTA|God of War|Resident Evil|Last of Us|Mortal Kombat|Fatality|Counter-Strike|terroristas|Assassin|assassin|Hitman|Game of Thrones|Casa Stark|morreu|morte|Breaking Bad|Walter White|Pulp Fiction|Joaquin Phoenix|Cidade de Deus|Dadinho|Tropa de Elite|Capitão Nascimento|Round 6|jogo mortal|La Casa de Papel|assaltantes|Narcos|droga|suic/;
const isYearQ = nq => /\bano\b/i.test(nq.q);
const fmtA = (nq, v) => isYearQ(nq) ? String(v) : fmt(v);   // anos sem ponto de milhar

const SPACE = {
  S: { n: 'Início',   c: '#f8fafc', icon: '🏁' },
  B: { n: 'Azul',     c: '#2563eb', icon: '' },
  R: { n: 'Vermelha', c: '#dc2626', icon: '' },
  E: { n: 'Roleta',   c: '#16a34a', icon: '❓' },
  D: { n: 'Duelo',    c: '#ea580c', icon: '⚔️' },
  G: { n: 'Presente', c: '#db2777', icon: '🎁' },
  S2:{ n: 'Loja',     c: '#0d9488', icon: '🛒' },
  K: { n: 'Banco',    c: '#ca8a04', icon: '🏦' },
  V: { n: 'Diretor',  c: '#6d28d9', icon: '📣' },
  T: { n: 'Ladrão de Moncrofone', c: '#111827', icon: '🦹' },
  I: { n: 'Gelo escorregadio', c: '#bae6fd', icon: '🧊', dark: true },
  C: { n: 'Teleférico', c: '#334155', icon: '🚡' },
  A: { n: 'Avalanche', c: '#f1f5f9', icon: '🏔️', dark: true },
  F: { n: 'Lava', c: '#f97316', icon: '🔥' },
  Y: { n: 'Gêiser', c: '#0e7490', icon: '💨' },
  Z: { n: 'Erupção', c: '#7f1d1d', icon: '🌋' },
};

/* =========================================================================
   MAPAS — cada mapa tem junções (bifurcações), trechos e um tema visual
   Tipos de casa: B azul, R vermelha, E roleta, D duelo, G presente, L loja,
   K banco, V diretor, T ladrão · Neve: I gelo, C teleférico, A avalanche
   · Vulcão: F lava, Y gêiser, Z erupção
   ========================================================================= */
const MAPS = {
  forest: {
    name: 'Floresta', emoji: '🌳', desc: 'O clássico: orla, serra e um retorno pelo centro.',
    theme: { fill: '#14532d', stroke: '#4ade80', glow: '#2dd4bf', road: '#fef3c7', road2: '#d6b98c', arrow: '#78350f' },
    logo: [735, 420], dice: [[300, 470], [770, 430]],
    deco: [['🌴', 640, 470], ['🌴', 260, 470], ['🌊', 760, 790], ['⛰️', 1010, 220], ['🌲', 300, 300], ['🏝️', 820, 470], ['🌵', 990, 520], ['🌻', 200, 600], ['🍄', 380, 600], ['🌲', 1180, 760], ['🌲', 30, 160]],
    junctions: { J0: [100, 680, 'S'], J1: [520, 700, 'B'], J2: [960, 660, 'B'], J3: [1100, 380, 'B'], J4: [880, 120, 'B'], J5: [500, 110, 'B'], J6: [140, 300, 'B'] },
    segs: [
      { f: 'J0', t: 'J1', ty: 'BEBRB', pts: [[100, 680], [200, 745], [310, 690], [420, 745], [520, 700]] },
      { f: 'J1', t: 'J2', ty: 'BGBDB', label: '🌊 Pela orla (mais longo, mais seguro)', pts: [[520, 700], [600, 765], [720, 745], [840, 770], [960, 660]] },
      { f: 'J1', t: 'J2', ty: 'RLRB', label: '🏪 Atalho do comércio (loja, mas arriscado)', pts: [[520, 700], [640, 640], [760, 600], [870, 620], [960, 660]] },
      { f: 'J2', t: 'J3', ty: 'BDEBR', pts: [[960, 660], [1080, 720], [1150, 600], [1080, 490], [1100, 380]] },
      { f: 'J3', t: 'J4', ty: 'BGBEB', label: '⛰️ Volta da serra (mais longo)', pts: [[1100, 380], [1160, 270], [1130, 150], [1010, 70], [880, 120]] },
      { f: 'J3', t: 'J4', ty: 'VRE', label: '🌑 Atalho sombrio (curto, mas o Diretor está lá!)', pts: [[1100, 380], [980, 350], [900, 260], [880, 120]] },
      { f: 'J4', t: 'J5', ty: 'BRKBD', pts: [[880, 120], [790, 55], [690, 120], [590, 55], [500, 110]] },
      { f: 'J5', t: 'J6', ty: 'ETLBR', label: '⬅️ Seguir pela trilha', pts: [[500, 110], [400, 175], [290, 105], [190, 170], [140, 300]] },
      { f: 'J6', t: 'J0', ty: 'BDGB', pts: [[140, 300], [60, 390], [95, 500], [55, 600], [100, 680]] },
      { f: 'J5', t: 'J1', ty: 'REVBGB', label: '↩️ Retorno pelo centro', pts: [[500, 110], [470, 230], [570, 330], [450, 430], [560, 560], [520, 700]] },
    ],
  },
  snow: {
    name: 'Picos Gelados', emoji: '❄️', desc: 'Gelo que escorrega, teleférico e avalanches.',
    theme: { fill: '#163454', stroke: '#bae6fd', glow: '#7dd3fc', road: '#f0f9ff', road2: '#93c5fd', arrow: '#1e3a8a' },
    logo: [600, 520], dice: [[430, 520], [760, 520]],
    deco: [['⛄', 520, 610], ['🌲', 360, 300], ['🌲', 820, 300], ['🏔️', 600, 220], ['❄️', 200, 600], ['❄️', 1020, 470], ['🐧', 700, 640], ['🌨️', 1170, 60], ['🌲', 30, 90], ['🦌', 330, 450], ['🏔️', 1040, 760]],
    junctions: { J0: [600, 740, 'S'], J1: [260, 700, 'B'], J2: [110, 320, 'B'], J3: [420, 95, 'B'], J4: [800, 95, 'B'], J5: [1090, 330, 'B'], J6: [960, 700, 'B'] },
    segs: [
      { f: 'J0', t: 'J1', ty: 'BIBRB', pts: [[600, 740], [510, 772], [420, 720], [330, 765], [260, 700]] },
      { f: 'J1', t: 'J2', ty: 'BGBDAB', label: '🏔️ Pela encosta (mais longo)', pts: [[260, 700], [150, 745], [60, 620], [80, 480], [40, 400], [110, 320]] },
      { f: 'J1', t: 'J2', ty: 'IRLI', label: '🧊 Lago congelado (escorrega!)', pts: [[260, 700], [300, 590], [230, 500], [250, 410], [110, 320]] },
      { f: 'J2', t: 'J3', ty: 'BECBR', pts: [[110, 320], [130, 210], [220, 140], [320, 170], [420, 95]] },
      { f: 'J3', t: 'J4', ty: 'BRBGB', label: '⛰️ Pela crista (mais curto)', pts: [[420, 95], [500, 45], [600, 95], [700, 45], [800, 95]] },
      { f: 'J3', t: 'J4', ty: 'BTEVB', label: '🌨️ Pelo vale (ladrão à espreita)', pts: [[420, 95], [470, 220], [600, 320], [730, 220], [800, 95]] },
      { f: 'J4', t: 'J5', ty: 'BRKDB', pts: [[800, 95], [900, 55], [1000, 110], [1100, 160], [1090, 330]] },
      { f: 'J5', t: 'J6', ty: 'BGBAB', label: '❄️ Trilha externa', pts: [[1090, 330], [1160, 430], [1130, 540], [1110, 650], [960, 700]] },
      { f: 'J5', t: 'J6', ty: 'ICRB', label: '🚡 Pela estação do teleférico', pts: [[1090, 330], [960, 380], [900, 480], [930, 590], [960, 700]] },
      { f: 'J6', t: 'J0', ty: 'BLIEB', pts: [[960, 700], [880, 765], [780, 720], [690, 770], [600, 740]] },
    ],
  },
  volcano: {
    name: 'Ilha Vulcânica', emoji: '🌋', desc: 'Lava, gêiseres e um atalho pela cratera.',
    theme: { fill: '#2a0f0a', stroke: '#f97316', glow: '#ef4444', road: '#57534e', road2: '#fb923c', arrow: '#fdba74' },
    logo: [905, 575], dice: [[905, 540], [370, 430]],
    deco: [['🌋', 820, 460], ['🔥', 700, 420], ['🪨', 380, 300], ['💀', 1010, 520], ['🌴', 300, 560], ['🦖', 660, 620], ['🔥', 470, 470], ['🪨', 1180, 760], ['🌴', 40, 760], ['🦂', 200, 300]],
    junctions: { J0: [140, 720, 'S'], J1: [480, 690, 'B'], J2: [900, 720, 'B'], J3: [1110, 420, 'B'], J4: [850, 110, 'B'], J5: [360, 90, 'B'], J6: [90, 380, 'B'] },
    segs: [
      { f: 'J0', t: 'J1', ty: 'BFBRB', pts: [[140, 720], [220, 772], [310, 720], [400, 772], [480, 690]] },
      { f: 'J1', t: 'J2', ty: 'BGLDB', label: '🏖️ Praia de cinzas (mais longo)', pts: [[480, 690], [560, 770], [680, 740], [790, 780], [900, 720]] },
      { f: 'J1', t: 'J4', ty: 'RZYFRE', label: '🌋 Pela cratera (atalho perigoso!)', pts: [[480, 690], [560, 580], [620, 470], [560, 360], [640, 250], [760, 180], [850, 110]] },
      { f: 'J2', t: 'J3', ty: 'BEBYB', pts: [[900, 720], [1020, 765], [1150, 680], [1110, 560], [1110, 420]] },
      { f: 'J3', t: 'J4', ty: 'BFBGB', label: '🔥 Borda do vulcão', pts: [[1110, 420], [1170, 320], [1120, 210], [1020, 140], [850, 110]] },
      { f: 'J3', t: 'J4', ty: 'TVRB', label: '🦹 Caverna escura (ladrão e Diretor)', pts: [[1110, 420], [1000, 380], [930, 290], [900, 200], [850, 110]] },
      { f: 'J4', t: 'J5', ty: 'BRKBDB', pts: [[850, 110], [760, 50], [650, 100], [540, 50], [450, 110], [360, 90]] },
      { f: 'J5', t: 'J6', ty: 'BEBLR', pts: [[360, 90], [260, 160], [170, 120], [70, 220], [90, 380]] },
      { f: 'J6', t: 'J0', ty: 'BGYB', label: '🌊 Pela costa', pts: [[90, 380], [40, 480], [90, 580], [50, 660], [140, 720]] },
      { f: 'J6', t: 'J0', ty: 'DFEZ', label: '⛏️ Pelas minas (arriscado)', pts: [[90, 380], [200, 430], [260, 540], [220, 640], [140, 720]] },
    ],
  },
};

function buildBoard(map) {
  const nodes = [], jIdx = {}, branch = {}, back = {}, paths = [], seg = {};
  const typeOf = ch => ch === 'L' ? 'S2' : ch;
  for (const [k, [x, y, t]] of Object.entries(map.junctions)) { jIdx[k] = nodes.length; nodes.push({ id: nodes.length, x, y, type: t, next: [], prev: [], j: true }); }
  for (const s of map.segs) {
    const pts = s.pts, lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = lens[lens.length - 1], n = s.ty.length, ids = [];
    for (let i = 1; i <= n; i++) {
      const d = total * i / (n + 1);
      let k = 1; while (lens[k] < d) k++;
      const r = (d - lens[k - 1]) / (lens[k] - lens[k - 1]);
      const x = pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * r, y = pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * r;
      ids.push(nodes.length); nodes.push({ id: nodes.length, x: Math.round(x), y: Math.round(y), type: typeOf(s.ty[i - 1]), next: [], prev: [] });
    }
    const chain = [jIdx[s.f], ...ids, jIdx[s.t]];
    for (let i = 0; i < chain.length - 1; i++) { nodes[chain[i]].next.push(chain[i + 1]); nodes[chain[i + 1]].prev.push(chain[i]); }
    if (s.label) branch[jIdx[s.f] + '>' + ids[0]] = s.label;
    seg[jIdx[s.f] + '>' + ids[0]] = chain;
    // andando para trás: a escolha acontece na junção de chegada
    back[jIdx[s.t] + '<' + ids[n - 1]] = s.label ? s.label.replace(/\(.*\)/, '').trim() : 'Voltar por aqui';
    seg[jIdx[s.t] + '<' + ids[n - 1]] = chain.slice().reverse();
    paths.push(chain);
  }
  return { nodes, branch, back, paths, seg, start: jIdx.J0, map };
}
let BOARD = null, NODES = null, MAP = null, MAP_ID = 'forest';
function loadMap(id) { MAP_ID = MAPS[id] ? id : 'forest'; MAP = MAPS[MAP_ID]; BOARD = buildBoard(MAP); NODES = BOARD.nodes; }
loadMap('forest');

/* =========================================================================
   TRANSPORTE — Supabase Realtime (broadcast) ou BroadcastChannel local
   ========================================================================= */
function createTransport(room, onMsg, onStatus) {
  if (LOCAL || !window.supabase) {
    const bc = new BroadcastChannel('qp-' + room);
    bc.onmessage = e => onMsg(e.data);
    setTimeout(() => onStatus('ok'), 0);
    return { send: m => bc.postMessage(m), reconnect: () => { } };
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
  let lastRe = 0;
  return {
    send: m => { try { ch && ch.send({ type: 'broadcast', event: 'm', payload: m }); } catch (e) { } },
    // refaz o canal na hora (volta de outra aba, rede voltou, ou silêncio longo demais)
    reconnect: () => { if (Date.now() - lastRe < 4000) return; lastRe = Date.now(); state = 'connecting'; badSince = 0; try { sb.realtime.disconnect(); } catch (e) { } try { sb.realtime.connect(); } catch (e) { } join(); },
  };
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
  fanfare() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.11, i * 0.11)); if (!(typeof MIRROR !== 'undefined' && MIRROR.client)) applause(); },
  evil() { [196, 185, 175, 147].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.07, i * 0.18)); },
  whoosh() { for (let i = 0; i < 8; i++) this.tone(300 + i * 90, 0.05, 'sine', 0.05, i * 0.025); },
  clap() { for (let i = 0; i < 6; i++) this.tone(1800 + rnd(600), 0.03, 'square', 0.05, i * 0.07); },
  caw() { this.tone(520, 0.12, 'sawtooth', 0.06); this.tone(430, 0.18, 'sawtooth', 0.06, 0.13); },
  hit() { this.tone(140, 0.2, 'square', 0.09); this.tone(90, 0.25, 'sawtooth', 0.07, 0.05); },
  crack() { this.tone(2400 + rnd(800), 0.03, 'square', 0.05); this.tone(900, 0.05, 'triangle', 0.05, 0.02); },
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
// Fila de falas: o Monc nunca é cortado no meio. Cada fala espera a anterior terminar.
// Se acumular fala demais (o jogo andou mais rápido que a voz), as que ainda nem
// começaram são puladas; a que está tocando sempre vai até o fim.
const SPQ = { q: [], busy: false, cur: null };
const MAX_QUEUE = 3;
function sentences(text) {   // pedaços curtos: o Chrome corta falas longas sozinho
  const parts = String(text).match(/[^.!?…]+[.!?…]*\s*/g) || [String(text)];
  const out = [];
  parts.forEach(p => { p = p.trim(); if (!p) return; if (out.length && (out[out.length - 1] + ' ' + p).length < 140) out[out.length - 1] += ' ' + p; else out.push(p); });
  return out;
}
const STALE_MS = 1500;   // fala que esperou mais que isso na fila perdeu o momento
function speechNext() {
  if (SPQ.busy) return;
  let it = SPQ.q.shift();
  while (it && !it.keep && !FAST && Date.now() - it.at > STALE_MS) { if (it.onEnd) it.onEnd(); it = SPQ.q.shift(); }
  if (!it) return;
  SPQ.busy = true;
  if (it.onStart) it.onStart();
  let done = false, tm = null;
  const fin = () => { if (done) return; done = true; clearTimeout(tm); SPQ.busy = false; SPQ.cur = null; if (it.onEnd) it.onEnd(); speechNext(); };
  if (FAST) { tm = setTimeout(fin, 20); return; }
  if (Voice.muted || !('speechSynthesis' in window) || !it.text) { tm = setTimeout(fin, it.silentMs); return; }
  const chunks = sentences(it.text);
  let k = 0;
  const speakChunk = () => {
    if (done) return;
    if (k >= chunks.length || Voice.muted) return fin();
    const u = new SpeechSynthesisUtterance(chunks[k++]);
    SPQ.cur = u;   // guarda a referência: sem isso o Chrome às vezes esquece o "fim da fala"
    u.lang = 'pt-BR'; if (Voice.voice) u.voice = Voice.voice; u.rate = 1.15; u.pitch = 1.05;
    let ended = false;
    const next = () => { if (ended) return; ended = true; clearTimeout(tm); speakChunk(); };
    u.onend = next; u.onerror = next;
    clearTimeout(tm); tm = setTimeout(next, 3000 + u.text.length * 120);   // segurança se o navegador não avisar o fim
    try { speechSynthesis.speak(u); } catch (e) { next(); }
  };
  speakChunk();
}
function speakQueued(it) {
  // descarta falas antigas que ainda não começaram (nunca a que está tocando nem as marcadas "keep")
  while (SPQ.q.length >= MAX_QUEUE) {
    const i = SPQ.q.findIndex(x => !x.keep); if (i < 0) break;
    const [d] = SPQ.q.splice(i, 1); if (d.onStart) d.onStart(); if (d.onEnd) d.onEnd();
  }
  it.at = Date.now();
  SPQ.q.push(it); speechNext();
}
// A: ponto de sincronia — espera o Monc terminar (com limite, e sem esperar se estiver no mudo)
function voiceIdle(max = 9000) {
  if (FAST || Voice.muted || !('speechSynthesis' in window)) return Promise.resolve();
  const t0 = Date.now();
  return new Promise(res => { const chk = () => ((!SPQ.busy && !SPQ.q.length) || Date.now() - t0 > max) ? res() : setTimeout(chk, 120); chk(); });
}
// leitura da pergunta: as alternativas aparecem quando o Monc termina de ler (mínimo = tempo de leitura, máximo 10 s)
function readAloud(text, rm) {
  const spoken = say(text, { wait: true });
  if (FAST || Voice.muted || !('speechSynthesis' in window)) return sleep(rm);
  return Promise.all([sleep(rm), Promise.race([spoken, sleep(T(10000))])]);
}
function stopSpeech() { SPQ.q.splice(0).forEach(d => { if (d.onEnd) d.onEnd(); }); try { speechSynthesis.cancel(); } catch (e) { } }

function say(text, opt = {}) {
  const bubble = $('#bubble'), host = $('#host');
  const spoken = String(text).replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
  const est = Math.min(10000, 700 + spoken.length * 62);
  return new Promise(res => {
    speakQueued({
      text: spoken, keep: !!opt.wait, silentMs: opt.wait ? est * 0.55 : 900,
      onStart: () => {
        if (bubble) { bubble.textContent = text; bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop'); }
        if (host) host.classList.add('talk');
        mFx('say', [spoken]);
      },
      onEnd: () => { if (host && !SPQ.q.length) host.classList.remove('talk'); res(); },
    });
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
    star: null, bank: 5, traps: {}, cur: null, dynBag: [], lastDyn: null, nextDyn: null,
    used: {}, usedNum: [], rej: {}, seed: uid(), map: 'forest',
    dyns: DYN_KEYS.slice(), kid: false, quizNo: 0, reverseTurn: 0, chosers: [], lastFixTheme: null, bonus: [],
  };
}

function setUI(p, ui) {
  ui.id = ++UIC;
  if (ui._ms) ui._dl = Date.now() + ui._ms;
  p.ui = ui; scheduleSync();
}
function waitUI(p, msg, sub) { setUI(p, { screen: 'wait', msg, sub }); }
const SCR = () => (G && G.online ? 'no tabuleiro' : 'na TV');
const LOOK = () => (G && G.online ? 'Acompanhe no tabuleiro' : 'Olhe para a TV');
function waitAll(msg, sub, except) { G.players.forEach(p => { if (!except || p.id !== except.id) waitUI(p, msg, sub); }); }

function ask(p, ui, ms, def, ack) {
  return new Promise(res => {
    if (ms) ui._ms = ms;
    setUI(p, ui);
    const myId = p.ui.id; let done = false, tm = null;
    const stopClock = ms >= 10000 ? clockStart(p, ms) : () => { };
    const fin = v => { if (done) return; done = true; clearTimeout(tm); stopClock(); if (pending[p.id] && pending[p.id].uid === myId) delete pending[p.id]; res(v); };
    pending[p.id] = { uid: myId, ack, resolve: fin };
    if (ms) tm = setTimeout(() => {
      if (p.ui.id === myId) waitUI(p, '⏰ Tempo esgotado!', 'A produção decidiu por você');
      floatText(p, '⏰ tempo!', '#fca5a5');
      fin(def);
    }, ms + 600);
  });
}
// relógio da decisão na TV: aparece com quem está decidindo e fica grande nos 10 s finais
let clockOwner = 0;
function clockStart(p, ms) {
  const me = ++clockOwner, dl = Date.now() + ms;
  const upd = () => {
    const el = $('#clock'); if (!el || me !== clockOwner) return;
    const left = Math.max(0, Math.ceil((dl - Date.now()) / 1000));
    el.className = 'clock' + (left <= 10 ? ' hurry' : '');
    el.style.setProperty('--pc', p.color);
    el.innerHTML = `<span class="ck-av" style="background:${p.color}">${p.emoji}</span><span class="ck-n">${left}</span><span class="ck-l">${left <= 10 ? 'decide logo!' : 'segundos'}</span>`;
    if (left <= 10 && left > 0) SFX.tick();
  };
  upd(); const iv = setInterval(upd, 1000);
  return () => { clearInterval(iv); if (me === clockOwner) { const el = $('#clock'); if (el) { el.className = 'clock hidden'; el.innerHTML = ''; } } };
}

function collect(parts, makeUI, ms, onAnswer, ack = '✅ Resposta enviada!', ctl = {}) {
  return new Promise(res => {
    const gid = ++GID, ans = {}; let finished = false, tm;
    ctl.finish = () => finish();
    const t0 = Date.now();
    const finish = () => {
      if (finished) return; finished = true; clearTimeout(tm);
      parts.forEach(p => { if (pending[p.id] && pending[p.id].gid === gid) delete pending[p.id]; });
      res(ans);
    };
    parts.forEach(p => {
      const ui = makeUI(p); ui._ms = ms; setUI(p, ui);
      pending[p.id] = {
        uid: p.ui.id, gid, ack, resolve: (a, el) => {
          if (finished) return;
          const t = typeof el === 'number' && el >= 0 && el <= ms + 2000 ? el : Date.now() - t0;
          ans[p.id] = { a, t: Math.min(ms, t) };
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
function meOf(p) { return { name: p.name, emoji: p.emoji, color: p.color, sym: symOf(p), coins: p.coins, stars: p.stars, items: p.items, rank: rankOf(p), buff: p.buff, debuff: p.debuff }; }
function sendSync() {
  if (!G || !net) return;
  const now = Date.now(), ps = {};
  G.players.forEach(p => {
    const ui = Object.assign({}, p.ui);
    if (ui._dl) ui.left = Math.max(0, ui._dl - now);
    delete ui._dl; delete ui._ms;
    ps[p.id] = { ui, me: meOf(p) };
  });
  const cl = G.phase !== 'lobby' ? G.players.filter(p => !p.online).map(p => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color })) : [];
  net.send({ t: 's', seq: ++seq, ph: G.phase, ps, rej: G.rej, taken: G.players.map(p => p.emoji), sh: G.shared || null, cl, claims: G.claims || {} });
}

let lastTVMsg = Date.now();
function onTVMsg(m) {
  if (!m || !G) return;
  if (m.t === 'join') return onJoin(m);
  if (m.t === 'claim') return onClaim(m);
  if (m.t === 'mreq') { mFullReq(); return; }
  const p = m.pid && P(m.pid);
  if (!p) return;
  p.lastSeen = Date.now();
  if (!p.online) { p.online = true; renderSide(); announceBack(p); }
  if (m.t === 'hello') { scheduleSync(); return; }
  if (m.t === 'prog') { if (G.live && m.uid === (p.ui && p.ui.id)) { G.live[p.id] = m.v; renderLive && renderLive(); } return; }
  if (m.t === 'act') {
    const pend = pending[p.id];
    if (!pend || pend.uid !== m.uid) { scheduleSync(); return; }
    delete pending[p.id];
    waitUI(p, pend.ack || '✅ Recebido!');
    pend.resolve(m.a || {}, m.el);
  }
}

// feedback para todos quando alguém volta
function announceBack(p) {
  if (!G || G.phase === 'lobby') return;
  SFX.pop(); floatText(p, '🔌 voltou!', '#86efac');
  banner('🔌', `${p.name} reconectou!`, 'De volta ao show, de onde parou', 2000);
  renderRejoin();
}
// um aparelho sem crachá assume uma vaga que está offline (só jogadores que já estavam na partida)
function onClaim(m) {
  const p = P(m.id);
  if (!p || !m.pid || G.phase === 'lobby') return;
  if (p.online && Date.now() - (p.lastSeen || 0) < 16000) { scheduleSync(); return; }   // ainda está conectado em outro aparelho
  G.claims = G.claims || {};
  G.claims[m.pid] = p.id;
  delete G.rej[m.pid];
  p.lastSeen = Date.now();
  if (!p.online) { p.online = true; renderSide(); announceBack(p); }
  scheduleSync();
}

function onJoin(m) {
  const name = String(m.name || '').trim().slice(0, 14) || 'Jogador';
  let p = P(m.pid);
  if (p) {
    const was = p.online;
    p.online = true; p.lastSeen = Date.now();
    if (!was) announceBack(p);
    if (G.phase === 'lobby') { p.name = name; if (!G.players.some(o => o !== p && o.emoji === m.emoji) && AVATARS.includes(m.emoji)) p.emoji = m.emoji; }
    renderLobby(); renderSide(); scheduleSync(); return;
  }
  if (G.phase !== 'lobby') { G.rej[m.pid] = 'claim'; scheduleSync(); return; }   // pode reassumir uma vaga offline
  if (G.players.length >= MAX_PLAYERS) { G.rej[m.pid] = 'full'; scheduleSync(); return; }
  let emoji = AVATARS.includes(m.emoji) ? m.emoji : AVATARS[0];
  if (G.players.some(o => o.emoji === emoji)) emoji = AVATARS.find(a => !G.players.some(o => o.emoji === a));
  const color = COLORS.find(c => !G.players.some(o => o.color === c));
  delete G.rej[m.pid];
  p = {
    id: m.pid, name, emoji, color, node: BOARD.start, coins: START_COINS, stars: 0, items: [],
    online: true, lastSeen: Date.now(), debuff: newDebuff(), buff: newBuff(),
    stats: newStats(), ui: null,
  };
  G.players.push(p);
  setUI(p, { screen: 'lobby' });
  SFX.pop();
  say(pick([`${name} chegou no estúdio!`, `Palmas pra ${name}, nosso novo participante!`, `Olha só quem chegou: ${name}! Alguém arruma uma cadeira?`, `${name} entrou no show! A plateia de três pessoas vai à loucura!`]));
  renderLobby();
}

setInterval(() => {    // marca quem está offline
  if (!G) return;
  let ch = false;
  G.players.forEach(p => { const on = Date.now() - (p.lastSeen || 0) < 16000; if (on !== p.online) { p.online = on; ch = true; if (!on && G.phase !== 'lobby') { floatText(p, '📵 caiu', '#fca5a5'); } } });
  if (ch) { renderSide(); renderLobby(); renderRejoin(); scheduleSync(); }
  // TV/anfitrião: se ninguém fala com a gente há muito tempo, refaz o canal
  if (net && net.reconnect && G.players.some(p => !(G.online && p.id === PH.pid)) && Date.now() - lastTVMsg > 12000) { lastTVMsg = Date.now(); net.reconnect(); }
}, 4000);

// cartão "caiu? escaneie para voltar" no canto da TV, só quando alguém está offline
let rejoinQR = false;
function renderRejoin() {
  const el = $('#rejoin'); if (!el || !G) return;
  const off = G.phase !== 'lobby' && G.phase !== 'final' ? G.players.filter(p => !p.online && !(G.online && p.id === PH.pid)) : [];
  el.classList.toggle('hidden', !off.length);
  if (!off.length) return;
  $('#rj-who').innerHTML = off.map(p => `<span class="msav" style="background:${p.color}">${p.emoji}</span>`).join('');
  if (!rejoinQR) {
    rejoinQR = true;
    const box = $('#rj-qr');
    if (G.online || typeof QRCode === 'undefined') box.innerHTML = `<div class="rj-code">${G.room}</div>`;
    else try { new QRCode(box, { text: joinURL(), width: 150, height: 150, colorDark: '#0f172a', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M }); } catch (e) { box.innerHTML = `<div class="rj-code">${G.room}</div>`; }
  }
}

function save() { try { localStorage.setItem('qp_tv', JSON.stringify({ G, ts: Date.now() })); } catch (e) { } }

/* ---------- moedas, itens, ranking ---------- */
function rankOf(p) {
  const s = G.players.slice().sort((a, b) => b.stars - a.stars || b.coins - a.coins);
  const i = s.findIndex(x => x.id === p.id);
  let r = i; while (r > 0 && s[r - 1].stars === p.stars && s[r - 1].coins === p.coins) r--;
  return r + 1;
}
const newDebuff = () => ({ ink: 0, inkC: '#0b0b14', freeze: 0 });
const newBuff = () => ({ ear: 0, retake: 0, allin: 0 });
const newStats = () => ({ correct: 0, earned: 0, attacks: 0, steps: 0, blue: 0, bad: 0, spent: 0, duels: 0, hit: 0, fastT: 0, fastN: 0, got: 0, special: 0 });
function addCoins(p, n, silent) {
  const before = p.coins;
  p.coins = Math.max(0, p.coins + n);
  const d = p.coins - before;
  if (d > 0) p.stats.earned += d;
  if (d !== 0 && !silent) { floatText(p, (d > 0 ? '+' : '') + d + ' ' + COIN, d > 0 ? '#fde047' : '#fca5a5'); d > 0 ? SFX.coin() : SFX.lose(); }
  renderSide(); scheduleSync();
  return d;
}
// paga para o banco (com moedas voando até ele)
async function payBank(p, n) {
  const v = Math.min(n, p.coins); if (!v) return 0;
  const kn = NODES.find(x => x.type === 'K');
  if (kn) await coinFlight(pXY(p), nXY(kn.id), Math.min(v, 6));
  addCoins(p, -v); G.bank += v; renderBoard(); return v;
}
// noFull: a mochila cheia não vira moedas (prêmio do Monquiz)
function giveItem(p, k, noFull) {
  if (p.items.length >= 3) { if (!noFull) addCoins(p, 3); return false; }
  p.items.push(k); p.stats.got++; renderSide(); scheduleSync(); return true;
}
function removeItem(p, k) { const i = p.items.indexOf(k); if (i >= 0) p.items.splice(i, 1); renderSide(); scheduleSync(); }
const finalStretch = () => G.turn > G.maxTurns - 3;
const grandFinal = () => G.turn >= G.maxTurns;
// sorteia um nível pela tabela de chances e devolve um item desse nível
function drawTier(w) { let t = Math.random() * 100; for (const [k, v] of Object.entries(w)) { t -= v; if (t < 0) return k; } return 'low'; }
const W_TOP = { low: 40, mid: 30, risky: 20, high: 10 }, W_BOTTOM = { low: 25, mid: 35, risky: 20, high: 20 };
function randomItemFor(p) {
  const n = G.players.length, top = n < 2 || rankOf(p) <= Math.ceil(n / 2);
  return pick(itemsOfTier(drawTier(top ? W_TOP : W_BOTTOM)));
}
// mostra o item ganho voando até o jogador
function itemPop(p, k) { burst(pXY(p), [ITEMS[k].e, '✨'], 8, 90); floatText(p, ITEMS[k].e + ' ' + ITEMS[k].n, TIERS[ITEMS[k].tier].c); }
// Corta!: anula a próxima casa ruim
async function useCut(p, what) {
  if (!p.items.includes('cut')) return false;
  removeItem(p, 'cut');
  SFX.clap(); flash(pXY(p), 'shield'); burst(pXY(p), ['🎬', '✂️', '✨'], 14, 150);
  banner('🎬', `CORTA! ${p.name} usou o Corta!`, `${what} foi anulado. Volta a fita!`, 2400);
  await say(pick([`Corta! Corta! ${p.name} mandou cortar essa cena! ${what}? Não aconteceu.`, `Corta! A produção apagou essa parte: ${p.name} se livrou de ${what}!`]), { wait: true });
  return true;
}

function placeStar(avoid) {
  const cands = NODES.filter(n => !n.j && n.type !== 'S' && n.id !== avoid && G.traps[n.id] === undefined);
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
  const box = st.parentElement, full = box === document.body;
  const W = full ? innerWidth : box.clientWidth, H = full ? innerHeight : box.clientHeight;
  const s = Math.min(W / 1920, H / 1080);
  st.style.transform = `translate(${(W - 1920 * s) / 2}px, ${(H - 1080 * s) / 2}px) scale(${s})`;
}

function stageMode(m) { const st = $('#stage'); st.className = 'mode-' + m; }

function hostSVG() {
  // Monc (topete, bigode, smoking roxo, microfone) com o corvo Alphie no ombro
  return `<svg viewBox="0 0 220 230" class="hostsvg" aria-hidden="true">
    <path d="M40 230 C40 178 70 160 110 160 C150 160 180 178 180 230 Z" fill="#5b21b6"/>
    <path d="M110 162 L88 230 L70 230 L84 170 Z M110 162 L132 230 L150 230 L136 170 Z" fill="#3b0764"/>
    <path d="M110 162 L95 200 L110 230 L125 200 Z" fill="#f8fafc"/>
    <path d="M96 172 L110 179 L96 186 Z M124 172 L110 179 L124 186 Z" fill="#e11d48"/><circle cx="110" cy="179" r="5" fill="#9f1239"/>
    <rect x="100" y="140" width="20" height="22" rx="6" fill="#e8b48a"/>
    <ellipse cx="110" cy="102" rx="44" ry="48" fill="#f1c27d"/>
    <ellipse cx="66" cy="106" rx="7" ry="11" fill="#e8b48a"/><ellipse cx="154" cy="106" rx="7" ry="11" fill="#e8b48a"/>
    <path class="hair" d="M64 92 C56 40 96 18 128 26 C160 30 172 58 158 84 C150 66 136 58 118 60 C96 50 78 62 72 92 Z" fill="#1f2937"/>
    <path d="M86 30 C100 6 150 10 160 40 C140 26 110 24 86 30 Z" fill="#374151"/>
    <path d="M84 84 Q95 78 104 84 M116 84 Q125 78 136 84" stroke="#1f2937" stroke-width="5" fill="none" stroke-linecap="round"/>
    <g class="eyes"><ellipse cx="94" cy="98" rx="9" ry="10" fill="#fff"/><ellipse cx="126" cy="98" rx="9" ry="10" fill="#fff"/>
      <circle cx="96" cy="100" r="5" fill="#0f172a"/><circle cx="128" cy="100" r="5" fill="#0f172a"/></g>
    <path d="M106 104 Q110 118 114 104" fill="#d99a6c"/>
    <path d="M86 124 C96 114 106 118 110 122 C114 118 124 114 134 124 C124 122 116 126 110 128 C104 126 96 122 86 124 Z" fill="#1f2937"/>
    <ellipse class="mouth" cx="110" cy="134" rx="11" ry="5" fill="#7f1d1d"/>
    <g class="mic"><rect x="150" y="150" width="10" height="44" rx="4" fill="#334155" transform="rotate(-25 155 172)"/>
      <circle cx="146" cy="142" r="13" fill="#fde047" stroke="#a16207" stroke-width="3"/>
      <path d="M137 138 L155 138 M136 144 L156 144" stroke="#a16207" stroke-width="2"/>
      <ellipse cx="163" cy="186" rx="12" ry="10" fill="#f1c27d"/></g>
    <g class="crow" transform="translate(42 150)">
      <path d="M-14 4 C-30 18 -34 34 -24 40 L0 18 Z" fill="#111827"/>
      <ellipse cx="0" cy="8" rx="20" ry="16" fill="#1f2937"/>
      <circle cx="10" cy="-10" r="12" fill="#1f2937"/>
      <path d="M20 -12 L36 -7 L20 -3 Z" fill="#f59e0b"/>
      <circle class="crow-eye" cx="13" cy="-13" r="3.4" fill="#fff"/><circle cx="14" cy="-13" r="1.6" fill="#0f172a"/>
      <path d="M2 -20 L6 -28 L10 -20" fill="#1f2937"/>
      <path d="M-4 22 L-6 30 M4 22 L4 30" stroke="#f59e0b" stroke-width="3"/>
    </g>
  </svg>`;
}

function buildTV(container) {
  const root = container || document.body;
  if (!container) document.body.className = 'tv';
  root.innerHTML = `
  <div id="stage" class="mode-lobby">
    <div id="lobby"></div>
    <div id="game">
      <div id="topbar">
        <div class="logo"><span class="bulbs"></span>MONC'S SHOW</div>
        <div class="onair"><span class="rec"></span>AO VIVO</div>
        <div id="turninfo"></div>
        <div class="tb-right"><span id="roomtag"></span><span id="conn" class="conn"></span>
          <button id="mute" class="mini" title="Voz do apresentador">🔊</button><button id="sfxbtn" class="mini" title="Efeitos sonoros">🎵</button></div>
      </div>
      <div id="boardWrap"></div>
      <div id="side"><div id="plist"></div></div>
    </div>
    <div id="host"><div id="bubble">Boa noite! Eu sou o Monc, e este é o meu show!</div>${hostSVG()}<div class="dirsign">📣 O DIRETOR MANDOU</div><div class="hostname">MONC <small>& Alphie</small></div></div>
    <div id="rejoin" class="rejoin hidden"><div class="rj-t">📵 Caiu? Volte aqui!</div><div id="rj-qr" class="rj-qr"></div><div class="rj-s">mesmo link da sala · toque no seu nome</div><div id="rj-who" class="rj-who"></div></div>
    <div id="hud"><div id="applause" class="applause">👏 APLAUSOS</div><div id="clock" class="clock hidden"></div><div id="gate" class="gate hidden"></div></div>
    <div id="ov"></div>
    <div id="fx"></div>
  </div>`;
  fitStage(); addEventListener('resize', fitStage);
  $('#mute').onclick = () => { Voice.muted = !Voice.muted; $('#mute').textContent = Voice.muted ? '🔇' : '🔊'; if (Voice.muted) stopSpeech(); };
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
  const deco = MAP.deco, th = MAP.theme, [lx, ly] = MAP.logo;
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
      <text class="nlabel" font-size="${fs}" fill="${n.type === 'S' || sp.dark ? '#0f172a' : '#fff'}">${label}</text></g>`;
  }).join('');
  $('#boardWrap').innerHTML = `<svg id="board" viewBox="0 0 1200 800">
    <defs>
      <radialGradient id="bgG" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="${th.glow}" stop-opacity=".22"/><stop offset="1" stop-color="#0f172a" stop-opacity="0"/></radialGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect x="4" y="4" width="1192" height="792" rx="40" fill="${th.fill}" stroke="${th.stroke}" stroke-opacity=".4" stroke-width="4"/>
    <rect x="4" y="4" width="1192" height="792" rx="40" fill="url(#bgG)"/>
    <g class="tape"><rect x="-20" y="18" width="120" height="34" transform="rotate(-38 40 35)"/><rect x="1100" y="18" width="120" height="34" transform="rotate(38 1160 35)"/>
      <rect x="-20" y="748" width="120" height="34" transform="rotate(38 40 765)"/><rect x="1100" y="748" width="120" height="34" transform="rotate(-38 1160 765)"/></g>
    ${deco.map(([e, x, y]) => `<text x="${x}" y="${y}" font-size="34" opacity=".55" text-anchor="middle">${e}</text>`).join('')}
    <g class="centerlogo"><text x="${lx}" y="${ly - 20}" text-anchor="middle" class="cl1">MONC'S</text><text x="${lx}" y="${ly + 32}" text-anchor="middle" class="cl2">SHOW</text></g>
    ${paths.map(d => `<path d="${d}" class="road" style="stroke:${th.road}"/>`).join('')}
    ${paths.map(d => `<path d="${d}" class="road2" style="stroke:${th.road2}"/>`).join('')}
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
    ar.push(`<path d="M-7,-7 L5,0 L-7,7" transform="translate(${mx},${my}) rotate(${ang})" class="arrow" style="stroke:${MAP.theme.arrow}"/>`);
  }));
  $('#arrows').innerHTML = ar.join('');
}

// caminhos das bifurcações: cor, número e padrão de linha (ajuda daltônicos)
const BR = [{ c: '#00D5E0', dash: '', sample: '━━━' }, { c: '#F030E0', dash: '22 12', sample: '╍╍╍' }, { c: '#A6F01E', dash: '3 11', sample: '┅┅┅' }];
const BR_COLORS = BR.map(b => b.c);
const nbrs = (id, dir) => dir < 0 ? NODES[id].prev : NODES[id].next;

// todas as casas onde o jogador pode cair andando `steps` casas a partir de `from`.
// ci = índice da opção escolhida na PRIMEIRA bifurcação encontrada (fb).
function dests(from, steps, dir = 1) {
  const list = []; let fb = null;
  if (steps === 0) return { fb: null, list: [{ end: from, ci: null }] };
  const walk = (node, left, ci) => {
    if (left === 0) { list.push({ end: node, ci }); return; }
    const nx = nbrs(node, dir);
    if (nx.length > 1 && ci == null) fb = node;
    nx.forEach((id, i) => walk(id, left - 1, ci == null && nx.length > 1 ? i : ci));
  };
  walk(from, steps, null);
  const seen = new Set();
  return { fb, dir, list: list.filter(d => { const k = d.end + ':' + d.ci; if (seen.has(k)) return false; seen.add(k); return true; }) };
}
function spaceDesc(id) {
  if (id === G.star) return MIC + ' ' + STAR;
  const t = NODES[id].type, m = finalStretch() ? 2 : 1;
  const D = { B: `🔵 Azul (+${3 * m})`, R: `🔴 Vermelha (−${3 * m})`, S: '🏁 Início', F: `🔥 Lava (−${6 * m})` };
  return D[t] || `${SPACE[t].icon} ${SPACE[t].n}`;   // armadilhas ficam escondidas
}

/* ---------- efeitos visuais ---------- */
let applauseT = null;
function applause(ms = 2200) { const a = $('#applause'); if (!a) return; a.classList.add('on'); SFX.clap(); clearTimeout(applauseT); applauseT = setTimeout(() => { const b = $('#applause'); if (b) b.classList.remove('on'); }, T(ms)); }
// projétil de um ponto a outro (itens de ataque)
function projectile(from, to, chars, dur = 700) {
  mFx('proj', [from, to, chars, dur]);
  const d = document.createElement('div'); d.className = 'proj'; d.textContent = chars;
  d.style.left = from[0] + 'px'; d.style.top = from[1] + 'px'; $('#fx').appendChild(d);
  const dx = to[0] - from[0], dy = to[1] - from[1];
  d.animate([
    { transform: 'translate(-50%,-50%) scale(.6) rotate(0deg)' },
    { transform: `translate(-50%,-50%) translate(${dx / 2}px,${dy / 2 - 140}px) scale(1.6) rotate(200deg)`, offset: .5 },
    { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(1) rotate(360deg)` },
  ], { duration: T(dur), easing: 'ease-in-out', fill: 'forwards' }).onfinish = () => d.remove();
  return sleep(T(dur));
}
// animação curta num peão (classe CSS por um tempo)
function tokAnim(p, cls, ms = 900) {
  const el = document.querySelector(`#tokens [data-p="${p.id}"]`); if (!el) return;
  el.classList.add(cls); setTimeout(() => el.classList.remove(cls), T(ms));
}
const pXY = p => toStage(...tokenPos(p));
const nXY = id => toStage(NODES[id].x, NODES[id].y);
function coinFlight(from, to, count) {
  mFx('coinFlight', [from, to, count]);
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
    a.onfinish = () => { c.remove(); ((SFX._o && SFX._o.tick) || SFX.tick).call(SFX); };
  }
  return sleep(T(820 + count * 90));
}
function burst(xy, chars, n = 12, spread = 150, cls = '') {
  mFx('burst', [xy, chars, n, spread, cls]);
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
  mFx('flash', [xy, cls]);
  const d = document.createElement('div'); d.className = 'flash ' + cls;
  d.style.left = xy[0] + 'px'; d.style.top = xy[1] + 'px';
  $('#fx').appendChild(d); setTimeout(() => d.remove(), T(1200));
}
// anima peões em arco (usado na troca de lugar)
function arcTokens(moves) {
  mFx('arc', [moves.map(m => ({ id: m.p.id, from: m.from, to: m.to }))]);
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

// vários peões na mesma casa: o da vez fica no centro e os outros em volta
function tokenPos(p) {
  const n0 = NODES[p.node];
  const same = G.players.filter(o => o.node === p.node);
  if (same.length <= 1 || G.cur === p.id) return [n0.x, n0.y - 4];
  const ring = same.filter(o => o.id !== G.cur), i = ring.indexOf(p), n = ring.length;
  const hasCur = same.length !== ring.length, r = hasCur ? 27 : 20;
  const a = (i / n) * Math.PI * 2 - Math.PI / 2 + (hasCur ? Math.PI / 4 : 0);
  return [n0.x + Math.cos(a) * r, n0.y + Math.sin(a) * r];
}

function renderBoard() {
  if (!$('#tokens')) return;
  // estrela
  const sn = G.star != null ? NODES[G.star] : null;
  $('#starG').innerHTML = sn ? `<g transform="translate(${sn.x},${sn.y})"><path d="M-46,26 L-14,-90 L14,-90 L46,26 Z" class="spot"/><g class="starmark"><circle r="31" fill="#fde047" opacity=".45" filter="url(#glow)"/><circle r="25" fill="#1e1b4b" stroke="#fde047" stroke-width="4"/><text font-size="32" text-anchor="middle" dy="11">${MIC}</text><text y="-37" class="starprice" text-anchor="middle">${STAR_PRICE} ${COIN}</text></g></g>` : '';
  // armadilhas ficam escondidas (só aparecem quando alguém cai)
  $('#traps').innerHTML = '';
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
      el.innerHTML = `<g class="tk"><circle class="shieldb" r="27"/><circle r="17" fill="${p.color}" stroke="#fff" stroke-width="3"/><text font-size="20" text-anchor="middle" dy="7">${p.emoji}</text>
        <g class="inkb"><circle cx="-8" cy="-4" r="9"/><circle cx="7" cy="5" r="7"/><circle cx="9" cy="-9" r="4"/></g>
        <rect class="iceb" x="-23" y="-23" width="46" height="46" rx="9"/>
        <g transform="translate(14,-15)"><circle r="8" fill="#0f172a" stroke="#fff" stroke-width="1.5"/><text class="tsym" dy="4" text-anchor="middle">${symOf(p)}</text></g>
        <text class="tbuf" y="34" text-anchor="middle"></text></g>`;
      tg.appendChild(el);
    }
    el.classList.toggle('has-shield', p.items.includes('shield'));
    el.classList.toggle('is-frozen', p.debuff.freeze > 0);
    el.classList.toggle('is-inked', p.debuff.ink > 0);
    el.classList.toggle('skip', !!p.skip);
    const tb = el.querySelector('.tbuf'); if (tb) tb.textContent = buffIcons(p);
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
    nbrs(pv.fb, pv.dir).forEach((id, i) => {
      const chain = BOARD.seg[pv.fb + (pv.dir < 0 ? '<' : '>') + id]; if (!chain) return;
      const b = BR[i % BR.length], col = b.c;
      br += `<path d="${smoothPath(chain.map(k => [NODES[k].x, NODES[k].y]))}" class="brpath ${b.dash ? 'dashed' : ''}" stroke="${col}" ${b.dash ? `stroke-dasharray="${b.dash}"` : ''}/>`;
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

// ícones dos efeitos ativos para o próximo Monquiz
function buffIcons(p) {
  return (p.debuff.ink ? '🦑' : '') + (p.debuff.freeze ? '🧊' : '') + (p.buff.ear ? '🎧' : '') + (p.buff.retake ? '📼' : '') + (p.buff.allin ? '🎰' : '') + (p.skip ? '☕' : '');
}
function renderSide() {
  if (!G || G.phase === 'lobby' || !$('#plist')) return;
  const list = G.order.length ? G.order.map(P).filter(Boolean) : G.players;
  $('#plist').innerHTML = list.map(p => `
    <div class="pcard ${G.cur === p.id ? 'cur' : ''} ${p.online ? '' : 'off'} ${p.items.includes('shield') ? 'shielded' : ''} ${p.debuff.freeze ? 'frozen' : ''} ${p.debuff.ink ? 'inked' : ''}" style="--pc:${p.color}">
      <div class="prank">${rankOf(p)}º</div>
      <div class="pav" style="background:${p.color}">${p.emoji}<span class="psym">${symOf(p)}</span>${p.items.includes('shield') ? '<span class="shbadge">🛡️</span>' : ''}</div>
      <div class="pinfo"><div class="pname">${esc(p.name)}${p.online ? '' : ' <span class="offtag">offline</span>'}</div>
        <div class="pitems">${p.items.map(k => `<span class="it t-${ITEMS[k].tier}" title="${ITEMS[k].n}">${ITEMS[k].e}</span>`).join('') || '<span class="none">sem itens</span>'}${buffIcons(p) ? `<span class="deb">${buffIcons(p)}</span>` : ''}</div></div>
      <div class="pstats"><div class="pstar">${MIC} ${p.stars}</div><div class="pcoin">${COIN} ${p.coins}</div></div>
    </div>`).join('');
  const ti = $('#turninfo');
  const nd = G.nextDyn && DYNS[G.nextDyn];
  renderRejoin();
  if (ti) ti.innerHTML = `<span class="turnpill">Turno <b>${Math.min(G.turn, G.maxTurns)}</b> de ${G.maxTurns}</span>${finalStretch() ? '<span class="finalpill">🔥 RETA FINAL</span>' : ''}${G.reverseTurn === G.turn ? '<span class="revpill">🔄 Todos andam ao contrário</span>' : G.reverseTurn === G.turn + 1 ? '<span class="revpill soon">🔄 Próximo turno: ao contrário</span>' : ''}${nd && G.phase !== 'final' ? `<span class="nextpill">📺 Próximo Monquiz: <b>${nd.e} ${nd.n}</b></span>` : ''}`;
  renderBoard();
}

function setConn(st) {
  connOK = st === 'ok';
  const c = $('#conn'); if (c) { c.className = 'conn ' + (connOK ? 'ok' : 'bad'); c.title = connOK ? 'Conectado' : 'Reconectando…'; }
  const lc = $('#lconn'); if (lc) lc.textContent = connOK ? '🟢 Sala online' : '🟠 Conectando…';
}

function floatText(p, text, color) {
  const [x, y] = toStage(...tokenPos(p));
  floatAt(x, y, text, color);
}
function floatAt(x, y, text, color) {
  mFx('floatAt', [x, y, text, color]);
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
function joinURL() { return location.origin + location.pathname + (G.online ? '?online&sala=' : '?sala=') + G.room + (LOCAL ? '&local' : '') + (FAST ? '&fast' : ''); }

function renderLobby() {
  if (!G || G.phase !== 'lobby') return;
  const L = $('#lobby');
  if (!L.dataset.built) {
    L.dataset.built = 1;
    L.innerHTML = `
      <div class="lob-left">
        <div class="biglogo"><span class="bulbs"></span>MONC'S<br>SHOW</div>
        ${G.online ? `<div class="invite"><div class="inv-t">💻 Convide os amigos</div><div class="inv-s">Mande este link. Cada um abre no próprio computador:</div><div class="inv-link" id="invlink"></div><button id="copylink" class="inv-btn">📋 Copiar link</button></div>
        <div class="joinhint">ou entrem com o código da sala</div>` : `<div class="qrbox"><div id="qr"></div></div>
        <div class="joinhint">Aponte a câmera do celular para o QR code<br>ou entre com o código</div>`}
        <div class="roomcode">${G.room}</div>
        <div class="joinurl" id="joinurl"></div>
        <div id="lconn" class="lconn">🟠 Conectando…</div>
      </div>
      <div class="lob-right">
        <div class="lob-title">Jogadores <span id="pcount"></span></div>
        <div id="lplayers"></div>
        <div class="lob-sub">Mapa</div>
        <div id="lmaps" class="lmaps">${Object.keys(MAPS).map(id => `<button class="lmap" data-map="${id}">${miniMap(id)}<div class="lm-n">${MAPS[id].emoji} ${MAPS[id].name}</div><div class="lm-d">${MAPS[id].desc}</div></button>`).join('')}</div>
        <div class="lob-cfg">
          <div class="cfg-label">Turnos</div>
          <button id="tminus" class="round">−</button><div id="tval"></div><button id="tplus" class="round">+</button>
          <div id="tdur" class="cfg-dur"></div>
          <button id="kidbtn" class="kidbtn"></button>
        </div>
        <div class="lob-sub">Dinâmicas do Monquiz <small>(clique para ligar/desligar · mínimo 3)</small></div>
        <div id="ldyns" class="ldyns">${DYN_KEYS.map(k => `<button class="ldyn" data-d="${k}">${DYNS[k].e} ${DYNS[k].n}</button>`).join('')}</div>
        <button id="startbtn" class="startbtn">▶ COMEÇAR O SHOW</button>
        <div class="lob-tip">Dica: clique em um jogador para removê-lo. Até 8 jogadores.</div>
      </div>`;
    const url = joinURL();
    $('#joinurl').textContent = url.replace(/^https?:\/\//, '');
    if (G.online) {
      $('#invlink').textContent = url;
      $('#copylink').onclick = () => { try { navigator.clipboard.writeText(url); $('#copylink').textContent = '✅ Link copiado!'; setTimeout(() => { const b = $('#copylink'); if (b) b.textContent = '📋 Copiar link'; }, 2000); } catch (e) { } };
    } else try { new QRCode($('#qr'), { text: url, width: 330, height: 330, colorDark: '#0f172a', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M }); }
    catch (e) { $('#qr').innerHTML = `<div style="padding:30px;color:#0f172a;font-size:22px;width:270px">QR indisponível.<br>Use o código abaixo.</div>`; }
    $('#tminus').onclick = () => { G.maxTurns = Math.max(10, G.maxTurns - 1); renderLobby(); };
    $('#tplus').onclick = () => { G.maxTurns = Math.min(20, G.maxTurns + 1); renderLobby(); };
    $('#startbtn').onclick = () => { if (G.players.length >= 2) startGame(); };
    $('#kidbtn').onclick = () => { G.kid = !G.kid; SFX.init(); SFX.pop(); say(G.kid ? 'Modo família ligado! Só perguntas para maiores de dez anos.' : 'Modo família desligado.'); renderLobby(); };
    $('#ldyns').onclick = e => {
      const b = e.target.closest('.ldyn'); if (!b) return;
      const k = b.dataset.d, on = G.dyns.includes(k);
      if (on && G.dyns.length <= 3) { say('Precisa de pelo menos três dinâmicas no Monquiz!'); return; }
      G.dyns = on ? G.dyns.filter(x => x !== k) : [...G.dyns, k];
      SFX.init(); SFX.pop(); renderLobby();
    };
    $('#lmaps').onclick = e => { const b = e.target.closest('.lmap'); if (!b) return; G.map = b.dataset.map; SFX.init(); SFX.pop(); say(`Mapa escolhido: ${MAPS[G.map].name}!`); renderLobby(); };
    $('#lplayers').onclick = e => {
      const c = e.target.closest('[data-pid]'); if (!c) return;
      const p = P(c.dataset.pid); if (!p) return;
      if (confirm(`Remover ${p.name} da sala?`)) { G.players = G.players.filter(x => x !== p); G.rej[p.id] = 'kicked'; renderLobby(); scheduleSync(); }
    };
  }
  $('#pcount').textContent = `${G.players.length}/${MAX_PLAYERS}`;
  $('#lplayers').innerHTML = Array.from({ length: MAX_PLAYERS }, (_, i) => {
    const p = G.players[i];
    return p ? `<div class="lp in ${p.online ? '' : 'off'}" data-pid="${p.id}" style="--pc:${p.color}"><div class="lpav" style="background:${p.color}">${p.emoji}<span class="psym">${symOf(p)}</span></div><div class="lpname">${esc(p.name)}</div></div>`
      : `<div class="lp empty"><div class="lpav">?</div><div class="lpname">aguardando…</div></div>`;
  }).join('');
  $('#tval').textContent = G.maxTurns;
  document.querySelectorAll('.lmap').forEach(b => b.classList.toggle('sel', b.dataset.map === G.map));
  document.querySelectorAll('.ldyn').forEach(b => b.classList.toggle('sel', G.dyns.includes(b.dataset.d)));
  $('#kidbtn').textContent = G.kid ? '👨‍👩‍👧 Modo 10+: LIGADO' : '👨‍👩‍👧 Modo 10+: desligado';
  $('#kidbtn').classList.toggle('sel', !!G.kid);
  const mins = Math.round(G.maxTurns * (1.6 + Math.max(2, G.players.length) * 0.45));
  $('#tdur').textContent = `≈ ${mins} min`;
  const sb = $('#startbtn');
  sb.disabled = G.players.length < 2;
  sb.textContent = G.players.length < 2 ? 'Precisa de pelo menos 2 jogadores' : '▶ COMEÇAR O SHOW';
}

/* =========================================================================
   TV — fluxo principal do jogo
   ========================================================================= */
function miniMap(id) {
  const b = buildBoard(MAPS[id]), th = MAPS[id].theme;
  return `<svg viewBox="0 0 1200 800" class="mini"><rect width="1200" height="800" rx="60" fill="${th.fill}"/>
    ${b.paths.map(ch => `<path d="${smoothPath(ch.map(i => [b.nodes[i].x, b.nodes[i].y]))}" fill="none" stroke="${th.road}" stroke-width="34" stroke-linecap="round"/>`).join('')}
    ${b.nodes.map(n => `<circle cx="${n.x}" cy="${n.y}" r="${n.j ? 24 : 18}" fill="${SPACE[n.type].c}"/>`).join('')}</svg>`;
}

// Moncrofones bônus: 3 sorteados por partida
const BONUS = {
  genio:   { e: '🧠', n: 'Gênio', d: 'Quem mais acertou perguntas', f: p => p.stats.correct },
  magnata: { e: '💰', n: 'Magnata', d: 'Quem mais ganhou Moncoins', f: p => p.stats.earned },
  encrenca:{ e: '😈', n: 'Encrenqueiro', d: 'Quem mais usou itens nos outros', f: p => p.stats.attacks },
  marat:   { e: '🏃', n: 'Maratonista', d: 'Quem mais andou casas', f: p => p.stats.steps },
  sortudo: { e: '🍀', n: 'Pé Quente', d: 'Quem mais caiu em casas azuis', f: p => p.stats.blue },
  azarado: { e: '🌧️', n: 'Pé Frio', d: 'Quem mais caiu em casas ruins', f: p => p.stats.bad },
  consum:  { e: '🛍️', n: 'Consumista', d: 'Quem mais gastou na loja', f: p => p.stats.spent },
  duel:    { e: '⚔️', n: 'Duelista', d: 'Quem mais venceu duelos', f: p => p.stats.duels },
  alvo:    { e: '🎯', n: 'Alvo Preferido', d: 'Quem mais sofreu ataques', f: p => p.stats.hit },
  rapido:  { e: '⚡', n: 'Dedo Rápido', d: 'Resposta certa mais rápida, na média (3 ou mais acertos)', f: p => p.stats.fastN >= 3 ? 100000 - Math.round(p.stats.fastT / p.stats.fastN) : 0 },
  colec:   { e: '🎒', n: 'Colecionador', d: 'Quem mais ganhou itens', f: p => p.stats.got },
  figura:  { e: '🎭', n: 'Figurinha Carimbada', d: 'Quem mais caiu em casas especiais', f: p => p.stats.special },
};

async function startGame() {
  SFX.init();
  loadMap(G.map); buildBoardSVG();
  G.phase = 'intro';
  G.order = shuffle(G.players.map(p => p.id));
  G.players.forEach(p => { p.node = BOARD.start; p.coins = START_COINS; p.stars = 0; p.items = []; p.debuff = newDebuff(); p.buff = newBuff(); p.stats = newStats(); delete p.skip; });
  G.turn = 1; G.pIdx = 0; G.traps = {}; G.bank = 5; G.reverseTurn = 0; G.chosers = []; G.dynBag = []; G.lastDyn = null;
  G.bonus = shuffle(Object.keys(BONUS)).slice(0, 3);
  G.nextDyn = nextDyn();
  placeStar();
  stageMode('board'); renderSide(); scheduleSync();
  waitAll('🎬 O show vai começar!', LOOK());
  SFX.fanfare();
  const nd = DYNS[G.nextDyn];
  overlay(`<div class="intro"><div class="introT">QUE COMECE O SHOW!</div>
    <div class="introOrder">${G.order.map((id, i) => { const p = P(id); return `<div class="io" style="--pc:${p.color};animation-delay:${i * 0.15}s"><b>${i + 1}º</b><span class="lpav" style="background:${p.color}">${p.emoji}</span>${esc(p.name)}</div>`; }).join('')}</div>
    <div class="introRules">🎲 Role o dado e ande · ${MIC} Passou pelo ${STAR}? Compre por ${STAR_PRICE} ${COIN}<br>📺 No fim de cada turno tem <b>Monquiz</b> · 🏆 Vence quem tiver mais ${STARS}<br>🎒 Itens só antes do dado, um por turno · ⏰ ${DECIDE / 1000} s para cada decisão</div>
    <div class="introNext">Primeiro Monquiz: <b>${nd.e} ${nd.n}</b></div></div>`, 'center');
  await say(`Boa noite, boa noite! Eu sou o Monc, e este é o Monc's Show! O programa de maior audiência... desta sala! Serão ${G.maxTurns} turnos. Passou pelo ${STAR} de Ouro, pode comprar por ${STAR_PRICE} Moncoins. No fim de cada turno: Monquiz! E o primeiro vai ser ${nd.n}. A ordem foi sorteada. Boa sorte!`, { wait: true });
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
  if (G.turn > 1) await showOrder();
  if (G.turn === G.maxTurns - 2) {
    SFX.fanfare();
    const last = G.players.slice().sort((a, b) => rankOf(b) - rankOf(a))[0];
    banner('🔥', 'RETA FINAL!', 'Faltam 3 turnos: casas azuis e vermelhas valem o DOBRO', 3800, 'hot');
    await say(`Atenção, câmera um! Começou a reta final! Faltam só três turnos, e as casas azuis e vermelhas agora valem o dobro! E pra apimentar, ${last.name}, que está em último, ganha dez Moncoins do nosso patrocinador!`, { wait: true });
    addCoins(last, 10);
    await sleep(T(800));
  } else {
    if (G.turn > 1) await comebackBonus();
    banner('🎲', `TURNO ${G.turn} DE ${G.maxTurns}`, G.turn === G.maxTurns ? 'Último turno! O Monquiz vale o DOBRO' : '', 1800);
    await say(G.turn === G.maxTurns ? 'Último turno! E o Monquiz de hoje é a Grande Final: prêmios em dobro!' : pick([`Turno ${G.turn}! Voltamos do intervalo!`, `Começando o turno ${G.turn}! Alphie, solta a vinheta!`, `Turno ${G.turn}. Quem vai brilhar no horário nobre?`]));
  }
  if (G.reverseTurn === G.turn) {
    SFX.evil();
    banner('🔄', 'INVERTERAM O ROTEIRO!', 'Neste turno todo mundo anda no sentido contrário', 3000, 'hot');
    await say('Lembrem: o Diretor inverteu o roteiro! Neste turno, todo mundo anda pra trás!', { wait: true });
  }
}

// a partir do 2º turno, a ordem segue a classificação do último Monquiz
async function showOrder() {
  overlay(`<div class="intro"><div class="introT small">ORDEM DO TURNO ${G.turn}</div><div class="introSub">pela classificação do último Monquiz</div>
    <div class="introOrder">${G.order.map((id, i) => { const p = P(id); return `<div class="io" style="--pc:${p.color};animation-delay:${i * 0.12}s"><b>${i + 1}º</b><span class="lpav" style="background:${p.color}">${p.emoji}</span>${esc(p.name)}</div>`; }).join('')}</div></div>`, 'center');
  await say(`Quem foi melhor no Monquiz joga primeiro: ${P(G.order[0]).name} abre o turno!`);
  await sleep(T(1900));
  closeOverlay();
}

async function comebackBonus() {
  const n = G.players.length; if (n < 2) return;
  const byRank = G.players.slice().sort((a, b) => rankOf(b) - rankOf(a));
  const ps = byRank.slice(0, n >= 4 ? 2 : 1).filter(p => rankOf(p) > 1);
  if (!ps.length) return;
  banner('🤝', 'AJUDINHA DA PRODUÇÃO', `${ps.map(p => p.name).join(' e ')} ${ps.length > 1 ? 'ganham' : 'ganha'} +3 ${COIN}`, 2200);
  ps.forEach(p => addCoins(p, 3));
  await say(`Ajudinha da produção: ${ps.map(p => p.name).join(' e ')} ${ps.length > 1 ? 'ganham' : 'ganha'} três Moncoins pra correr atrás!`);
}

const usableItems = p => [...new Set(p.items)].filter(k => !ITEMS[k].passive && !(k === 'trap' && G.traps[p.node] !== undefined));

async function playerTurn(p) {
  await voiceIdle();
  G.cur = p.id; stageMode('board'); renderSide();
  if (p.skip) {
    delete p.skip; renderSide();
    tokAnim(p, 'sad', 1400);
    banner('☕', `${p.name} está na pausa para o café`, 'Perdeu este turno', 2600);
    waitAll(`☕ ${p.name} perdeu o turno`, 'Pausa para o café, ordem do Diretor');
    await say(`${p.name} ainda está no cafezinho! Ordem do Diretor: perdeu a vez!`, { wait: true });
    await sleep(T(600));
    return;
  }
  waitAll(`${p.emoji} Vez de ${p.name}`, LOOK(), p);
  say(pick([`Vez de ${p.name}! Capricha nesse dado!`, `${p.name}, a câmera é toda sua!`, `Bora, ${p.name}! Mostra pra audiência!`, `${p.name}, sua vez! Sem pressão... mas a câmera dois tá em você.`]));
  let used = false, dice = 1, fixed = null, crazy = false;
  diceIdle(p, 1);
  for (;;) {
    const r = await ask(p, { screen: 'turn', items: used ? [] : usableItems(p), dice, crazy, next: G.nextDyn }, T(DECIDE), { a: 'roll' }, '🎲 Rolando…');
    if (!r || r.a === 'roll') break;
    if (r.a === 'item' && !used && p.items.includes(r.k)) {
      diceHide();
      const res = await useItem(p, r.k);
      if (res === false) { diceIdle(p, dice, crazy); continue; }
      used = true; renderSide();
      if (res && res.fixed) { fixed = res.fixed; break; }
      if (res && res.dice) dice = res.dice;
      if (res && res.crazy) crazy = true;
      diceIdle(p, dice, crazy);
    }
  }
  const rolls = fixed ? [fixed] : crazy ? [rnd(16) - 3] : Array.from({ length: dice }, () => 1 + rnd(10));
  const total = rolls.reduce((a, b) => a + b, 0);
  waitUI(p, `🎲 Você tirou ${total}!`, total < 0 ? 'Andando para trás…' : 'Andando…');
  await diceResult(rolls, !!fixed, crazy);
  say(total < 0 ? pick([`${total}! Marcha a ré, ${p.name}!`, `Dado maluco deu ${total}! Volta, volta!`]) : total === 0 ? `Zero! ${p.name} fica onde está.` : total >= 9 ? pick([`${total}! Que dadada!`, `Uau, ${total} casas! Alguém filma isso!`]) : total <= 2 ? pick([`Só ${total}... devagar e sempre.`, `${total}? O orçamento tá curto até no dado.`]) : `${total} casas!`);
  const dir = G.reverseTurn === G.turn ? -1 : 1;
  await move(p, Math.abs(total), false, total < 0 ? -dir : dir);
  diceHide();
  await land(p);
  renderSide();
  await voiceIdle();
  await sleep(T(700));
}

/* ---------- dado ---------- */
let diceTimer = null;
const dieFace = crazy => crazy ? rnd(16) - 3 : 1 + rnd(10);
function diceIdle(p, n, crazy) {
  const db = $('#dicebox'); db.classList.remove('hidden');
  placeDice(p);
  db.innerHTML = `<div class="dwho" style="--pc:${p.color}">${p.emoji} ${esc(p.name)}</div><div class="dice-row">${Array.from({ length: n }, () => `<div class="die rolling ${crazy ? 'crazy' : ''}">?</div>`).join('')}</div><div class="dhint">${crazy ? '🤪 Dado maluco: de −3 a 12!' : `👆 Toque em <b>ROLAR</b> ${G.online ? 'no painel' : 'no celular'}`}</div>`;
  clearInterval(diceTimer);
  diceTimer = setInterval(() => { db.querySelectorAll('.die.rolling').forEach(d => d.textContent = dieFace(crazy)); }, 90);
}
async function diceResult(rolls, fixed, crazy) {
  const db = $('#dicebox'); clearInterval(diceTimer);
  db.classList.add('big');
  for (let i = 0; i < 12; i++) { db.querySelectorAll('.die').forEach(d => d.textContent = dieFace(crazy)); SFX.dice(); await sleep(T(fixed ? 30 : 60 + i * 6)); }
  const dies = db.querySelectorAll('.die');
  rolls.forEach((r, i) => { if (dies[i]) { dies[i].textContent = r; dies[i].classList.remove('rolling'); dies[i].classList.add('done'); if (r < 0) dies[i].classList.add('neg'); } });
  SFX.pop();
  const total = rolls.reduce((a, b) => a + b, 0);
  $('.dhint', db).innerHTML = rolls.length > 1 ? `Total: <b>${total}</b>` : fixed ? '🎯 Dado de Ouro!' : total < 0 ? `<b>${total}</b>: para trás!` : '&nbsp;';
  await sleep(T(1100));
  db.classList.remove('big');
}
function diceSteps(n) { const h = $('#dicebox .dhint'); if (h) h.innerHTML = `Faltam <b>${n}</b> casa${n === 1 ? '' : 's'}`; }
function diceHide() { clearInterval(diceTimer); $('#dicebox').classList.add('hidden'); }

/* ---------- movimento ---------- */
function setPreview(p, left, dir = 1) { G.steps = left; G.preview = left > 0 ? dests(p.node, left, dir) : null; renderBoard(); placeDice(p); }

// coloca a caixa do dado no espaço livre mais longe do jogador e das casas de destino
function placeDice(p) {
  const db = $('#dicebox'); if (!db || !p) return;
  const pts = [[NODES[p.node].x, NODES[p.node].y]];
  if (G.preview) { G.preview.list.forEach(d => pts.push([NODES[d.end].x, NODES[d.end].y])); if (G.preview.fb != null) pts.push([NODES[G.preview.fb].x, NODES[G.preview.fb].y]); }
  let best = MAP.dice[0], bd = -1;
  MAP.dice.forEach(sp => { const d = Math.min(...pts.map(q => Math.hypot(q[0] - sp[0], q[1] - sp[1]))); if (d > bd) { bd = d; best = sp; } });
  db.style.left = best[0] * BS + 'px'; db.style.top = best[1] * BS + 'px';
}

// dir: 1 = para frente, −1 = para trás (Dado Maluco negativo ou roteiro invertido)
async function move(p, steps, extra, dir = 1) {
  let left = steps;
  if (dir < 0 && steps > 0) { tokAnim(p, 'back', 1200); floatText(p, '⏪ para trás', '#f0abfc'); }
  setPreview(p, left, dir);
  await sleep(T(extra ? 400 : 900));            // dá tempo de ver onde pode cair
  while (left > 0) {
    diceSteps(left);
    const node = NODES[p.node], nb = nbrs(p.node, dir);
    let nx = nb[0];
    if (nb.length > 1) {
      const pv = dests(p.node, left, dir);
      const opts = nb.map((id, i) => ({
        id, color: BR[i % BR.length].c, pat: BR[i % BR.length].sample,
        label: (dir < 0 ? BOARD.back[node.id + '<' + id] : BOARD.branch[node.id + '>' + id]) || (dir < 0 ? 'Voltar por aqui' : 'Seguir'),
        land: [...new Set(pv.list.filter(d => d.ci === i).map(d => d.end))],
      }));
      branchLegend(opts, left);
      say(`${p.name}, escolha o caminho!`);
      const r = await ask(p, { screen: 'choose', title: '🔀 Escolha o caminho', sub: `Faltam ${left} casas · cor, número e linha iguais aos do tabuleiro`,
        opts: opts.map((o, i) => ({ label: `${i + 1} · ${o.label}`, sub: 'Você cai em: ' + o.land.map(spaceDesc).join(' ou '), color: o.color, pat: o.pat })) },
        T(DECIDE), { i: rnd(opts.length) }, '👍 Caminho escolhido');
      nx = (opts[r && r.i] || opts[0]).id;
      waitUI(p, '🚶 Andando…');
    }
    p.node = nx; left--; p.stats.steps++;
    SFX.step(); setPreview(p, left, dir);
    await sleep(T(340));
    if (p.node === G.star) { await offerStar(p, left === 0); if (left === 0) p._onStar = true; }
    else if (left > 0 && NODES[p.node].type === 'K') await bankPass(p);
  }
  diceSteps(0);
  G.steps = 0; G.preview = null; renderBoard();
}

function branchLegend(opts, left) {
  const h = $('#dicebox .dhint'); if (!h) return;
  h.innerHTML = `<div class="legend-t">🔀 Escolha ${G.online ? 'no painel' : 'no celular'} · faltam <b>${left}</b></div>` + opts.map((o, i) =>
    `<div class="legend" style="--bc:${o.color}"><span class="lg-n">${i + 1}</span><span class="lg-l">${esc(o.label)} <span class="lg-p">${o.pat}</span></span><span class="lg-d">🎯 ${o.land.map(spaceDesc).join(' / ')}</span></div>`).join('');
}

async function bankPass(p) {
  const v = Math.min(2, p.coins);
  if (v > 0) { floatText(p, '🏦 pedágio −' + v, '#fca5a5'); await coinFlight(pXY(p), nXY(p.node), v); addCoins(p, -v, true); G.bank += v; renderBoard(); renderSide(); }
}

async function offerStar(p, landing) {
  const sn = G.star;
  if (p.coins < STAR_PRICE) {
    SFX.lose();
    banner(MIC, `${p.name} passou pelo ${STAR}`, `Mas só tem ${mc(p.coins)}… precisa de ${STAR_PRICE}`, 2200);
    await say(pick([`${p.name} passou pelo ${STAR}, mas cadê o cachê?`, `Ihh, ${p.name}, faltou Moncoin pro ${STAR}!`]), { wait: true });
    return;
  }
  say(`${p.name} chegou no ${STAR} de Ouro! Vai comprar?`);
  const r = await ask(p, { screen: 'choose', title: `${MIC} Comprar um ${STAR} por ${STAR_PRICE} ${COIN}?`, sub: `Você tem ${mc(p.coins)}`, opts: [{ label: `${MIC} Sim, comprar!` }, { label: 'Não, obrigado' }] }, T(DECIDE), { i: 0 }, MIC);
  if (r && r.i === 0) {
    await coinFlight(pXY(p), nXY(G.star), 8);
    addCoins(p, -STAR_PRICE, true); p.stars++;
    burst(nXY(G.star), [MIC, '✨', '🌟'], 16, 180);
    SFX.fanfare(); floatText(p, '+1 ' + MIC, '#fde047');
    overlay(`<div class="starwin"><div class="sw-star">${MIC}</div><div class="sw-t">${esc(p.name)} ganhou um ${STAR} de Ouro!</div><div class="sw-s">Agora tem ${mics(p.stars)}</div></div>`, 'center');
    await say(pick([`${p.name} comprou um ${STAR} de Ouro! Que momento!`, `${STAR} pra ${p.name}! Solta a placa de aplausos!`]), { wait: true });
    await sleep(T(600));
    closeOverlay();
    placeStar(sn); renderSide();
    SFX.whoosh();
    banner('✨', `O ${STAR} mudou de lugar!`, 'Os contra-regras já levaram pra outra casa', 1800);
    await sleep(T(900));
  } else {
    await say(`${p.name} recusou o ${STAR}! Que coragem... ou que loucura?`);
  }
}

/* ---------- casas ---------- */
async function land(p, depth = 0) {
  const n = NODES[p.node];
  if (p._onStar) { delete p._onStar; return; }
  // armadilha escondida
  const tr = G.traps[p.node];
  if (tr !== undefined && tr !== p.id) {
    const o = P(tr);
    delete G.traps[p.node]; renderBoard();
    if (o) {
      SFX.hit(); flash(pXY(p), 'boom'); burst(pXY(p), ['🪤', '💥'], 12, 130); tokAnim(p, 'hit');
      banner('🪤', `${p.name} caiu na armadilha escondida de ${o.name}!`, 'Paga 5 ' + COIN, 2400, 'hot');
      if (!(await useCut(p, 'a armadilha'))) {
        const v = Math.min(5, p.coins);
        if (v) await coinFlight(pXY(p), pXY(o), v);
        addCoins(p, -v); addCoins(o, v); p.stats.bad++;
        tokAnim(o, 'cheer');
        await say(`Surpresa! Tinha uma armadilha escondida de ${o.name} aí! ${p.name} pagou ${mc(v)}!`, { wait: true });
      }
    }
  }
  const mult = finalStretch() ? 2 : 1;
  if (['E', 'D', 'G', 'S2', 'V', 'T', 'K'].includes(n.type)) p.stats.special++;
  switch (n.type) {
    case 'B': {
      addCoins(p, 3 * mult); p.stats.blue++; burst(pXY(p), [COIN, '✨'], 8, 90);
      await say(pick([`Casa azul! ${p.name} ganhou ${mc(3 * mult)}!`, `Moncoins pra ${p.name}! Cortesia do patrocinador!`]));
      break;
    }
    case 'R': {
      p.stats.bad++;
      if (await useCut(p, 'a casa vermelha')) break;
      const d = addCoins(p, -3 * mult); flash(pXY(p), 'boom');
      await say(d ? pick([`Casa vermelha! ${p.name} perdeu ${mc(-d)}!`, `Ihh, casa vermelha. Que fase, ${p.name}!`]) : `Casa vermelha, mas ${p.name} já estava sem um tostão!`);
      break;
    }
    case 'E': await roulette(p, depth); break;
    case 'D': await duel(p); break;
    case 'G': {
      const k = randomItemFor(p);
      SFX.pop();
      const ok = giveItem(p, k);
      if (ok) itemPop(p, k);
      banner('🎁', `${p.name} ganhou um presente!`, ok ? `${ITEMS[k].e} ${ITEMS[k].n} (nível ${TIERS[ITEMS[k].tier].n})` : 'Mochila cheia: virou 3 Moncoins', 2400);
      await say(ok ? `Presente do patrocinador! ${p.name} ganhou: ${ITEMS[k].n}!` : `Presente! Mas a mochila de ${p.name} tá cheia. Leva três Moncoins!`, { wait: true });
      break;
    }
    case 'S2': await shop(p); break;
    case 'K': {
      const v = G.bank; if (v) await coinFlight(nXY(p.node), pXY(p), v); G.bank = 0; renderBoard();
      SFX.fanfare();
      addCoins(p, v);
      banner('🏦', `${p.name} caiu no banco!`, `Levou o acumulado: ${mc(v)}`, 2600);
      await say(`Caiu no banco! ${p.name} leva tudo: ${mc(v)}!`, { wait: true });
      break;
    }
    case 'V': await director(p, depth); break;
    case 'T': await thief(p); break;
    case 'I': await iceSlide(p, depth); break;
    case 'C': await cableCar(p); break;
    case 'A': await avalanche(p); break;
    case 'F': {
      p.stats.bad++;
      if (await useCut(p, 'a lava')) break;
      const d = addCoins(p, -6 * mult); burst(pXY(p), ['🔥', '🔥', '💥'], 14, 140); flash(pXY(p), 'boom'); tokAnim(p, 'hit');
      await say(d ? `Lava! ${p.name} queimou ${mc(-d)}! Alguém traz o extintor!` : `Lava! Ainda bem que ${p.name} não tinha Moncoins pra queimar.`, { wait: true });
      break;
    }
    case 'Y': await geyser(p, depth); break;
    case 'Z': await eruption(p); break;
    default: break;
  }
}

// casas para onde dá para ser teleportado
const teleSpots = (p, avoid = []) => NODES.filter(n => n.id !== p.node && !n.j && n.type !== 'S' && !avoid.includes(n.type));
async function teleport(p, depth, avoid) {
  const dest = pick(teleSpots(p, avoid)).id;
  const from = tokenPos(p);
  SFX.whoosh(); flash(pXY(p), 'shield'); burst(pXY(p), ['🌀', '✨'], 12, 120);
  p.node = dest; renderBoard();
  await arcTokens([{ p, from, to: tokenPos(p) }]);
  burst(pXY(p), ['🌀', '✨'], 12, 120);
  await say(`Teletransporte! ${p.name} foi parar em: ${spaceDesc(dest)}!`, { wait: true });
  if (dest === G.star) { await offerStar(p, true); return; }
  await land(p, depth + 1);
}

async function roulette(p, depth = 0) {
  const outs = [
    { l: '+6 Moncoins', e: '💰' }, { l: '−4 Moncoins', e: '💸' }, { l: 'Ganhe um item', e: '🎁' }, { l: 'Teletransporte!', e: '🌀' },
    { l: 'Cada rival te dá 2', e: '🤑' }, { l: 'Pergunta bônus +8', e: '❔' }, { l: 'Você dá 1 a cada um', e: '🎅' }, { l: '+3 Moncoins', e: COIN },
  ];
  const idx = rnd(outs.length);
  say(`Roleta da sorte! Gira, Alphie!`);
  await spinWheel('🎡 ROLETA DA SORTE', outs.map(o => o.e + ' ' + o.l), idx, `${p.emoji} ${esc(p.name)}`);
  closeOverlay();
  switch (idx) {
    case 0: addCoins(p, 6); burst(pXY(p), [COIN, '💰'], 10, 110); await say(`Seis Moncoins pra ${p.name}!`, { wait: true }); break;
    case 1: {
      if (await useCut(p, 'a perda de 4 Moncoins')) break;
      p.stats.bad++; addCoins(p, -4); await say(`Ai! ${p.name} perdeu quatro Moncoins! Sumiram, ninguém sabe pra onde.`, { wait: true }); break;
    }
    case 2: { const k = randomItemFor(p); const ok = giveItem(p, k); SFX.pop(); if (ok) itemPop(p, k); banner(ok ? ITEMS[k].e : '🎒', ok ? `${p.name} ganhou ${ITEMS[k].n}` : 'Mochila cheia: +3 Moncoins', ok ? `Nível ${TIERS[ITEMS[k].tier].n}` : '', 2200); await say(ok ? `${p.name} ganhou ${ITEMS[k].n}!` : `Mochila cheia! Três Moncoins então.`, { wait: true }); break; }
    case 3: await teleport(p, depth, ['E']); break;
    case 4: {
      let tot = 0; const fl = [];
      others(p).forEach(x => { const v = Math.min(2, x.coins); if (v) fl.push(coinFlight(pXY(x), pXY(p), v)); addCoins(x, -v, true); tot += v; });
      await Promise.all(fl);
      addCoins(p, tot);
      await say(`Todo mundo paga dois Moncoins pra ${p.name}! Dói no bolso, né?`, { wait: true }); break;
    }
    case 5: {
      const q = drawQ(randTheme(), 'm');
      say(`Pergunta bônus pra ${p.name}! Acertou, leva oito Moncoins!`);
      const ans = await soloQuestion(p, q, '❔ Pergunta bônus (+8)');
      if (ans) { addCoins(p, 8); applause(); await say(`Acertou! Oito Moncoins!`, { wait: true }); }
      else { await say(`Errou! Fica pra próxima.`, { wait: true }); }
      break;
    }
    case 6: {
      if (await useCut(p, 'o espírito natalino')) break;
      // sem dinheiro para todos: paga do pior para o melhor colocado até acabar
      const fl = [];
      others(p).sort((a, b) => rankOf(b) - rankOf(a)).forEach(x => { if (p.coins > 0) { fl.push(coinFlight(pXY(p), pXY(x), 1)); addCoins(p, -1, true); addCoins(x, 1, true); } });
      await Promise.all(fl);
      SFX.lose(); renderSide();
      await say(`Espírito natalino! ${p.name} dá um Moncoin pra cada rival, começando pelo último colocado!`, { wait: true }); break;
    }
    case 7: addCoins(p, 3); await say(`Três Moncoins pra ${p.name}!`, { wait: true }); break;
  }
}

function spinWheel(title, labels, idx, who, cls = '') {
  const n = labels.length, seg = 360 / n;
  const cols = ['#f43f5e', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#84cc16', '#ef4444', '#14b8a6'];
  const R = 250;
  const slices = labels.map((l, i) => {
    const a0 = (i * seg - 90) * Math.PI / 180, a1 = ((i + 1) * seg - 90) * Math.PI / 180;
    const x0 = Math.cos(a0) * R, y0 = Math.sin(a0) * R, x1 = Math.cos(a1) * R, y1 = Math.sin(a1) * R;
    const am = (i + 0.5) * seg;
    return `<path d="M0,0 L${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1} Z" fill="${cols[i % cols.length]}" stroke="#fff" stroke-width="3"/>
      <text transform="rotate(${am}) translate(0,${-R + 22}) rotate(90)" class="wtext ${n > 8 ? 'sm' : ''}" text-anchor="start" dy="7">${esc(l)}</text>`;
  }).join('');
  overlay(`<div class="wheelbox ${cls}"><div class="wtitle">${title}</div>${who ? `<div class="wwho">${who}</div>` : ''}
    <div class="wheelwrap"><svg viewBox="-270 -270 540 540" class="wheel"><g id="wheelG" data-keep="style">${slices}</g><circle r="38" fill="#0f172a" stroke="#fde047" stroke-width="6"/><text class="wcenter" text-anchor="middle" dy="10">?</text></svg>
    <div class="wpointer">▼</div></div><div id="wres" class="wres"></div></div>`, 'center');
  const g = $('#wheelG');
  const final = 360 * 6 + (360 - (idx * seg + seg / 2)) + (Math.random() - 0.5) * seg * 0.5;
  g.style.transition = `transform ${T(3600)}ms cubic-bezier(.12,.75,.12,1)`;
  let ticks = 0; const ti = setInterval(() => { if (ticks++ < 25) SFX.tick(); else clearInterval(ti); }, T(120));
  requestAnimationFrame(() => requestAnimationFrame(() => { g.style.transform = `rotate(${final}deg)`; mFx('wheel', [final, T(3600)]); }));
  return sleep(T(3800)).then(async () => {
    clearInterval(ti); SFX.pop();
    const r = $('#wres'); if (r) r.textContent = labels[idx];
    await sleep(T(1300));
  });
}

// loja: 8 itens sorteados, uma compra por visita
function shopStock() {
  const W = { low: 40, mid: 30, risky: 20, high: 10 }, out = [];
  let guard = 0;
  while (out.length < 8 && guard++ < 400) {
    const free = itemsOfTier(drawTier(W)).filter(k => !out.includes(k));
    if (free.length) out.push(pick(free));
  }
  return out;
}
async function shop(p) {
  const stock = shopStock(), full = p.items.length >= 3;
  say(full ? `Bem-vindo à loja, ${p.name}! Mas a mochila tá cheia, então é só pra olhar.` : `Bem-vindo à lojinha, ${p.name}! Uma compra por visita, aproveita!`);
  overlay(`<div class="shopbox"><div class="wtitle">🛒 LOJINHA DO MONC</div><div class="wwho">${p.emoji} ${esc(p.name)} está ${full ? 'só olhando (mochila cheia)' : 'comprando'}… (${COIN} ${p.coins})</div>
    <div class="shopgrid">${stock.map(k => `<div class="shopit t-${ITEMS[k].tier} ${full || p.coins < priceOf(k) ? 'cant' : ''}" data-k="${k}"><span class="si-tier">${TIERS[ITEMS[k].tier].n}</span><span class="si-e">${ITEMS[k].e}</span><b>${ITEMS[k].n}</b><span class="si-p">${priceOf(k)} ${COIN}</span></div>`).join('')}</div></div>`, 'center');
  const opts = stock.map(k => ({ label: `${ITEMS[k].e} ${ITEMS[k].n} — ${priceOf(k)} ${COIN}`, sub: `[${TIERS[ITEMS[k].tier].n}] ` + ITEMS[k].d, dis: full || p.coins < priceOf(k), color: TIERS[ITEMS[k].tier].c }));
  opts.push({ label: '🚪 Sair da loja' });
  const r = await ask(p, { screen: 'choose', title: full ? '🛒 Loja (mochila cheia: só olhar)' : `🛒 Loja — você tem ${p.coins} ${COIN}`, sub: 'Uma compra por visita', opts }, T(DECIDE), { i: opts.length - 1 }, '🛍️');
  const k = stock[r && r.i];
  if (k && !full && p.coins >= priceOf(k)) {
    const el = document.querySelector(`.shopit[data-k="${k}"]`); if (el) el.classList.add('bought');
    addCoins(p, -priceOf(k), true); p.stats.spent += priceOf(k); giveItem(p, k); SFX.coin();
    await sleep(T(700));
    closeOverlay(); itemPop(p, k);
    banner(ITEMS[k].e, `${p.name} comprou ${ITEMS[k].n}`, `por ${mc(priceOf(k))} · a loja fechou`, 2200);
    await say(`${p.name} comprou ${ITEMS[k].n}! Hum... alguém vai se dar mal.`, { wait: true });
  } else { closeOverlay(); await say(`${p.name} só veio olhar a vitrine.`); }
}

// ----- casas especiais dos mapas Neve e Vulcão
async function iceSlide(p, depth) {
  if (depth > 0) { await say('Gelo de novo, mas dessa vez deu pra frear!'); return; }
  const k = 1 + rnd(3), dir = G.reverseTurn === G.turn ? -1 : 1;
  SFX.whoosh(); burst(pXY(p), ['❄️', '💨'], 10, 110); tokAnim(p, 'slide', 1200);
  banner('🧊', `${p.name} escorregou no gelo!`, `Desliza mais ${k} casa${k > 1 ? 's' : ''}`, 1800);
  await say(`Escorregou! ${p.name} desliza mais ${k} ${k > 1 ? 'casas' : 'casa'}! Quem encerou esse chão?`);
  await move(p, k, true, dir);
  await land(p, depth + 1);
}
async function geyser(p, depth) {
  if (depth > 0) { await say('O gêiser está recarregando...'); return; }
  SFX.whoosh(); burst(pXY(p), ['💨', '💧', '💦'], 16, 160); flash(pXY(p), 'ice');
  banner('💨', `Gêiser! ${p.name} foi lançado!`, 'Avança 4 casas', 1800);
  await say(`Gêiser! ${p.name} voa quatro casas pra frente!`);
  await move(p, 4, true, 1);
  await land(p, depth + 1);
}
async function cableCar(p) {
  const other = NODES.find(n => n.type === 'C' && n.id !== p.node);
  if (!other) return;
  if (p.coins < 5) { await say(`Teleférico! Mas a passagem custa cinco Moncoins, e ${p.name} está sem dinheiro.`, { wait: true }); return; }
  say(`Teleférico! ${p.name}, quer pagar cinco Moncoins para ir até a outra estação?`);
  const r = await ask(p, { screen: 'choose', title: `🚡 Pegar o teleférico por 5 ${COIN}?`, sub: 'Leva você direto para a outra estação do mapa', opts: [{ label: '🚡 Sim, partiu!' }, { label: 'Não, fico aqui' }] }, T(DECIDE), { i: 1 }, '🚡');
  if (!r || r.i !== 0) { await say(`${p.name} preferiu ir a pé.`); return; }
  addCoins(p, -5);
  const from = tokenPos(p); p.node = other.id; renderBoard();
  await arcTokens([{ p, from, to: tokenPos(p) }]);
  burst(pXY(p), '✨', 10, 100);
  await say(`Lá vai ${p.name} pelo teleférico!`, { wait: true });
}
function stepBack(node, k) { let n = node; for (let i = 0; i < k; i++) { const pv = NODES[n].prev; if (!pv.length) break; n = pv[0]; } return n; }
async function avalanche(p) {
  SFX.evil(); flash(pXY(p), 'ice'); burst(pXY(p), ['❄️', '🏔️', '💨'], 22, 260);
  const hit = others(p).filter(o => Math.hypot(NODES[o.node].x - NODES[p.node].x, NODES[o.node].y - NODES[p.node].y) < 260);
  if (!hit.length) { await say(`Avalanche! Mas não tinha ninguém por perto. Sorte de todo mundo!`, { wait: true }); return; }
  banner('🏔️', 'AVALANCHE!', `${hit.map(o => o.name).join(', ')} ${hit.length > 1 ? 'voltam' : 'volta'} 3 casas`, 2400, 'hot');
  const moves = hit.map(o => { const from = tokenPos(o); o.node = stepBack(o.node, 3); return { p: o, from }; });
  renderBoard();
  await arcTokens(moves.map(m => ({ ...m, to: tokenPos(m.p) })));
  hit.forEach(o => tokAnim(o, 'hit'));
  await say(`Avalanche! ${hit.map(o => o.name).join(' e ')} ${hit.length > 1 ? 'foram arrastados' : 'foi arrastado'} três casas pra trás!`, { wait: true });
}
async function eruption(p) {
  SFX.evil(); flash(pXY(p), 'boom'); burst(pXY(p), ['🔥', '🪨', '💥'], 22, 260);
  const os = others(p); if (!os.length) return;
  const v = pick(os);
  let n = v.node, guard = 0;
  while (!NODES[n].j && NODES[n].prev.length && guard++ < 30) n = NODES[n].prev[0];
  banner('🌋', 'ERUPÇÃO!', `${v.name} volta para o começo do trecho`, 2400, 'hot');
  await projectile(pXY(p), pXY(v), '🪨', 800);
  await say(`Erupção! Uma pedra de lava acertou ${v.name}, que volta para o começo do trecho!`);
  const from = tokenPos(v); v.node = n; renderBoard();
  await arcTokens([{ p: v, from, to: tokenPos(v) }]);
  burst(pXY(v), ['🔥', '💥'], 10, 100); tokAnim(v, 'hit');
  await sleep(T(600));
}

// estrela voando de um jogador a outro
async function micFlight(from, to) {
  const st = document.createElement('div'); st.className = 'coinfly bigstar'; st.textContent = MIC;
  st.style.left = from[0] + 'px'; st.style.top = from[1] + 'px'; $('#fx').appendChild(st);
  mFx('proj', [from, to, MIC, 1500]);
  st.animate([{ transform: 'translate(-50%,-50%) scale(.5)' }, { transform: `translate(-50%,-50%) translate(${(to[0] - from[0]) / 2}px,${(to[1] - from[1]) / 2 - 200}px) scale(2.4)`, offset: 0.5 }, { transform: `translate(-50%,-50%) translate(${to[0] - from[0]}px,${to[1] - from[1]}px) scale(1)` }], { duration: T(1500), easing: 'ease-in-out', fill: 'forwards' });
  SFX.whoosh(); await sleep(T(1500)); st.remove();
}

async function thief(p) {
  SFX.evil();
  const targets = others(p).filter(o => o.stars > 0);
  banner('🦹', 'ESCONDERIJO DO LADRÃO', `Por ${mc(STEAL_PRICE)}, ${p.name} pode roubar um ${STAR}!`, 2600, 'hot');
  if (!targets.length || p.coins < STEAL_PRICE) {
    const lead = G.players.slice().sort((a, b) => rankOf(a) - rankOf(b)).find(o => o.id !== p.id && o.coins > 0);
    await say(!targets.length ? `Ninguém tem ${STAR} pra roubar ainda! Mas o ladrão é camarada...` : `Sem ${STEAL_PRICE} Moncoins, ${p.name}? O ladrão é camarada...`, { wait: true });
    if (lead) {
      const v = Math.min(5, lead.coins);
      await coinFlight(pXY(lead), pXY(p), v); addCoins(lead, -v); addCoins(p, v);
      await say(`Ele afanou ${mc(v)} de ${lead.name} e deu pra ${p.name}!`, { wait: true });
    }
    return;
  }
  say(`${p.name}, quer pagar ${STEAL_PRICE} Moncoins para roubar um ${STAR}? Escolha a vítima!`);
  const r = await ask(p, { screen: 'pick', title: `🦹 Roubar um ${STAR} por ${STEAL_PRICE} ${COIN}?`, sub: 'Escolha de quem roubar (o Escudo não protege!)', opts: pickOpts(targets), cancel: true }, T(DECIDE), null, '🦹');
  const v = r && r.id && P(r.id);
  if (!v || !targets.includes(v)) { await say(`${p.name} desistiu do roubo. A consciência falou mais alto!`, { wait: true }); return; }
  await coinFlight(pXY(p), nXY(p.node), 10);
  addCoins(p, -STEAL_PRICE, true);
  await micFlight(pXY(v), pXY(p));
  v.stars--; p.stars++; p.stats.attacks++; v.stats.hit++;
  tokAnim(v, 'hit'); tokAnim(p, 'cheer');
  burst(pXY(p), [MIC, '✨'], 16, 170); SFX.fanfare(); renderSide(); scheduleSync();
  banner('🦹', `${p.name} roubou um ${STAR} de ${v.name}!`, `Pagou ${mc(STEAL_PRICE)}`, 3000, 'hot');
  await say(`Que golpe! ${p.name} roubou um ${STAR} de ${v.name}! Corta pro comercial que isso vai dar briga!`, { wait: true });
}

// Diretor: uma roleta com 10 efeitos absurdos
async function director(p, depth = 0) {
  SFX.evil();
  const outs = [
    { l: 'Inverteram o roteiro', e: '🔄' }, { l: 'Ensaio de dança', e: '💃' }, { l: 'Trocaram as plaquinhas', e: '🪧' }, { l: 'Mudança de cenário', e: '🎬' },
    { l: 'Corte de verba', e: '✂️' }, { l: 'Patrocínio surpresa', e: '💵' }, { l: 'Figurante perdido', e: '🚶' }, { l: 'Pausa para o café', e: '☕' },
    { l: 'Câmera escondida', e: '📹' }, { l: 'Quiz relâmpago', e: '⚡' },
  ];
  say(`Ihhh! ${p.name} caiu na casa do Diretor! Ele está com o megafone na mão...`);
  $('#host').classList.add('evil');
  const idx = rnd(outs.length);
  await spinWheel('📣 O DIRETOR MANDOU…', outs.map(o => o.e + ' ' + o.l), idx, `${p.emoji} ${esc(p.name)}`, 'dir');
  closeOverlay();
  const leaders = () => G.players.filter(x => rankOf(x) === 1);
  try {
    switch (idx) {
      case 0: {
        G.reverseTurn = G.turn + 1; renderSide();
        banner('🔄', 'INVERTERAM O ROTEIRO!', G.turn >= G.maxTurns ? 'Mas o show já está acabando…' : 'No próximo turno, todos andam no sentido contrário', 2800, 'hot');
        await say(G.turn >= G.maxTurns ? 'O Diretor inverteu o roteiro... mas o show já está acabando! Ninguém avisou ele?' : 'O Diretor inverteu o roteiro! No próximo turno, todo mundo anda pra trás!', { wait: true });
        break;
      }
      case 1: {
        const ls = leaders();
        banner('💃', 'ENSAIO DE DANÇA!', `Quem está em 1º paga 5 ${COIN} ao banco: ${ls.map(x => x.name).join(', ')}`, 2800, 'hot');
        for (const x of ls) { if (x === p && await useCut(p, 'o ensaio de dança')) continue; tokAnim(x, 'dance', 1600); await payBank(x, 5); }
        await say(`Ensaio de dança obrigatório pra quem está em primeiro! ${ls.map(x => x.name).join(' e ')} ${ls.length > 1 ? 'pagam' : 'paga'} cinco Moncoins pro banco!`, { wait: true });
        break;
      }
      case 2: {
        const o = pick(others(p));
        if (o.coins < p.coins && await useCut(p, 'a troca de plaquinhas')) break;
        await Promise.all([coinFlight(pXY(p), pXY(o), 6), coinFlight(pXY(o), pXY(p), 6)]);
        const a = p.coins, b = o.coins; p.coins = b; o.coins = a; SFX.whoosh();
        floatText(p, `🪧 ${a} → ${b}`, '#fff'); floatText(o, `🪧 ${b} → ${a}`, '#fff');
        renderSide(); scheduleSync();
        banner('🪧', 'TROCARAM AS PLAQUINHAS!', `${p.name} (${a}) ⇄ ${o.name} (${b})`, 2800);
        await say(`Trocaram as plaquinhas! ${p.name} e ${o.name} trocaram todos os Moncoins!`, { wait: true });
        break;
      }
      case 3: {
        const old = G.star; placeStar(G.star); SFX.whoosh(); renderBoard();
        if (old != null) burst(nXY(old), ['💨'], 8, 80);
        burst(nXY(G.star), [MIC, '✨'], 12, 120);
        banner('🎬', 'MUDANÇA DE CENÁRIO!', `O ${STAR} foi para outro lugar do tabuleiro`, 2400);
        await say(`Mudança de cenário! Os contra-regras levaram o ${STAR} pra outro lugar!`, { wait: true });
        break;
      }
      case 4: {
        banner('✂️', 'CORTE DE VERBA!', `Todos perdem 3 ${COIN} para o banco`, 2600, 'hot');
        for (const x of G.players) { if (x === p && await useCut(p, 'o corte de verba')) continue; await payBank(x, 3); }
        await say('Corte de verba! Todo mundo paga três Moncoins pro banco. A crise chegou no estúdio!', { wait: true });
        break;
      }
      case 5: {
        addCoins(p, 10); burst(pXY(p), [COIN, '💵', '✨'], 14, 140); applause();
        banner('💵', 'PATROCÍNIO SURPRESA!', `${p.name} ganha 10 ${COIN}`, 2400);
        await say(`Patrocínio surpresa! O Diretor gostou de ${p.name}: dez Moncoins!`, { wait: true });
        break;
      }
      case 6: {
        banner('🚶', 'FIGURANTE NO LUGAR ERRADO!', `${p.name} vai parar numa casa aleatória`, 2200);
        await teleport(p, depth, ['V']);
        break;
      }
      case 7: {
        if (await useCut(p, 'a pausa para o café')) break;
        p.skip = true; renderSide(); tokAnim(p, 'sad', 1400);
        banner('☕', 'PAUSA PARA O CAFÉ!', `${p.name} perde o próximo turno`, 2600, 'hot');
        await say(`Pausa para o café! ${p.name} perde o próximo turno. Traz um pão de queijo também!`, { wait: true });
        break;
      }
      case 8: {
        if (await useCut(p, 'a câmera escondida')) break;
        const last = others(p).sort((a, b) => rankOf(b) - rankOf(a))[0];
        if (p.items.length && last) {
          const k = pick(p.items); removeItem(p, k);
          await projectile(pXY(p), pXY(last), ITEMS[k].e, 900);
          const ok = giveItem(last, k);
          banner('📹', 'CÂMERA ESCONDIDA!', `${ITEMS[k].e} ${ITEMS[k].n} de ${p.name} foi para ${last.name}${ok ? '' : ' (mochila cheia: +3)'}`, 2800, 'hot');
          await say(`Pegadinha da câmera escondida! O ${ITEMS[k].n} de ${p.name} foi parar com ${last.name}!`, { wait: true });
        } else {
          banner('📹', 'CÂMERA ESCONDIDA!', `${p.name} não tem itens: perde 3 ${COIN} para o banco`, 2600, 'hot');
          await payBank(p, 3);
          await say(`Câmera escondida! Sem itens pra entregar, ${p.name} paga três Moncoins pro banco.`, { wait: true });
        }
        break;
      }
      case 9: {
        $('#host').classList.remove('evil');
        const q = drawQ(randTheme(), 'm');
        say(`Quiz relâmpago só pra ${p.name}! Valendo oito Moncoins!`);
        const ok = await soloQuestion(p, q, '⚡ Quiz relâmpago (+8)');
        if (ok) { addCoins(p, 8); applause(); await say('Acertou! Oito Moncoins!', { wait: true }); }
        else await say('Errou! O Diretor ficou decepcionado.', { wait: true });
        break;
      }
    }
  } finally { $('#host').classList.remove('evil'); }
}

/* ---------- itens ---------- */
// opções de alvo (com motivo quando não dá para escolher)
const pickOpts = (list, disF) => list.map(o => { const why = disF ? disF(o) : ''; return { id: o.id, name: o.name, emoji: o.emoji, color: o.color, sym: symOf(o), coins: o.coins, stars: o.stars, items: o.items.map(k => ITEMS[k].e).join(''), dis: !!why, why: why || '' }; });
const isLeader = x => rankOf(x) === 1;

// o momento do ataque: todos veem quem usou o quê em quem
async function attackIntro(p, k, v) {
  const it = ITEMS[k];
  const card = document.createElement('div'); card.className = 'banner atkcard';
  card.innerHTML = `<span class="ac-av" style="background:${p.color}">${p.emoji}</span><div class="ac-mid"><div class="ac-it">${it.e}</div><div class="ac-n">${esc(it.n)}</div></div><span class="ac-arrow">➜</span><span class="ac-av" style="background:${v.color}">${v.emoji}</span>
    <div class="ac-txt"><b>${esc(p.name)}</b> usou <b>${esc(it.n)}</b> em <b>${esc(v.name)}</b></div>`;
  $('#ov').appendChild(card);
  setTimeout(() => { card.classList.add('out'); setTimeout(() => card.remove(), 400); }, T(2600));
  say(pick([`${p.name} sacou ${it.n} contra ${v.name}!`, `Olha isso! ${p.name} vai usar ${it.n} em ${v.name}!`, `${it.n}! ${p.name} mirou em ${v.name}!`]));
  tokAnim(p, 'aim', 900); SFX.whoosh();
  await sleep(T(500));
  await projectile(pXY(p), pXY(v), it.e, 750);
}
// Escudo: bloqueia, quebra, e quem fica triste é o atacante
async function shieldBlock(p, k, v) {
  const tok = document.querySelector(`#tokens [data-p="${v.id}"]`); if (tok) tok.classList.add('shield-hit');
  SFX.hit(); flash(pXY(v), 'shield'); burst(pXY(v), ['🛡️', '✨', '💥'], 16, 170);
  await sleep(T(700));
  if (tok) tok.classList.remove('shield-hit');
  removeItem(v, 'shield');
  tokAnim(p, 'sad', 1500); tokAnim(v, 'cheer');
  floatText(p, '💧 bloqueado', '#93c5fd');
  banner('🛡️', `BLOQUEADO! ${v.name} tinha ESCUDO!`, `O ${ITEMS[k].n} de ${p.name} foi perdido · o escudo quebrou`, 2800);
  await say(`Bloqueado! ${v.name} tinha um escudo! ${p.name} perdeu o item à toa, e o escudo quebrou!`, { wait: true });
}

async function useItem(p, k) {
  const it = ITEMS[k];
  if (it.target) {
    const dis = o => k === 'freeze' && o.debuff.freeze ? 'já está congelado' : k === 'ink' && o.debuff.ink ? 'já está com tinta' : k === 'contract' && !o.items.length ? 'não tem itens' : '';
    const os = others(p);
    if (os.every(o => dis(o))) { banner(it.e, `Ninguém pode receber ${it.n} agora`, 'O item voltou para a mochila', 2000); return false; }
    const r = await ask(p, { screen: 'pick', title: `${it.e} ${it.n}: escolha o alvo`, sub: it.d, opts: pickOpts(os, dis), cancel: true }, T(DECIDE), null, it.e);
    const v = r && r.id && P(r.id);
    if (!v || v.id === p.id || dis(v)) return false;
    removeItem(p, k); p.stats.attacks++; v.stats.hit++;
    await attackIntro(p, k, v);
    if (v.items.includes('shield')) { await shieldBlock(p, k, v); renderSide(); return true; }
    SFX.hit(); tokAnim(v, 'hit');
    switch (k) {
      case 'ink':
        burst(pXY(v), ['●', '●', '💧'], 18, 160, 'ink'); flash(pXY(v), 'ink'); v.debuff.ink = 3; v.debuff.inkC = p.color; renderSide();
        banner('🦑', `${p.name} jogou tinta em ${v.name}!`, 'A tela vai ficar manchada nas 3 primeiras perguntas do próximo Monquiz', 2600);
        await say(`Splash! ${v.name} vai ter que limpar a tela no próximo Monquiz!`, { wait: true }); break;
      case 'freeze':
        burst(pXY(v), ['❄️', '❄️', '🧊', '✨'], 18, 170); flash(pXY(v), 'ice'); v.debuff.freeze = 1; renderSide();
        banner('🧊', `${p.name} congelou ${v.name}!`, 'No próximo Monquiz, cada botão de resposta precisa de 7 toques para quebrar o gelo', 2800);
        await say(`Brrr! Os botões de ${v.name} vão estar no gelo no próximo Monquiz! Sete toques pra quebrar cada um!`, { wait: true }); break;
      case 'hook': {
        const big = isLeader(v) && !isLeader(p);
        const amt = Math.min(big ? 10 : 6, v.coins);
        if (amt) await coinFlight(pXY(v), pXY(p), amt);
        addCoins(v, -amt); addCoins(p, amt); tokAnim(p, 'cheer');
        banner('🪝', `${p.name} fisgou ${mc(amt)} de ${v.name}!`, big ? 'Gancho reforçado: o alvo estava em 1º!' : '', 2400);
        await say(big ? `Gancho no líder! ${p.name} puxou ${mc(amt)} de ${v.name}!` : `Gancho! ${p.name} roubou ${mc(amt)} de ${v.name}!`, { wait: true }); break;
      }
      case 'swap': {
        const fp = tokenPos(p), fv = tokenPos(v); const a = p.node; p.node = v.node; v.node = a; SFX.whoosh(); renderBoard();
        await arcTokens([{ p, from: fp, to: tokenPos(p) }, { p: v, from: fv, to: tokenPos(v) }]);
        burst(pXY(p), '✨', 8, 90); burst(pXY(v), '✨', 8, 90); tokAnim(p, 'cheer');
        banner('🔄', `${p.name} trocou de lugar com ${v.name}!`, '', 2400);
        await say(`Troca-troca! ${p.name} e ${v.name} trocaram de lugar!`, { wait: true }); break;
      }
      case 'contract': {
        const kk = pick(v.items); removeItem(v, kk);
        await projectile(pXY(v), pXY(p), ITEMS[kk].e, 800);
        giveItem(p, kk); tokAnim(p, 'cheer');
        banner('📜', `${p.name} contratou o ${ITEMS[kk].n} de ${v.name}!`, 'Contrato de exclusividade assinado', 2600);
        await say(`Contrato assinado! O ${ITEMS[kk].n} de ${v.name} agora trabalha pra ${p.name}!`, { wait: true }); break;
      }
    }
    renderSide(); return true;
  }
  if (k === 'trap') {
    if (G.traps[p.node] !== undefined) return false;
    removeItem(p, k); G.traps[p.node] = p.id; p.stats.attacks++; renderBoard(); burst(pXY(p), ['🪤', '🍃'], 8, 90);
    banner('🪤', `${p.name} armou uma armadilha!`, 'Ela fica ESCONDIDA nesta casa. Quem cair, paga 5 ' + COIN, 2400);
    await say(`${p.name} escondeu uma armadilha... alguém lembra onde foi?`);
    return true;
  }
  if (it.quiz) {
    removeItem(p, k); p.buff[k] = k === 'ear' ? 3 : 1; renderSide();
    SFX.pop(); burst(pXY(p), [it.e, '✨'], 12, 120); tokAnim(p, 'cheer');
    const nd = G.nextDyn ? DYNS[G.nextDyn] : null;
    banner(it.e, `${p.name} ativou ${it.n}!`, `Vale no próximo Monquiz${nd ? ': ' + nd.e + ' ' + nd.n : ''}`, 2400);
    await say({ ear: `${p.name} colocou o ponto eletrônico! A produção vai soprar umas dicas no próximo Monquiz.`, retake: `${p.name} guardou um Regravar! Um erro no próximo Monquiz vai ser apagado.`, allin: `${p.name} apostou Tudo ou Nada! Primeiro lugar no Monquiz, prêmio triplo. Senão, perde seis!` }[k], { wait: true });
    return true;
  }
  if (k === 'gold') {
    const r = await ask(p, { screen: 'choose', title: '🎯 Dado de Ouro: escolha o número', grid: true, opts: Array.from({ length: 10 }, (_, i) => ({ label: String(i + 1) })), cancel: true }, T(DECIDE), null, '🎯');
    if (!r || r.cancel || r.i == null) return false;
    removeItem(p, k);
    banner('🎯', `${p.name} usou o Dado de Ouro!`, `Escolheu andar ${r.i + 1}`, 1800);
    say(`${p.name} usou o Dado de Ouro!`);
    return { fixed: r.i + 1 };
  }
  if (k === 'double') {
    removeItem(p, k);
    banner('✌️', `${p.name} vai rolar dois dados!`, '', 1600);
    say(`Dado duplo! ${p.name} vai longe!`);
    return { dice: 2 };
  }
  if (k === 'crazy') {
    removeItem(p, k);
    banner('🤪', `${p.name} pegou o Dado Maluco!`, 'De −3 a 12: pode andar para trás!', 2000);
    say(`Dado Maluco! Pode dar doze... ou pode dar marcha a ré!`);
    return { crazy: true };
  }
  if (k === 'lottery') {
    removeItem(p, k);
    const o = pick(others(p));
    banner('🎟️', 'SORTEIO DA PRODUÇÃO!', `${p.name} troca TODOS os Moncoins com alguém sorteado…`, 2200);
    await say(`Sorteio da produção! Com quem ${p.name} vai trocar todos os Moncoins?`, { wait: true });
    await spinWheel('🎟️ SORTEIO DA PRODUÇÃO', others(p).map(x => `${x.emoji} ${x.name}`), others(p).indexOf(o), `${p.emoji} ${esc(p.name)} (${p.coins} ${COIN})`);
    closeOverlay();
    await Promise.all([coinFlight(pXY(p), pXY(o), 6), coinFlight(pXY(o), pXY(p), 6)]);
    const a = p.coins, b = o.coins; p.coins = b; o.coins = a; SFX.whoosh();
    floatText(p, `${a} → ${b} ${COIN}`, b >= a ? '#fde047' : '#fca5a5'); floatText(o, `${b} → ${a} ${COIN}`, a >= b ? '#fde047' : '#fca5a5');
    tokAnim(b >= a ? p : o, 'cheer'); tokAnim(b >= a ? o : p, 'sad');
    renderSide(); scheduleSync(); p.stats.attacks++;
    banner('🎟️', `${p.name} ⇄ ${o.name}`, `${p.name}: ${a} → ${b} · ${o.name}: ${b} → ${a}`, 2600);
    await say(b > a ? `Que sorte! ${p.name} saiu ganhando!` : b < a ? `Ihh! ${p.name} saiu perdendo nessa troca!` : 'Troca empatada! Ninguém ganhou nada.', { wait: true });
    return true;
  }
  if (k === 'box') {
    removeItem(p, k);
    const good = Math.random() < 0.5;
    overlay(`<div class="mbox"><div class="mb-e" id="mbe">📦</div><div class="wtitle">CAIXA MISTERIOSA</div><div class="wwho">${p.emoji} ${esc(p.name)} vai abrir…</div><div id="mbr" class="wres"></div></div>`, 'center');
    say(`Caixa misteriosa! O que será que tem aí dentro?`);
    SFX.tick(); await sleep(T(1600));
    if (good) {
      const kk = pick(ITEM_KEYS.filter(x => x !== 'box'));
      giveItem(p, kk); SFX.fanfare();
      $('#mbe').textContent = ITEMS[kk].e; $('#mbe').classList.add('open');
      $('#mbr').textContent = `🎉 ${ITEMS[kk].n} (nível ${TIERS[ITEMS[kk].tier].n})`;
      await say(`Prêmio! ${p.name} ganhou ${ITEMS[kk].n}!`, { wait: true });
      closeOverlay(); itemPop(p, kk);
    } else {
      SFX.lose(); $('#mbe').textContent = '💸'; $('#mbe').classList.add('open');
      $('#mbr').textContent = `Ihh! ${p.name} dá 3 ${COIN} a cada jogador`;
      await say(`Ihh! A caixa era de doação! ${p.name} dá três Moncoins pra cada jogador!`, { wait: true });
      closeOverlay();
      const os = others(p), need = 3 * os.length;
      const each = p.coins >= need ? 3 : Math.floor(p.coins / os.length);
      let rest = p.coins >= need ? 0 : p.coins - each * os.length;
      const fl = [];
      os.forEach(x => { if (each) { fl.push(coinFlight(pXY(p), pXY(x), each)); addCoins(p, -each, true); addCoins(x, each, true); } });
      if (rest) { const worst = os.slice().sort((a, b) => rankOf(b) - rankOf(a))[0]; fl.push(coinFlight(pXY(p), pXY(worst), rest)); addCoins(p, -rest, true); addCoins(worst, rest, true); }
      await Promise.all(fl); tokAnim(p, 'sad'); renderSide();
    }
    return true;
  }
  return false;
}

/* ---------- duelo ---------- */
async function duel(p) {
  const os = others(p);
  SFX.fanfare();
  say(`Duelo! ${p.name}, escolha quem você vai desafiar!`);
  banner('⚔️', 'DUELO!', `${p.name} vai escolher um adversário`, 2200, 'hot');
  const r = await ask(p, { screen: 'pick', title: '⚔️ Escolha seu adversário', sub: 'Até 3 perguntas: o primeiro a acertar vence na hora', opts: pickOpts(os) }, T(DECIDE), { id: pick(os).id }, '⚔️');
  const o = (r && P(r.id) && r.id !== p.id) ? P(r.id) : pick(os);
  // apostas: só o que o mais pobre dos dois consegue pagar
  const coinBets = [5, 10, 15].filter(b => b <= Math.min(p.coins, o.coins));
  const maxS = Math.min(p.stars, o.stars);
  const betOpts = [...coinBets.map(b => ({ type: 'coin', v: b, label: `${COIN} ${b} Moncoins` })), ...Array.from({ length: maxS }, (_, i) => ({ type: 'star', v: i + 1, label: `${MIC} ${mics(i + 1)}` }))];
  let bet = { type: 'honor', v: 0 };
  if (betOpts.length) {
    say(`${p.name}, quanto vale esse duelo contra ${o.name}?`);
    const rb = await ask(p, { screen: 'choose', title: `💰 Quanto apostar contra ${o.name}?`, sub: 'Quem vencer leva a aposta do outro', opts: betOpts.map(b => ({ label: b.label, color: b.type === 'star' ? '#fde047' : undefined })) }, T(DECIDE), { i: 0 }, '💰');
    bet = betOpts[(rb && rb.i) || 0] || betOpts[0];
  }
  const betTxt = bet.type === 'coin' ? `Aposta: ${bet.v} ${COIN}` : bet.type === 'star' ? `Aposta: ${mics(bet.v)} ${MIC}` : `Duelo pela honra (+3 ${COIN} ao vencedor)`;
  overlay(`<div class="vs"><div class="vsp" style="--pc:${p.color}"><div class="vsav" style="background:${p.color}">${p.emoji}</div>${esc(p.name)}</div>
    <div class="vsx">VS</div><div class="vsp" style="--pc:${o.color}"><div class="vsav" style="background:${o.color}">${o.emoji}</div>${esc(o.name)}</div>
    <div class="vsbet ${bet.type === 'star' ? 'hot' : ''}">${betTxt}</div><div class="vsrule">Mesma pergunta para os dois · o 1º a acertar vence · errou, não responde mais aquela</div></div>`, 'center');
  await say(`${p.name} desafia ${o.name}! ${bet.type === 'coin' ? `Valendo ${bet.v} Moncoins!` : bet.type === 'star' ? `Valendo ${mics(bet.v)}! Que coragem!` : 'Valendo a honra!'} Quem acertar primeiro, vence!`, { wait: true });
  await sleep(T(600));
  let winner = null;
  const lv = ['f', 'm', 'd'];
  for (let i = 0; i < 3 && !winner; i++) winner = await duelQuestion(p, o, drawQ(randTheme(), lv[i]), i);
  closeOverlay();
  if (winner) {
    const loser = winner === p ? o : p;
    winner.stats.duels++;
    SFX.fanfare(); tokAnim(winner, 'cheer', 1400); tokAnim(loser, 'sad', 1400);
    let sub = `+3 ${COIN}`;
    if (bet.type === 'coin') { const v = Math.min(bet.v, loser.coins); if (v) await coinFlight(pXY(loser), pXY(winner), v); addCoins(loser, -v); addCoins(winner, v); sub = `Levou ${mc(v)} de ${loser.name}`; }
    else if (bet.type === 'star') { const v = Math.min(bet.v, loser.stars); for (let i = 0; i < v; i++) await micFlight(pXY(loser), pXY(winner)); loser.stars -= v; winner.stars += v; renderSide(); scheduleSync(); sub = `Levou ${mics(v)} de ${loser.name}!`; }
    else addCoins(winner, 3);
    banner('🏆', `${winner.name} venceu o duelo!`, sub, 2800);
    await say(pick([`${winner.name} venceu o duelo! ${loser.name}, vai ter revanche?`, `Vitória de ${winner.name}! Que duelo!`]), { wait: true });
  } else {
    banner('🤝', 'Empate!', 'Ninguém acertou nas 3 perguntas. Ninguém paga.', 2400);
    await say('Ninguém acertou! Empate técnico! A aposta volta pro bolso de cada um.', { wait: true });
  }
}

// pergunta do duelo: vence quem acertar primeiro pelo tempo medido na tela de cada um
async function duelQuestion(a, b, q, n) {
  await voiceIdle();
  const parts = [a, b], ctl = {};
  let cand = null, grace = null;
  const lab = '⚔️ Duelo';
  renderQuestionTV(q, { dyn: lab, n: n + 1, tot: 3, phase: 'read', parts, duel: true });
  const rm = readMs(q.q);
  parts.forEach(p => setUI(p, { screen: 'wait', msg: '👀 Leia a pergunta', sub: q.q, read: rm, _ms: rm }));
  await readAloud(q.q, rm);
  const lim = LIMIT[q.lv];
  renderQuestionTV(q, { dyn: lab, n: n + 1, tot: 3, phase: 'ask', parts, lim, duel: true });
  const ans = await collect(parts, p => qUI(p, q, lab, n + 1, 3, false), lim, (p, x, all) => {
    const ok = x.a.i === q.correct;
    markAnswered(p, !ok);
    if (ok) {
      if (!cand || x.t < cand.t) cand = { p, t: x.t };
      const other = parts.find(o => o !== p);
      if (all[other.id]) return true;
      clearTimeout(grace); grace = setTimeout(() => ctl.finish && ctl.finish(), G.online ? 1500 : 500);
      return false;
    }
    SFX.bad(); setUI(p, { screen: 'wait', msg: '❌ Errou!', sub: 'Você não responde mais esta pergunta. Torça para o rival errar também!' });
    return !!cand || Object.keys(all).length >= 2;
  }, '✅ Resposta enviada!', ctl);
  clearTimeout(grace);
  const win = cand && cand.p;
  renderQuestionTV(q, { dyn: lab, n: n + 1, tot: 3, phase: 'reveal', parts, ans, duel: true, win });
  if (win) { SFX.ok(); win.stats.correct++; }
  parts.forEach(p => setUI(p, resultUI(q, ans[p.id], win === p ? '🏆 Você venceu o duelo!' : win ? `${win.name} acertou primeiro…` : null)));
  await say(win ? `${win.name} acertou primeiro!` : `Ninguém acertou! A resposta era ${q.opts[q.correct]}.`);
  await sleep(T(2600));
  return win;
}

async function soloQuestion(p, q, label) {
  await voiceIdle();
  renderQuestionTV(q, { dyn: label, n: 1, tot: 1, phase: 'read', parts: [p] });
  const rm = readMs(q.q);
  setUI(p, { screen: 'wait', msg: '👀 Leia a pergunta', sub: q.q, read: rm, _ms: rm });
  await readAloud(q.q, rm);
  const lim = LIMIT[q.lv];
  renderQuestionTV(q, { dyn: label, n: 1, tot: 1, phase: 'ask', parts: [p], lim });
  const ans = await collect([p], x => qUI(x, q, label, 1, 1, false), lim, x => markAnswered(x));
  renderQuestionTV(q, { dyn: label, n: 1, tot: 1, phase: 'reveal', parts: [p], ans });
  const ok = ans[p.id] && ans[p.id].a.i === q.correct;
  ok ? SFX.ok() : SFX.bad();
  if (ok) p.stats.correct++;
  setUI(p, resultUI(q, ans[p.id]));
  await sleep(T(2600));
  closeOverlay();
  return ok;
}

/* =========================================================================
   MONQUIZ
   ========================================================================= */
const kidOK = q => !G.kid || !KID_BLOCK.test(q[0] + ' ' + q[1]);
function randTheme(avoid) { return pick(Object.keys(QB).filter(t => t !== avoid)); }
function drawQ(theme, lv, filter) {
  const key = theme + lv, bank = QB[theme][lv];
  const okIdx = bank.map((_, i) => i).filter(i => kidOK(bank[i]) && (!filter || filter(bank[i])));
  let used = G.used[key] || [];
  let free = okIdx.filter(i => !used.includes(i));
  if (!free.length) { used = []; free = okIdx.slice(); }
  const i = pick(free.length ? free : bank.map((_, k) => k)); used.push(i); G.used[key] = used;
  const [q, ...rest] = bank[i];
  const order = shuffle([0, 1, 2, 3]);
  return { q, th: theme, lv, opts: order.map(j => rest[j]), correct: order.indexOf(0) };
}
function drawNum() {
  const ok = NUMQ.map((_, i) => i).filter(i => !G.kid || !KID_BLOCK.test(NUMQ[i][0]));
  let free = ok.filter(i => !G.usedNum.includes(i));
  if (!free.length) { G.usedNum = []; free = ok; }
  const i = pick(free); G.usedNum.push(i);
  const [q, a, unit] = NUMQ[i];
  return { q, a, unit };
}
// nenhuma dinâmica repete antes de todas as ativas saírem
function nextDyn() {
  const act = (G.dyns && G.dyns.length >= 3 ? G.dyns : DYN_KEYS).filter(k => DYNS[k]);
  G.dynBag = (G.dynBag || []).filter(k => act.includes(k));
  if (!G.dynBag.length) {
    let bag = shuffle(act);
    if (bag[0] === G.lastDyn && bag.length > 1) bag.push(bag.shift());
    G.dynBag = bag;
  }
  return G.dynBag.shift();
}
// tela da pergunta no celular, com os efeitos de itens
function qUI(p, q, dynLabel, n, tot, withFx = true) {
  const fx = {};
  if (withFx) {
    if (p.debuff.ink > 0) { fx.ink = true; fx.inkC = p.debuff.inkC; }
    if (p.debuff.freeze) fx.freeze = G.quizNo;
    if (p.buff.ear > 0) { p.buff.ear--; fx.ear = pick([0, 1, 2, 3].filter(i => i !== q.correct)); renderSide(); }
  }
  return { screen: 'q', q: q.q, opts: q.opts, th: q.th, lv: q.lv, dyn: dynLabel, n, tot, fx };
}
function resultUI(q, a, extra, retook) {
  const ok = retook || (a && a.a.i === q.correct);
  return { screen: 'res', ok: !!ok, none: !a, msg: extra || (retook ? '📼 Regravar! Seu erro virou acerto' : ok ? pick(['✅ Acertou!', '✅ Mandou bem!', '✅ Na mosca!']) : a ? '❌ Errou!' : '⏰ Não respondeu'), sub: q.opts ? `Resposta: ${q.opts[q.correct]}` : '' };
}
// Regravar!: um erro vira acerto (uma vez)
function useRetake(p) {
  if (!p.buff.retake) return false;
  p.buff.retake = 0; renderSide();
  SFX.clap(); floatText(p, '📼 REGRAVAR!', '#f0abfc');
  const el = document.querySelector(`#answered [data-p="${p.id}"]`); if (el) el.classList.add('retake');
  return true;
}
function markAnswered(p, wrong) {
  const el = document.querySelector(`#answered [data-p="${p.id}"]`);
  if (el) { el.classList.add('done'); if (wrong) el.classList.add('wrong'); }
}
const answeredRow = (parts, s) => `<div id="answered">${parts.map(p => {
  const a = s && s.ans && s.ans[p.id];
  const st = s && s.phase === 'reveal' ? ((s.okSet ? s.okSet.has(p.id) : a && a.a.i === s.correct) ? 'done ok' : 'done wrong') : '';
  return `<span data-p="${p.id}" class="ans ${st}" style="--pc:${p.color}">${p.emoji}<i>${buffIcons(p)}</i></span>`;
}).join('')}</div>`;

// TV: durante a leitura e a resposta as alternativas ficam só no celular (Tinta e Congelar funcionam de verdade)
function renderQuestionTV(q, s) {
  const th = THEMES[q.th];
  const parts = s.parts || [];
  const head = `<div class="qhead"><span class="qdyn">${s.dyn}</span><span class="qnum">Pergunta ${s.n} de ${s.tot}</span>
    <span class="qtheme" style="--tc:${th.color}">${th.emoji} ${th.name}</span><span class="qlv lv-${q.lv}">${LEVEL_NAME[q.lv]}</span>${s.extra || ''}</div>`;
  const where = G.online ? 'no seu painel' : 'no seu celular';
  const optsHTML = q.opts.map((o, i) => {
    let who = '';
    if (s.phase === 'reveal' && s.ans) who = parts.filter(p => s.ans[p.id] && s.ans[p.id].a.i === i).map(p => `<span class="ow" style="background:${p.color}">${p.emoji}</span>`).join('');
    const cls = s.phase === 'reveal' ? (i === q.correct ? 'right' : 'wrongopt') : 'secret';
    return `<div class="opt ${cls}" style="--oc:${OPT_COLORS[i]};animation-delay:${i * 0.08}s"><span class="oshape">${OPT_SHAPES[i]}</span><span class="otext">${s.phase === 'reveal' ? esc(o) : '?'}</span><span class="owho">${who}</span></div>`;
  }).join('');
  const timer = s.phase === 'ask' ? `<div class="qtimer"><div class="qtbar" style="animation-duration:${s.lim}ms"></div></div>`
    : s.phase === 'read' ? `<div class="qtimer read"><div class="qtbar grow" style="animation-duration:${s.rm || 3000}ms"></div></div>` : '<div class="qtimer"></div>';
  const hint = s.phase === 'read' ? `<div class="qhint">📖 Leitura… as alternativas aparecem ${where} em instantes</div>` : s.phase === 'ask' ? `<div class="qhint go">👉 Responda ${where}!</div>` : '';
  overlay(`<div class="quiz ${s.phase}">${head}<div class="qtext">${esc(q.q)}</div>${timer}${hint}
    <div class="opts ${s.phase !== 'reveal' ? 'veiled' : ''}">${optsHTML}</div>${answeredRow(parts, { ...s, correct: q.correct })}</div>`, 'quizpanel');
}

// "Continuar": só pula quando todos os presentes apertaram
async function gate(parts, ms, uiOf) {
  const live = parts.filter(p => p.online);
  if (!live.length) { await sleep(ms); return; }
  let n = 0;
  const show = () => { const el = $('#gate'); if (el) { el.className = 'gate'; el.innerHTML = `✋ <b>${n}/${live.length}</b> prontos para continuar`; } };
  show();
  await collect(live, p => Object.assign({}, uiOf(p), { skip: true }), ms, () => { n++; show(); SFX.tick(); }, '✋ Pronto! Esperando os outros…');
  const el = $('#gate'); if (el) { el.className = 'gate hidden'; el.innerHTML = ''; }
}

// uma pergunta de múltipla escolha; devolve o conjunto de quem acertou (já com o Regravar!)
async function runChoiceQuestion(q, parts, n, tot, dynLabel, withFx, opt = {}) {
  await voiceIdle();
  const Q = G.Q;
  renderQuestionTV(q, { dyn: dynLabel, n, tot, phase: 'read', parts, rm: readMs(q.q), extra: opt.extra });
  const rm = readMs(q.q);
  Q.all.forEach(p => setUI(p, parts.includes(p) ? { screen: 'wait', msg: '👀 Leia a pergunta', sub: q.q, read: rm, _ms: rm } : { screen: 'wait', msg: opt.outMsg || '👀 Assista', sub: q.q }));
  await readAloud(q.q, rm);
  const lim = LIMIT[q.lv];
  renderQuestionTV(q, { dyn: dynLabel, n, tot, phase: 'ask', parts, lim, extra: opt.extra });
  const ticker = setInterval(() => SFX.tick(), 1000);
  const ans = await collect(parts, p => qUI(p, q, dynLabel, n, tot, withFx), lim, p => { markAnswered(p); SFX.pop(); });
  clearInterval(ticker);
  if (withFx) parts.forEach(p => { if (p.debuff.ink > 0) p.debuff.ink--; });
  const okSet = new Set(), retook = new Set();
  parts.forEach(p => {
    const a = ans[p.id];
    if (a && a.a.i === q.correct) okSet.add(p.id);
    else if (withFx && p.online && useRetake(p)) { okSet.add(p.id); retook.add(p.id); }
  });
  renderQuestionTV(q, { dyn: dynLabel, n, tot, phase: 'reveal', parts, ans, okSet, extra: opt.extra });
  okSet.size ? SFX.ok() : SFX.bad();
  const ansTxt = q.opts[q.correct];
  const okN = parts.filter(p => okSet.has(p.id));
  if (retook.size) banner('📼', 'REGRAVAR!', `${[...retook].map(id => P(id).name).join(', ')}: o erro foi apagado da fita`, 2000);
  if (!okN.length) say(pick([`Ninguém acertou! A resposta era: ${ansTxt}.`, `Zero acertos! Era ${ansTxt}. A produção vai ter que explicar essa.`]));
  else if (okN.length === parts.length && parts.length > 1) say(pick([`Todo mundo acertou! Era ${ansTxt}.`, `Fácil demais! Todos acertaram.`]));
  else if (okN.length === 1 && parts.length > 2) say(`Só ${okN[0].name} acertou! Era ${ansTxt}.`);
  else say(`A resposta certa é: ${ansTxt}.`);
  await gate(Q.all, T(3600), p => parts.includes(p) ? resultUI(q, ans[p.id], null, retook.has(p.id)) : { screen: 'res', ok: true, msg: '👀 Resposta', sub: `Era: ${ansTxt}` });
  return { ans, okSet };
}

/* ---------- classificação ---------- */
// cada dinâmica preenche sc[id] = { pts, tb, out }: maior é melhor
function rankRound(sc, parts) {
  const key = p => { const s = sc[p.id]; return [s.out == null ? 1e9 : s.out, s.pts, s.tb]; };
  const cmp = (a, b) => { const ka = key(a), kb = key(b); for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i]; return 0; };
  const sorted = parts.slice().sort(cmp);
  const out = []; let place = 1;
  sorted.forEach((p, i) => { if (i > 0 && cmp(sorted[i - 1], p) !== 0) place = i + 1; out.push({ p, place }); });
  return out;
}
function scoreTxt(dyn, s) {
  if (!s) return '—';
  switch (dyn) {
    case 'speed': return fmt(s.pts) + ' pts';
    case 'number': return s.pts + ' pts';
    case 'bank': return (s.pts >= 0 ? '+' : '') + s.pts + ' ' + COIN;
    case 'potato': return (-s.pts) + ' 🥔';
    case 'clock': return s.pts + ' ✔ · ' + (s.err || 0) + ' ✖';
    case 'elim': return s.pts + ' acerto' + (s.pts === 1 ? '' : 's') + (s.out != null ? ' 💀' : ' 👑');
    default: return s.pts + ' acerto' + (s.pts === 1 ? '' : 's');
  }
}
function renderScoresMini(sc, parts, dyn) {
  const list = rankRound(sc, parts);
  return `<div class="minisc">${list.map(x => `<div class="ms" style="--pc:${x.p.color}"><span>${x.place}º</span><span class="msav" style="background:${x.p.color}">${x.p.emoji}</span><b>${esc(x.p.name)}</b><span class="mspts">${scoreTxt(dyn, sc[x.p.id])}</span></div>`).join('')}</div>`;
}
async function midScore(sc, parts, dyn, D, last) {
  if (last) return;
  overlay(`<div class="midscore"><div class="wtitle">${D.e} Parcial</div>${renderScoresMini(sc, parts, dyn)}</div>`, 'center');
  await sleep(T(1800));
}
const addOk = (sc, p, t) => { sc[p.id].pts += 1; sc[p.id].tb -= t; p.stats.correct++; p.stats.fastT += t; p.stats.fastN++; };

/* ---------- Monquiz ---------- */
async function quizRound() {
  await voiceIdle();
  stageMode('quiz');
  const dyn = G.nextDyn || nextDyn(); G.lastDyn = dyn; G.quizNo++;
  const D = DYNS[dyn];
  const parts = G.players.filter(p => p.online), absent = G.players.filter(p => !p.online);
  const sc = {}; G.players.forEach(p => sc[p.id] = { pts: 0, tb: 0, out: null, err: 0 });
  G.Q = { dyn, all: parts, sc };
  waitAll('📺 Hora do Monquiz!', LOOK());
  absent.forEach(p => waitUI(p, '📺 Monquiz em andamento', 'Você volta a jogar no próximo turno'));
  SFX.fanfare();
  const gf = grandFinal();
  overlay(`<div class="dynintro"><div class="di-top">${gf ? '🏆 GRANDE FINAL DO MONQUIZ!' : '📺 HORA DO MONQUIZ!'}</div><div class="di-e">${D.e}</div><div class="di-n">${D.n}</div><div class="di-d">${D.d}</div>
    <div class="di-r">Prêmios para todos pela colocação: ${REWARDS.slice(0, Math.max(2, G.players.length)).map((r, i) => `${i + 1}º ${gf ? r * 2 : r}`).join(' · ')} ${COIN} + 1 item${gf ? ' · <b>PRÊMIOS EM DOBRO!</b>' : ''}</div>
    ${parts.some(p => buffIcons(p)) ? `<div class="di-fx">${parts.filter(p => buffIcons(p)).map(p => `<span style="--pc:${p.color}">${p.emoji} ${buffIcons(p)}</span>`).join('')}</div>` : ''}</div>`, 'center');
  await say((gf ? 'Chegou a Grande Final do Monquiz! Prêmios em dobro! ' : pick([`Atenção, atenção! Hora do Monquiz! `, `Chegou a hora mais esperada da noite: o Monquiz! `, `Larguem o dado e peguem o cérebro: hora do Monquiz! `])) + `Dinâmica: ${D.n}! ${D.d}`, { wait: true });
  await gate(parts, T(3500), () => ({ screen: 'wait', msg: `${D.e} ${D.n}`, sub: D.d }));

  if (parts.length) {
    if (dyn === 'number') await dynNumber(parts, sc, D);
    else if (dyn === 'elim') await dynElim(parts, sc, D);
    else if (dyn === 'bank') await dynBank(parts, sc, D);
    else if (dyn === 'tf') await dynTF(parts, sc, D);
    else if (dyn === 'hilo') await dynHiLo(parts, sc, D);
    else if (dyn === 'potato') await dynPotato(parts, sc, D);
    else if (dyn === 'clock') await dynClock(parts, sc, D);
    else await dynStd(dyn, parts, sc, D);
  }
  await roundResults(dyn, sc, parts, absent);
  G.players.forEach(p => { p.debuff = newDebuff(); p.buff = newBuff(); });
  G.shared = null; G.live = null; G.Q = null;
  closeOverlay();
  stageMode('board'); renderSide();
}

// Velocidade, Quem Sabe Mais, Tema Fixo e Escolha do Competidor
async function dynStd(dyn, parts, sc, D) {
  let theme = null;
  if (dyn === 'theme') {
    const keys = Object.keys(THEMES).filter(k => k !== G.lastFixTheme), idx = rnd(keys.length);
    await spinWheel('🎯 SORTEIO DO TEMA', keys.map(k => THEMES[k].emoji + ' ' + THEMES[k].name), idx);
    theme = G.lastFixTheme = keys[idx];
    await say(`O tema é: ${THEMES[theme].name}!`, { wait: true });
  }
  if (dyn === 'pick') theme = await chooseTheme(parts);
  const lv = LEVELS[dyn]; let lastTh = null;
  const label = `${D.e} ${D.n}`;
  for (let i = 0; i < lv.length; i++) {
    const th = theme || randTheme(lastTh); lastTh = th;
    const q = drawQ(th, lv[i]);
    const { ans, okSet } = await runChoiceQuestion(q, parts, i + 1, lv.length, label, true);
    const lim = LIMIT[q.lv];
    parts.forEach(p => {
      if (!okSet.has(p.id)) return;
      const t = ans[p.id] ? ans[p.id].t : lim;
      addOk(sc, p, t);
      if (dyn === 'speed') sc[p.id].pts += 499 + Math.round(500 * Math.max(0, 1 - t / lim));   // 500 de base + até 500 pela rapidez
    });
    await midScore(sc, parts, dyn, D, i === lv.length - 1);
  }
}

// Escolha do Competidor: um sorteado escolhe o tema (preferência para quem ainda não escolheu)
async function chooseTheme(parts) {
  let pool = parts.filter(p => !G.chosers.includes(p.id));
  if (!pool.length) { G.chosers = []; pool = parts; }
  const c = pick(pool); G.chosers.push(c.id);
  const keys = Object.keys(THEMES);
  overlay(`<div class="dynintro"><div class="di-top">🙋 ESCOLHA DO COMPETIDOR</div><div class="di-e"><span class="msav big" style="background:${c.color}">${c.emoji}</span></div><div class="di-n">${esc(c.name)}</div><div class="di-d">escolhe o tema das cinco perguntas…</div>
    <div class="themegrid">${keys.map(k => `<span class="thc" data-t="${k}" style="--tc:${THEMES[k].color}">${THEMES[k].emoji} ${THEMES[k].name}</span>`).join('')}</div></div>`, 'center');
  waitAll(`🙋 ${c.name} está escolhendo o tema`, LOOK(), c);
  say(`${c.name}, você escolhe o tema! Pensa bem!`);
  const r = await ask(c, { screen: 'choose', title: '🙋 Escolha o tema do Monquiz', sub: 'As cinco perguntas serão deste tema', opts: keys.map(k => ({ label: `${THEMES[k].emoji} ${THEMES[k].name}`, color: THEMES[k].color })) }, T(15000), { i: rnd(keys.length) }, '🙋');
  const th = keys[(r && r.i) ?? rnd(keys.length)] || pick(keys);
  const el = document.querySelector(`.thc[data-t="${th}"]`); if (el) el.classList.add('sel');
  SFX.pop();
  await say(`${c.name} escolheu: ${THEMES[th].name}!`, { wait: true });
  return th;
}

async function dynElim(parts, sc, D) {
  const lv = LEVELS.elim; let alive = parts.slice(), lastTh = null;
  const label = `${D.e} ${D.n}`;
  for (let i = 0; i < lv.length; i++) {
    if (alive.length <= 1) break;
    const th = randTheme(lastTh); lastTh = th;
    const q = drawQ(th, lv[i]);
    const { ans, okSet } = await runChoiceQuestion(q, alive, i + 1, lv.length, label, true, { outMsg: '💀 Você foi eliminado · assista', extra: `<span class="qalive">👥 ${alive.length} na disputa</span>` });
    alive.forEach(p => { if (okSet.has(p.id)) addOk(sc, p, ans[p.id] ? ans[p.id].t : LIMIT[q.lv]); });
    const okP = alive.filter(p => okSet.has(p.id));
    if (okP.length) {
      const outNow = alive.filter(p => !okSet.has(p.id));
      outNow.forEach(p => { sc[p.id].out = i; tokAnim(p, 'sad'); });
      alive = okP;
      if (outNow.length) { SFX.lose(); banner('💀', `Eliminado${outNow.length > 1 ? 's' : ''}: ${outNow.map(p => p.name).join(', ')}`, `${alive.length} ainda na disputa`, 2000); await say(`Tchau, ${outNow.map(p => p.name).join(' e ')}!`); await sleep(T(1200)); }
    } else { banner('😅', 'Ninguém acertou', 'Ninguém sai nessa rodada!', 1800); await sleep(T(1000)); }
    await midScore(sc, parts, 'elim', D, i === lv.length - 1 || alive.length <= 1);
  }
}

// Chute Numérico: pontos = quantos responderam − posição
async function dynNumber(parts, sc, D) {
  for (let i = 0; i < 3; i++) await runNumberQuestion(drawNum(), parts, i + 1, 3, sc);
}
async function runNumberQuestion(nq, parts, n, tot, sc) {
  await voiceIdle();
  const dynLabel = '🔢 Chute Numérico';
  const head = `<div class="qhead"><span class="qdyn">${dynLabel}</span><span class="qnum">Pergunta ${n} de ${tot}</span></div>`;
  const rm = readMs(nq.q);
  overlay(`<div class="quiz read">${head}<div class="qtext">${esc(nq.q)}</div><div class="qtimer read"><div class="qtbar grow" style="animation-duration:${rm}ms"></div></div><div class="numhint">📖 Leitura… depois digite seu chute ${G.online ? 'no painel' : 'no celular'}!</div>${answeredRow(parts)}</div>`, 'quizpanel');
  parts.forEach(p => setUI(p, { screen: 'wait', msg: '👀 Leia a pergunta', sub: nq.q, read: rm, _ms: rm }));
  await readAloud(nq.q, rm);
  const lim = T(25000);
  $('.quiz').classList.replace('read', 'ask');
  $('.qtimer').className = 'qtimer'; $('.qtimer').innerHTML = `<div class="qtbar" style="animation-duration:${lim}ms"></div>`;
  $('.numhint').textContent = `👉 Digite seu chute ${G.online ? 'no painel' : 'no celular'}!`;
  const ans = await collect(parts, p => ({ screen: 'num', q: nq.q, unit: nq.unit, n, tot, dyn: dynLabel, fx: { ink: p.debuff.ink > 0, inkC: p.debuff.inkC, freeze: p.debuff.freeze ? G.quizNo : 0 } }), lim, p => { markAnswered(p); SFX.pop(); });
  parts.forEach(p => { if (p.debuff.ink > 0) p.debuff.ink--; });
  const retook = new Set();
  const rows = parts.map(p => {
    let v = ans[p.id] ? Number(ans[p.id].a.v) : null;
    if ((v == null || isNaN(v) || v !== nq.a) && useRetake(p)) { v = nq.a; retook.add(p.id); }
    return { p, v, t: ans[p.id] ? ans[p.id].t : lim };
  }).map(r => ({ ...r, d: r.v == null || isNaN(r.v) ? Infinity : Math.abs(r.v - nq.a) }))
    .sort((a, b) => a.d - b.d || a.t - b.t);
  const answeredRows = rows.filter(r => r.d !== Infinity);
  let place = 0;
  answeredRows.forEach((r, i) => { if (i === 0 || r.d !== answeredRows[i - 1].d) place = i; const pts = answeredRows.length - place; sc[r.p.id].pts += pts; sc[r.p.id].tb -= r.t; r.pts = pts; if (r.d === 0) { r.p.stats.correct++; } });
  SFX.ok();
  overlay(`<div class="quiz reveal">${head}<div class="qtext small">${esc(nq.q)}</div>
    <div class="numans">Resposta: <b>${fmtA(nq, nq.a)}</b> ${esc(nq.unit)}</div>
    <div class="numrows">${rows.map((r, i) => `<div class="nr ${i === 0 && r.d !== Infinity ? 'best' : ''}" style="--pc:${r.p.color}"><span class="msav" style="background:${r.p.color}">${r.p.emoji}</span><b>${esc(r.p.name)}</b><span class="nrv">${r.v == null || isNaN(r.v) ? '—' : fmtA(nq, r.v)}</span><span class="nrd">${retook.has(r.p.id) ? '📼 REGRAVAR: valor exato!' : r.d === Infinity ? 'não respondeu' : r.d === 0 ? 'NA MOSCA! 🎯' : 'errou por ' + fmt(r.d)}</span><span class="nrp">${r.pts ? '+' + r.pts : ''}</span></div>`).join('')}</div></div>`, 'quizpanel');
  const best = rows[0];
  if (best && best.d !== Infinity) say(best.d === 0 ? `Na mosca! ${best.p.name} acertou em cheio: ${fmtA(nq, nq.a)}!` : `A resposta é ${fmtA(nq, nq.a)}! Quem chegou mais perto foi ${best.p.name}!`);
  else say(`A resposta era ${fmtA(nq, nq.a)}! Ninguém chutou?`);
  await gate(parts, T(4800), p => { const r = rows.find(x => x.p === p); return { screen: 'res', ok: r.d !== Infinity && r === rows[0], msg: retook.has(p.id) ? '📼 Regravar! Chute exato' : r.d === Infinity ? '⏰ Não respondeu' : r.d === 0 ? '🎯 Na mosca!' : `Você chutou ${fmtA(nq, r.v)}`, sub: `Resposta: ${fmtA(nq, nq.a)} ${nq.unit}` + (r.pts ? ` · +${r.pts} pts` : '') }; });
}

// Banca do Apresentador: apostas de verdade antes de cada pergunta
async function dynBank(parts, sc, D) {
  const lv = LEVELS.bank; let lastTh = null;
  const label = `${D.e} ${D.n}`;
  for (let i = 0; i < lv.length; i++) {
    const th = randTheme(lastTh); lastTh = th;
    const q = drawQ(th, lv[i]);
    const T0 = THEMES[th];
    const betRow = (bets, reveal) => `<div class="betrow">${parts.map(p => `<div class="bet ${bets[p.id] != null ? 'in' : ''}" style="--pc:${p.color}"><span class="msav" style="background:${p.color}">${p.emoji}</span><b>${reveal && bets[p.id] != null ? bets[p.id] + ' ' + COIN : bets[p.id] != null ? '✅' : '…'}</b></div>`).join('')}</div>`;
    const showBets = (bets, reveal) => overlay(`<div class="dynintro"><div class="di-top">🎲 BANCA DO APRESENTADOR · ${i + 1}/${lv.length}</div><div class="di-e">${T0.emoji}</div><div class="di-n" style="color:${T0.color}">${T0.name}</div><div class="di-d">Nível ${LEVEL_NAME[lv[i]]} · ${reveal ? 'apostas reveladas!' : 'apostem de 1 a 5 Moncoins (escondido)'}</div>${betRow(bets, reveal)}</div>`, 'center');
    const bets = {};
    showBets(bets, false);
    say(i === 0 ? `Primeira pergunta: ${T0.name}! Façam suas apostas!` : `Próximo tema: ${T0.name}! Apostem!`);
    const r = await collect(parts, p => { const mx = Math.max(1, Math.min(5, p.coins)); return { screen: 'choose', title: `🎲 Quanto apostar? Tema: ${T0.emoji} ${T0.name}`, sub: `Acertou: +2× a aposta · errou: perde a aposta · você tem ${p.coins} ${COIN}`, grid: true, opts: [1, 2, 3, 4, 5].map(v => ({ label: String(v), dis: v > mx })) }; },
      T(10000), (p, x) => { bets[p.id] = Math.min(Math.max(1, Math.min(5, p.coins)), 1 + ((x.a && x.a.i) | 0)); showBets(bets, false); SFX.coin(); }, '🎲 Aposta feita (escondida)!');
    parts.forEach(p => { if (bets[p.id] == null) bets[p.id] = 1; });
    showBets(bets, true); SFX.pop();
    await say('Apostas na mesa!'); await sleep(T(1400));
    const { ans, okSet } = await runChoiceQuestion(q, parts, i + 1, lv.length, label, true, { extra: '<span class="qalive">🎲 valendo Moncoins</span>' });
    const fl = [];
    parts.forEach(p => {
      const b = bets[p.id];
      if (okSet.has(p.id)) { addOk(sc, p, ans[p.id] ? ans[p.id].t : LIMIT[q.lv]); sc[p.id].pts += 2 * b - 1; addCoins(p, 2 * b); }
      else if (p.online) { const d = -addCoins(p, -b); sc[p.id].pts -= d; }   // quem caiu depois de apostar não perde
    });
    await Promise.all(fl);
    await midScore(sc, parts, 'bank', D, i === lv.length - 1);
  }
}

// Verdadeiro ou Falso Relâmpago: 10 afirmações de 3 s
async function dynTF(parts, sc, D) {
  const N = 10;
  for (let i = 0; i < N; i++) {
    const lv = i < 4 ? 'f' : i < 8 ? 'm' : 'd';
    const q = drawQ(randTheme(), lv, x => x[0].length <= 80 && x[1].length <= 30);
    const truth = Math.random() < 0.5;
    const shown = truth ? q.opts[q.correct] : q.opts[pick([0, 1, 2, 3].filter(k => k !== q.correct))];
    const lim = T(11000);   // 3 s + 8 s para dar tempo de ler
    const th = THEMES[q.th];
    const draw = (phase, ans, okSet) => overlay(`<div class="quiz tf ${phase}"><div class="qhead"><span class="qdyn">✅ V ou F Relâmpago</span><span class="qnum">${i + 1} de ${N}</span><span class="qtheme" style="--tc:${th.color}">${th.emoji} ${th.name}</span></div>
      <div class="qtext tfq">${esc(q.q)}</div><div class="tfa">${esc(shown)}</div>
      ${phase === 'ask' ? `<div class="qtimer"><div class="qtbar" style="animation-duration:${lim}ms"></div></div><div class="qhint go">👉 Verdadeiro ou falso? Responda ${G.online ? 'no painel' : 'no celular'}!</div>` : `<div class="tfres ${truth ? 'v' : 'f'}">${truth ? '✅ VERDADEIRO' : `❌ FALSO · era ${esc(q.opts[q.correct])}`}</div>`}
      ${answeredRow(parts, phase === 'reveal' ? { phase, okSet } : null)}</div>`, 'quizpanel');
    draw('ask');
    if (i === 0) say('Valendo!'); else if (i === N - 1) say('Última!');
    const ans = await collect(parts, p => ({ screen: 'tf', q: q.q, a: shown, n: i + 1, tot: N, fx: { ink: p.debuff.ink > 0, inkC: p.debuff.inkC, freeze: p.debuff.freeze ? G.quizNo : 0 } }), lim, p => { markAnswered(p); SFX.pop(); });
    parts.forEach(p => { if (p.debuff.ink > 0) p.debuff.ink--; });
    const okSet = new Set();
    parts.forEach(p => { const a = ans[p.id]; if (a && (a.a.i === 0) === truth) { okSet.add(p.id); addOk(sc, p, a.t); } else if (p.online && useRetake(p)) { okSet.add(p.id); addOk(sc, p, lim); } });
    draw('reveal', ans, okSet);
    okSet.size ? SFX.ok() : SFX.bad();
    parts.forEach(p => setUI(p, { screen: 'res', ok: okSet.has(p.id), msg: okSet.has(p.id) ? '✅ Isso!' : ans[p.id] ? '❌ Errou' : '⏰ Muito lento!', sub: truth ? 'Era VERDADEIRO' : `Era FALSO: ${q.opts[q.correct]}` }));
    await sleep(T(1700));
  }
  await midScore(sc, parts, 'tf', D, true);
}

// Mais ou Menos: o Monc diz um número; a resposta é maior ou menor?
function hiloNumber(nq) {
  const a = nq.a, yr = new Date().getFullYear();
  if (isYearQ(nq)) {
    const off = 3 + rnd(28);
    let v = Math.random() < 0.5 ? a + off : a - off;
    if (v > yr) v = a - off;
    if (v === a) v = a - 3;
    return v;
  }
  const off = Math.max(1, Math.round(Math.abs(a) * (0.1 + Math.random() * 0.5)));
  let v = Math.random() < 0.5 ? a + off : a - off;
  if (v <= 0) v = a + off;
  return v;
}
async function dynHiLo(parts, sc, D) {
  const N = 5;
  for (let i = 0; i < N; i++) {
    await voiceIdle();
    const nq = drawNum(), num = hiloNumber(nq), up = nq.a > num;
    const rm = readMs(nq.q), lim = T(10000);
    const draw = (phase, okSet) => overlay(`<div class="quiz hilo ${phase}"><div class="qhead"><span class="qdyn">↕️ Mais ou Menos</span><span class="qnum">Pergunta ${i + 1} de ${N}</span></div>
      <div class="qtext">${esc(nq.q)}</div><div class="hlnum"><span>O Monc diz:</span><b>${fmtA(nq, num)}</b> ${esc(nq.unit)}</div>
      ${phase === 'read' ? `<div class="qtimer read"><div class="qtbar grow" style="animation-duration:${rm}ms"></div></div>` : phase === 'ask' ? `<div class="qtimer"><div class="qtbar" style="animation-duration:${lim}ms"></div></div><div class="qhint go">👉 A resposta certa é MAIOR ⬆️ ou MENOR ⬇️? Responda ${G.online ? 'no painel' : 'no celular'}!</div>` : `<div class="tfres v">Resposta: ${fmtA(nq, nq.a)} ${esc(nq.unit)} · era ${up ? 'MAIOR ⬆️' : 'MENOR ⬇️'}</div>`}
      ${answeredRow(parts, phase === 'reveal' ? { phase, okSet } : null)}</div>`, 'quizpanel');
    draw('read');
    parts.forEach(p => setUI(p, { screen: 'wait', msg: '👀 Leia a pergunta', sub: nq.q, read: rm, _ms: rm }));
    await readAloud(`${nq.q} Eu digo: ${fmtA(nq, num)}. É mais ou menos?`, rm);
    draw('ask');
    const ans = await collect(parts, p => ({ screen: 'hilo', q: nq.q, num: fmtA(nq, num), unit: nq.unit, n: i + 1, tot: N, fx: { ink: p.debuff.ink > 0, inkC: p.debuff.inkC, freeze: p.debuff.freeze ? G.quizNo : 0 } }), lim, p => { markAnswered(p); SFX.pop(); });
    parts.forEach(p => { if (p.debuff.ink > 0) p.debuff.ink--; });
    const okSet = new Set(), retook = new Set();
    parts.forEach(p => { const a = ans[p.id]; if (a && (a.a.i === 0) === up) { okSet.add(p.id); addOk(sc, p, a.t); } else if (p.online && useRetake(p)) { okSet.add(p.id); retook.add(p.id); addOk(sc, p, lim); } });
    draw('reveal', okSet);
    okSet.size ? SFX.ok() : SFX.bad();
    say(`A resposta é ${fmtA(nq, nq.a)}! Era ${up ? 'mais' : 'menos'}!`);
    await gate(parts, T(3400), p => ({ screen: 'res', ok: okSet.has(p.id), msg: retook.has(p.id) ? '📼 Regravar! Erro apagado' : okSet.has(p.id) ? '✅ Acertou!' : ans[p.id] ? '❌ Errou!' : '⏰ Não respondeu', sub: `Resposta: ${fmtA(nq, nq.a)} ${nq.unit} (${up ? 'MAIOR' : 'MENOR'} que ${fmtA(nq, num)})` }));
    await midScore(sc, parts, 'hilo', D, i === N - 1);
  }
}

// Batata Quente: só quem está com a batata responde
async function dynPotato(parts, sc, D) {
  const lv = LEVELS.potato, N = lv.length;
  parts.forEach(p => { sc[p.id].pts = 0; sc[p.id].tb = 0; });
  let holder = pick(parts), from = null;
  const ring = (phase, extra = '') => overlay(`<div class="potato"><div class="wtitle">🥔 BATATA QUENTE</div><div class="potring">${parts.map((p, i) => {
    const a = (i / parts.length) * Math.PI * 2 - Math.PI / 2, x = Math.cos(a) * 320, y = Math.sin(a) * 250;
    return `<div class="pr ${p === holder ? 'hold' : ''}" style="--pc:${p.color};transform:translate(${x}px,${y}px)"><span class="msav" style="background:${p.color}">${p.emoji}</span><b>${esc(p.name)}</b><i>${'🥔'.repeat(-sc[p.id].pts) || '—'}</i></div>`;
  }).join('')}<div class="potmid">${extra}</div></div></div>`, 'center');
  for (let i = 0; i < N; i++) {
    ring('who', `<div class="pm-n">Pergunta ${i + 1} de ${N}</div><div class="pm-h">🔥🥔🔥</div><div class="pm-t">${esc(holder.name)} está com a batata!</div>`);
    tokAnim(holder, 'hit');
    await say(i === 0 ? `A batata começa com ${holder.name}!` : `Batata com ${holder.name}!`);
    await sleep(T(900));
    await voiceIdle();
    const q = drawQ(randTheme(), lv[i]);
    const label = `🥔 Batata Quente · ${holder.emoji} ${holder.name}`;
    // a pergunta só para quem está com a batata (leitura + 8 s)
    renderQuestionTV(q, { dyn: label, n: i + 1, tot: N, phase: 'read', parts: [holder], rm: readMs(q.q) });
    const rm = readMs(q.q);
    parts.forEach(p => setUI(p, p === holder ? { screen: 'wait', msg: '🥔 A batata é sua! Leia', sub: q.q, read: rm, _ms: rm } : { screen: 'wait', msg: `🥔 ${holder.name} está com a batata`, sub: q.q }));
    await readAloud(q.q, rm);
    const lim = T(8000);
    renderQuestionTV(q, { dyn: label, n: i + 1, tot: N, phase: 'ask', parts: [holder], lim });
    const ans = await collect([holder], p => qUI(p, q, '🥔 Batata Quente', i + 1, N, true), lim, p => { markAnswered(p); SFX.pop(); });
    if (holder.debuff.ink > 0) holder.debuff.ink--;
    let ok = ans[holder.id] && ans[holder.id].a.i === q.correct, retook = false;
    if (!ok && holder.online && useRetake(holder)) { ok = true; retook = true; }
    renderQuestionTV(q, { dyn: label, n: i + 1, tot: N, phase: 'reveal', parts: [holder], ans, okSet: new Set(ok ? [holder.id] : []) });
    setUI(holder, resultUI(q, ans[holder.id], null, retook));
    let next;
    if (ok) {
      SFX.ok(); sc[holder.id].tb += 1; holder.stats.correct++;   // desempate: mais acertos
      await say(`${holder.name} acertou! Pra quem vai a batata?`);
      if (i < N - 1) {
        let cands = parts.filter(p => p !== holder && p !== from); if (!cands.length) cands = parts.filter(p => p !== holder);
        const r = await ask(holder, { screen: 'pick', title: '🥔 Passe a batata!', sub: 'Escolha quem fica com ela', opts: pickOpts(cands) }, T(10000), { id: pick(cands).id }, '🥔');
        next = (r && cands.find(p => p.id === r.id)) || pick(cands);
      }
    } else {
      SFX.bad(); sc[holder.id].pts -= 1; tokAnim(holder, 'sad');
      banner('🥔', `${holder.name} ficou com uma batata!`, `A resposta era ${q.opts[q.correct]}`, 2000, 'hot');
      await say(`Queimou! ${holder.name} fica com uma batata!`, { wait: true });
      next = pick(parts.filter(p => p !== holder));
    }
    if (next) { ring('pass'); await projectile(potXY(parts, holder), potXY(parts, next), '🥔', 650); from = holder; holder = next; }
  }
  ring('end', `<div class="pm-t">Fim! Vence quem tem menos batatas</div>`);
  await sleep(T(2200));
}
const potXY = (parts, p) => { const i = parts.indexOf(p), a = (i / parts.length) * Math.PI * 2 - Math.PI / 2; return [714 + Math.cos(a) * 320, 600 + Math.sin(a) * 250]; };

// Contra o Relógio: 40 s, as mesmas perguntas para todos em ordem diferente (roda no celular de cada um)
async function dynClock(parts, sc, D) {
  const qs = [];
  for (let i = 0; i < 30; i++) { const q = drawQ(randTheme(), 'm'); qs.push([q.q, q.opts, q.correct, q.th]); }
  G.shared = { clock: qs };
  G.live = {};
  const dur = T(40000);
  const lanes = () => { const el = $('#lanes'); if (!el) return; const mx = Math.max(8, ...parts.map(p => (G.live[p.id] || {}).ok || 0));
    el.innerHTML = parts.map(p => { const v = G.live[p.id] || { ok: 0, err: 0 }; return `<div class="lane" style="--pc:${p.color}"><span class="msav" style="background:${p.color}">${p.emoji}</span><b>${esc(p.name)}</b><div class="ltrack"><div class="lbar" style="width:${(v.ok / mx) * 100}%"></div></div><span class="lok">${v.ok} ✔</span><span class="lerr">${v.err} ✖</span></div>`; }).join(''); };
  renderLive = lanes;
  overlay(`<div class="clockq"><div class="wtitle">⏱️ CONTRA O RELÓGIO</div><div class="qhint go">👉 Responda o máximo que puder ${G.online ? 'no painel' : 'no celular'}! Errou? 2 s travado.</div>
    <div class="qtimer"><div class="qtbar" style="animation-duration:${dur}ms"></div></div><div id="lanes" class="lanes"></div></div>`, 'quizpanel');
  lanes();
  say('Valendo! Quarenta segundos no relógio!');
  const ticker = setInterval(() => SFX.tick(), 1000);
  const ans = await collect(parts, p => ({ screen: 'clock', dur, order: shuffle(qs.map((_, i) => i)), fx: { ink: p.debuff.ink > 0, inkC: p.debuff.inkC, freeze: p.debuff.freeze ? G.quizNo : 0, ear: p.buff.ear, retake: p.buff.retake } }), dur + T(2500), (p, x) => { G.live[p.id] = { ok: x.a.ok | 0, err: x.a.err | 0 }; lanes(); }, '⏱️ Tempo! Esperando os outros…');
  clearInterval(ticker);
  parts.forEach(p => {
    const a = (ans[p.id] && ans[p.id].a) || G.live[p.id] || {};
    sc[p.id].pts = a.ok | 0; sc[p.id].err = a.err | 0; sc[p.id].tb = -((a.err | 0) * 1e6 + (a.last | 0));
    p.stats.correct += a.ok | 0;
    if (a.used) { p.buff.retake = 0; }
  });
  lanes(); SFX.ok();
  await say('Tempo esgotado! Vamos ver quem foi mais rápido!', { wait: true });
  await sleep(T(1200));
  renderLive = () => { };
}
let renderLive = () => { };

/* ---------- prêmios do Monquiz ---------- */
async function roundResults(dyn, sc, parts, absent) {
  await voiceIdle();
  let ranking = rankRound(sc, parts);
  const nAll = G.players.length;
  absent.forEach(p => ranking.push({ p, place: nAll, absent: true }));      // desconectado leva a recompensa de último
  const maxPlace = Math.max(...ranking.map(r => r.place));
  const allTied = ranking.every(r => r.place === 1);
  const table = PLACE_ITEMS[Math.max(2, Math.min(8, nAll))];
  const gf = grandFinal() ? 2 : 1;
  ranking.forEach(r => {
    r.reward = (REWARDS[r.place - 1] ?? 1) * gf;
    r.tier = allTied ? table[0] : (r.place === maxPlace && maxPlace > 1) ? 'risky' : table[Math.min(r.place, table.length) - 1];
    if (r.p.buff.allin) { r.allin = true; if (r.place === 1) r.reward *= 3; }
  });
  const D = DYNS[dyn];
  overlay(`<div class="results"><div class="wtitle">🏆 Resultado do Monquiz — ${D.e} ${D.n}${gf > 1 ? ' <span class="gfpill">PRÊMIOS EM DOBRO</span>' : ''}</div>
    <div class="rrows">${ranking.map((r, i) => `<div class="rr" style="--pc:${r.p.color};animation-delay:${(ranking.length - i) * 0.25}s"><span class="rpl">${r.place}º</span><span class="msav" style="background:${r.p.color}">${r.p.emoji}</span><b>${esc(r.p.name)}</b>
      <span class="rpts">${r.absent ? 'desconectado' : scoreTxt(dyn, sc[r.p.id])}</span>
      <span class="rrew">+${r.reward} ${COIN}${r.allin ? (r.place === 1 ? ' 🎰×3' : ' 🎰') : ''}</span><span class="ritem" id="ri-${r.p.id}"></span></div>`).join('')}</div></div>`, 'center');
  const win = ranking.filter(r => r.place === 1);
  await say(`Fim do Monquiz! ${win.length > 1 ? 'Empate no topo entre ' + win.map(w => w.p.name).join(' e ') : 'Quem venceu foi ' + win[0].p.name}! Todo mundo leva Moncoins e um item pela colocação.`, { wait: true });
  for (const r of ranking) {
    addCoins(r.p, r.reward);
    if (r.allin) {
      if (r.place === 1) { applause(); floatText(r.p, '🎰 TRIPLO!', '#fde047'); }
      else { const d = -addCoins(r.p, -6); floatText(r.p, `🎰 −${d}`, '#fca5a5'); }
    }
  }
  await sleep(T(700));
  for (const r of [...ranking].reverse()) {
    const el = $('#ri-' + r.p.id);
    if (r.p.items.length >= 3) { if (el) el.innerHTML = '<span class="full">🎒 mochila cheia</span>'; continue; }
    const k = pick(itemsOfTier(r.tier));
    giveItem(r.p, k, true);
    if (el) el.innerHTML = `<span class="ichip t-${r.tier}">${ITEMS[k].e} ${ITEMS[k].n}</span>`;
    SFX.pop(); await sleep(T(260));
  }
  const allinS = ranking.filter(r => r.allin);
  if (allinS.length) await say(allinS.map(r => r.place === 1 ? `${r.p.name} apostou tudo e ganhou o triplo!` : `${r.p.name} apostou tudo e perdeu seis!`).join(' '));
  const last = ranking.filter(r => r.place === maxPlace && maxPlace > 1);
  if (last.length) say(`E ${last.map(r => r.p.name).join(' e ')}, em último, ${last.length > 1 ? 'levam' : 'leva'} um item arriscado. Boa sorte!`);
  G.players.forEach(p => { const r = ranking.find(x => x.p === p); setUI(p, { screen: 'res', ok: r && r.place === 1, msg: `${r ? r.place : '?'}º lugar no Monquiz`, sub: `+${r ? r.reward : 0} ${COIN}` + (r && r.allin ? (r.place === 1 ? ' (Tudo ou Nada: triplo!)' : ' · Tudo ou Nada: −6') : '') }); });
  await sleep(T(3000));
  // a ordem do próximo turno segue esta classificação (empate mantém a ordem anterior)
  const prev = G.order.slice();
  G.order = ranking.slice().sort((a, b) => a.place - b.place || prev.indexOf(a.p.id) - prev.indexOf(b.p.id)).map(r => r.p.id);
  // a próxima dinâmica é anunciada já
  if (G.turn < G.maxTurns) {
    G.nextDyn = nextDyn(); const nd = DYNS[G.nextDyn];
    overlay(`<div class="dynintro"><div class="di-top">📺 PRÓXIMO MONQUIZ</div><div class="di-e">${nd.e}</div><div class="di-n">${nd.n}</div><div class="di-d">${nd.d}</div><div class="di-r">Use seus itens pensando nisso!</div></div>`, 'center');
    await say(`E no próximo Monquiz: ${nd.n}! Usem seus itens pensando nisso!`, { wait: true });
    await sleep(T(900));
  } else G.nextDyn = null;
}

/* ---------- final ---------- */
async function finale() {
  await voiceIdle();
  G.cur = null; stageMode('quiz'); renderSide();
  waitAll('🏁 Fim de jogo!', LOOK());
  SFX.fanfare();
  overlay(`<div class="dynintro"><div class="di-top">🏁 FIM DE JOGO!</div><div class="di-e">${MIC}</div><div class="di-n">${STARS} bônus</div><div class="di-d">Antes do resultado final, três ${STARS} bônus sorteados para esta noite podem mudar tudo!</div></div>`, 'center');
  await say(`Acabou! Mas calma, antes do resultado ainda temos três ${STARS} bônus, sorteados só para esta noite!`, { wait: true });
  const bonuses = (G.bonus && G.bonus.length ? G.bonus : ['genio', 'magnata', 'encrenca']).map(k => BONUS[k]);
  for (const b of bonuses) {
    const best = Math.max(...G.players.map(b.f));
    const ws = best > 0 ? G.players.filter(p => b.f(p) === best) : [];
    overlay(`<div class="bonus"><div class="bo-e">${b.e}</div><div class="bo-n">${STAR} ${b.n}</div><div class="bo-d">${b.d}</div><div class="bo-w" id="bow">🥁 …</div></div>`, 'center');
    await say(`${STAR} ${b.n}: ${b.d}. E vai para...`, { wait: true });
    await sleep(T(900));
    SFX.fanfare();
    ws.forEach(p => p.stars++);
    $('#bow').innerHTML = ws.length ? ws.map(p => `<span class="bow1" style="--pc:${p.color}"><span class="msav" style="background:${p.color}">${p.emoji}</span>${esc(p.name)}</span>`).join('') + (b === BONUS.rapido ? '' : `<div class="bo-v">(${best})</div>`) : 'Ninguém!';
    if (ws.length) applause();
    renderSide();
    await say(ws.length ? ws.map(p => p.name).join(' e ') + '!' : 'Ninguém!', { wait: true });
    await sleep(T(1200));
  }
  const ranking = G.players.slice().sort((a, b) => b.stars - a.stars || b.coins - a.coins);
  const podium = ranking.slice(0, 3);
  overlay(`<div class="final"><div class="fi-t">🏆 RESULTADO FINAL</div>
    <div class="podium">${[1, 0, 2].map(i => podium[i] ? `<div class="pod pod${i + 1} hide" id="pod${i}" style="--pc:${podium[i].color}"><div class="pav2" style="background:${podium[i].color}">${podium[i].emoji}</div><div class="pn">${esc(podium[i].name)}</div><div class="ps">${MIC} ${podium[i].stars} · ${COIN} ${podium[i].coins}</div><div class="pblock">${i + 1}º</div></div>` : '').join('')}</div>
    <div class="rest">${ranking.slice(3).map((p, i) => `<span class="rest1">${i + 4}º ${p.emoji} ${esc(p.name)} — ${MIC} ${p.stars} · ${COIN} ${p.coins}</span>`).join('')}</div>
    <button id="again" class="startbtn small">🔁 Jogar de novo</button></div>`, 'center');
  G.players.forEach(p => { const pl = rankOf(p); setUI(p, { screen: 'final', place: pl, stars: p.stars, coins: p.coins, msg: pl === 1 ? '🏆 VOCÊ VENCEU!' : pl === 2 ? '🥈 Segundo lugar!' : pl === 3 ? '🥉 Terceiro lugar!' : `${pl}º lugar` }); });
  G.nextDyn = null; renderSide();
  for (const i of [2, 1, 0]) {
    if (!podium[i]) continue;
    await say(i === 0 ? "E o grande campeão do Monc's Show é..." : `Em ${i + 1}º lugar...`, { wait: true });
    await sleep(T(500));
    $('#pod' + i).classList.remove('hide'); i === 0 ? SFX.fanfare() : SFX.pop();
    if (i === 0) applause(4000);
    await say(i === 0 ? `${podium[0].name}! Parabéns! Placa de aplausos, por favor! Boa noite e até o próximo Monc's Show!` : podium[i].name + '!', { wait: true });
  }
  $('#again').onclick = () => {
    const room = G.room, ps = G.players, mt = G.maxTurns;
    const mp = G.map; G = newGame(room); G.maxTurns = mt; G.map = mp;
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

function tvMain(resume, opts = {}) {
  if (resume) loadMap(resume.map);
  buildTV(opts.container); Voice.init();
  if (resume) {
    G = resume; Object.keys(pending).forEach(k => delete pending[k]);
    UIC = Math.max(UIC, ...G.players.map(p => (p.ui && p.ui.id) || 0)) + 1000;
    G.players.forEach(p => { p.online = false; p.lastSeen = Date.now(); waitUI(p, '🔄 Retomando a partida…'); });
  } else { G = newGame(makeRoom()); if (opts.online) G.online = true; }
  $('#roomtag').textContent = 'Sala ' + G.room;
  net = createTransport(G.room, m => { lastTVMsg = Date.now(); onTVMsg(m); }, setConn);   // lastTVMsg: só mensagens que vieram pela rede
  if (G.online) {   // o anfitrião também joga: as telas dele chegam direto, sem passar pela rede
    const raw = net.send;
    net.send = m => { raw(m); if (m.t === 's') setTimeout(() => onPhoneMsg(m), 0); };
  }
  setInterval(sendSync, 2500);
  document.addEventListener('click', () => SFX.init(), { once: true });
  if (resume) {
    stageMode('board'); renderSide();
    const go = () => { SFX.init(); say("E estamos de volta com o Monc's Show! Voltamos do intervalo!"); gameLoop(); };
    overlay(`<div class="dynintro"><div class="di-top">🔄 Partida recuperada</div><div class="di-d">${G.online ? 'Peça para todos abrirem o link de novo no computador.' : 'Peça para todos abrirem o jogo de novo no celular (mesmo link).'}<br>Turno ${G.turn} de ${G.maxTurns}.</div><button id="resumego" class="startbtn small">▶ Continuar</button></div>`, 'center');
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
  document.body.innerHTML = `<div id="pbar"></div><div id="pmain"></div>`;
  phoneCore(room);
}

// opts.local: anfitrião do online (fala direto com o jogo) · opts.online: painel do modo online
function phoneCore(room, opts = {}) {
  PH.room = room.toUpperCase(); PH.online = !!(opts.online || opts.local); PH.isHost = !!opts.local;
  const ls = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  // crachá: vem do link (aba restaurada) ou do armazenamento do navegador
  const urlId = !opts.local && PARAMS.get('id');
  PH.pid = urlId || ls('qp_pid_' + LSX + PH.room) || uid();
  try { localStorage.setItem('qp_pid_' + LSX + PH.room, PH.pid); if (urlId) localStorage.setItem('qp_joined_' + LSX + PH.room, '1'); } catch (e) { }
  PH.name = ls('qp_name' + LSX) || '';
  PH.emoji = ls('qp_emoji' + LSX) || pick(AVATARS);
  if (opts.local) { PH.net = { send: m => setTimeout(() => onTVMsg(m), 0) }; PH.conn = true; }
  else PH.net = createTransport(PH.room, m => { if (m && m.t === 's') onPhoneMsg(m); else if (opts.onMsg) opts.onMsg(m); },
    st => { PH.conn = st === 'ok'; renderBar(); if (PH.conn) { PH.net.send({ t: 'hello', pid: PH.pid }); if (opts.onConnect) opts.onConnect(); } });
  const wasJoined = opts.local || ls('qp_joined_' + LSX + PH.room) === '1';
  if (wasJoined && (PH.name || urlId)) { PH.joined = true; sendJoin(); showMsg(opts.local ? '🎬 Abrindo a sala…' : '🔄 Conectando…', opts.local ? '' : 'Procurando ' + (PH.online ? 'o anfitrião' : 'a TV') + ' da sala ' + PH.room); }
  else renderJoin();
  setInterval(() => {
    if (PH.pendingAct && PH.pendingAct.uid === PH.cur.id) PH.net.send(PH.pendingAct.msg);
    else PH.pendingAct = null;
    if (PH.joined && !PH.me) sendJoin();
  }, 1300);
  setInterval(() => { if (PH.joined) PH.net.send({ t: 'hello', pid: PH.pid }); renderBar(); }, 5000);
  // vigia: a TV manda atualização a cada 2,5 s; silêncio de 6 s = canal morto, refaz na hora
  const startedAt = Date.now();
  setInterval(() => {
    if (opts.local) return;
    const quiet = Date.now() - (PH.lastMsg || startedAt);
    reconBar(quiet > 6000);
    if (quiet > 6000 && PH.net.reconnect) PH.net.reconnect();
  }, 2000);
  const back = () => {
    if (document.hidden) return;
    keepAwake();
    if (!opts.local && PH.net.reconnect && Date.now() - (PH.lastMsg || 0) > 3000) PH.net.reconnect();
    PH.net.send({ t: 'hello', pid: PH.pid });
    if (PH.joined) sendJoin();
  };
  document.addEventListener('visibilitychange', back);
  window.addEventListener('pageshow', back);
  window.addEventListener('online', back);
  window.addEventListener('focus', back);
}

// aviso "reconectando" no celular
function reconBar(show) {
  let el = $('#precon');
  if (!show) { if (el) el.remove(); return; }
  if (el) return;
  el = document.createElement('div'); el.id = 'precon'; el.className = 'precon';
  el.innerHTML = `<span>🔄 Reconectando ao show…</span><button onclick="location.reload()">Recarregar</button>`;
  document.body.appendChild(el);
}
// coloca o crachá no link, para a aba restaurada voltar identificada
function stampURL() {
  if (PH.isHost) return;
  try { const u = new URL(location.href); if (u.searchParams.get('id') !== PH.pid) { u.searchParams.set('id', PH.pid); history.replaceState(null, '', u.toString()); } } catch (e) { }
}
// "Quem é você?": aparelho sem crachá no meio da partida escolhe a própria vaga (só as offline)
function renderClaim(list) {
  const key = JSON.stringify(list);
  if (PH.claimKey === key && $('#claimbox')) return;
  PH.claimKey = key;
  $('#pmain').innerHTML = `<div class="pchoose" id="claimbox"><div class="pc-t">🔌 A partida já começou</div>
    <div class="pc-s">Você estava jogando e caiu? Toque no seu nome para voltar de onde parou.</div>
    ${list.length ? `<div class="plist">${list.map(o => `<button class="ppl claim" data-id="${o.id}" style="--pc:${o.color}"><span class="pbav" style="background:${o.color}">${o.emoji}</span><b>${esc(o.name)}<small>offline · toque para voltar</small></b></button>`).join('')}</div>`
      : `<div class="pwait"><div class="pw-msg">⏳ Procurando sua vaga…</div><div class="pw-sub">Se você estava jogando, seu nome aparece aqui em até 15 segundos, assim que a TV perceber que você saiu.<br>Jogadores novos não entram no meio da partida.</div></div>`}</div>`;
  $('#pmain').querySelectorAll('.claim').forEach(b => b.onclick = () => {
    PH.claimKey = null;
    PH.net.send({ t: 'claim', pid: PH.pid, id: b.dataset.id });
    showMsg('🔌 Voltando para o show…', 'Conferindo sua vaga');
  });
}

let wakeLock = null;
async function keepAwake() { try { if ('wakeLock' in navigator && !document.hidden) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { } }

function sendJoin() { PH.net.send({ t: 'join', pid: PH.pid, name: PH.name, emoji: PH.emoji }); }

function renderJoin() {
  const main = $('#pmain');
  main.innerHTML = `<div class="pjoin">
    <div class="plogo">MONC'S<br>SHOW<span class="onair sm"><span class="rec"></span>AO VIVO</span></div>
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
    showMsg('⏳ Entrando…', PH.conn ? (PH.online ? 'Falando com o anfitrião' : 'Falando com a TV') : 'Conectando à sala…');
  };
}

function onPhoneMsg(m) {
  if (!m || m.t !== 's') return;
  PH.lastMsg = Date.now();
  PH.taken = m.taken || [];
  if (m.sh !== undefined) PH.sh = m.sh;
  reconBar(false);
  // vaga confirmada: este aparelho assume o crachá do jogador
  const claimed = m.claims && m.claims[PH.pid];
  if (claimed && claimed !== PH.pid) {
    PH.pid = claimed; PH.joined = true; PH.cur = { id: -1 }; PH.claimKey = null;
    try { localStorage.setItem('qp_pid_' + LSX + PH.room, PH.pid); localStorage.setItem('qp_joined_' + LSX + PH.room, '1'); } catch (e) { }
    stampURL(); sendJoin(); keepAwake();
  }
  // aparelho novo no meio da partida: vai direto para o "Quem é você?"
  if (!PH.joined && m.ph && m.ph !== 'lobby' && !PH.isHost) { renderClaim(m.cl || []); return; }
  if (!PH.joined) {
    $('#avs') && $('#avs').querySelectorAll('.av').forEach(b => b.classList.toggle('taken', PH.taken.includes(b.dataset.a) && b.dataset.a !== PH.emoji));
    return;
  }
  const rj = m.rej && m.rej[PH.pid];
  const mine = m.ps && m.ps[PH.pid];
  if (!mine) {
    if (rj === 'claim' || rj === 'started') { renderClaim(m.cl || []); return; }
    if (rj) {
      PH.joined = false; try { localStorage.removeItem('qp_joined_' + LSX + PH.room); } catch (e) { }
      const msgs = { full: 'A sala está cheia (8 jogadores).', started: PH.online ? 'A partida já começou. Dá para assistir pelo tabuleiro ao lado.' : 'A partida já começou sem você.', kicked: 'Você foi removido da sala.' };
      showMsg('🚫 Não deu para entrar', msgs[rj] || '', true);
    }
    return;
  }
  if (!PH.me) stampURL();
  PH.me = mine.me; renderBar(); PH.claimKey = null;
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
  const fx = (me.debuff && me.debuff.ink ? '🦑' : '') + (me.debuff && me.debuff.freeze ? '🧊' : '') + (me.buff && me.buff.ear ? '🎧' : '') + (me.buff && me.buff.retake ? '📼' : '') + (me.buff && me.buff.allin ? '🎰' : '');
  b.innerHTML = `<div class="pb-l">${dot}<span class="pbav" style="background:${me.color}">${me.emoji}</span><b>${esc(me.name)}</b><span class="pbsym">${me.sym || ''}</span></div>
    <div class="pb-r"><span>${me.rank}º</span><span>${MIC} ${me.stars}</span><span>${COIN} ${me.coins}</span><span class="pbi">${(me.items || []).map(k => ITEMS[k] ? ITEMS[k].e : '').join('')}</span>${fx ? `<span class="pbfx">${fx}</span>` : ''}</div>`;
}

function showMsg(msg, sub, err) {
  $('#pmain').innerHTML = `<div class="pwait ${err ? 'err' : ''}"><div class="pw-msg">${esc(msg)}</div>${sub ? `<div class="pw-sub">${esc(sub)}</div>` : ''}${err ? `<button class="pbig" onclick="location.reload()">Tentar de novo</button>` : ''}</div>`;
}

function act(a) {
  const msg = { t: 'act', pid: PH.pid, uid: PH.cur.id, a, el: Date.now() - (PH.shownAt || Date.now()) };
  PH.pendingAct = { uid: PH.cur.id, msg };
  PH.net.send(msg);
  try { navigator.vibrate && navigator.vibrate(30); } catch (e) { }
}

function timerHTML() { return PH.dl ? `<div class="ptimer"><div class="ptbar"></div><span class="pcount"></span></div>` : ''; }
function startTimerBar(total) {
  clearInterval(PH.tmr);
  const bar = $('.ptbar'); if (!bar || !PH.dl) return;
  const tot = total || Math.max(1, PH.dl - Date.now());
  const cnt = $('.pcount');
  const upd = () => {
    const left = PH.dl - Date.now();
    bar.style.width = Math.max(0, Math.min(100, left / tot * 100)) + '%';
    if (cnt) { const sLeft = Math.ceil(left / 1000); cnt.textContent = sLeft <= 10 && sLeft > 0 && tot > 12000 ? sLeft : ''; cnt.classList.toggle('hurry', sLeft <= 10 && tot > 12000); }
    if (left <= 0) clearInterval(PH.tmr);
  };
  upd(); PH.tmr = setInterval(upd, 100);
}

/* ---------- efeitos dos itens no celular ---------- */
// gelo do Congelar: cada botão quebra com 7 toques e fica livre pelo resto do Monquiz
const ICE_TAPS = 7;
function iceState(qz) { if (!PH.ice || PH.ice.qz !== qz) PH.ice = { qz, broken: new Set(), hits: {} }; return PH.ice; }
function addIce(btn, key, qz) {
  const st = iceState(qz);
  if (st.broken.has(key)) return;
  const blk = document.createElement('div'); blk.className = 'iceblk';
  const left = () => ICE_TAPS - (st.hits[key] || 0);
  blk.innerHTML = `<span class="ib-e">🧊</span><span class="ib-n">${left()}</span>`;
  blk.style.setProperty('--crack', (st.hits[key] || 0) / ICE_TAPS);
  blk.onclick = ev => {
    ev.stopPropagation(); ev.preventDefault();
    st.hits[key] = (st.hits[key] || 0) + 1;
    try { SFX.init(); SFX.crack(); navigator.vibrate && navigator.vibrate(15); } catch (e) { }
    blk.classList.remove('hitme'); void blk.offsetWidth; blk.classList.add('hitme');
    blk.style.setProperty('--crack', st.hits[key] / ICE_TAPS);
    if (left() <= 0) { st.broken.add(key); blk.classList.add('gone'); setTimeout(() => blk.remove(), 250); }
    else $('.ib-n', blk).textContent = left();
  };
  btn.style.position = 'relative'; btn.appendChild(blk);
}
function addInk(box, color, n = 7) {
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div'); s.className = 'splat';
    s.style.setProperty('--ic', color || '#0b0b14');
    s.style.left = (5 + Math.random() * 70) + '%'; s.style.top = (Math.random() * 75) + '%';
    s.style.width = s.style.height = (110 + Math.random() * 80) + 'px';
    s.style.transform = `rotate(${rnd(360)}deg)`;
    s.onclick = ev => { ev.stopPropagation(); s.classList.add('gone'); setTimeout(() => s.remove(), 250); };
    box.appendChild(s);
  }
}
function fxTips(fx) {
  const t = [];
  if (fx.ink) t.push('🦑 Tinta! Toque nas manchas para limpar');
  if (fx.freeze && PH.ice && PH.ice.qz === fx.freeze ? PH.ice.broken.size < 4 : fx.freeze) t.push('🧊 Congelado! Toque 7 vezes no gelo para liberar o botão');
  if (fx.ear != null && fx.ear !== false) t.push('🎧 Ponto eletrônico: uma alternativa errada foi eliminada');
  return t.length ? `<div class="inktip">${t.join('<br>')}</div>` : '';
}

/* ---------- Contra o Relógio (roda no celular) ---------- */
function runClock(ui) {
  const main = $('#pmain'), qs = (PH.sh && PH.sh.clock) || [];
  const myId = ui.id, fx = ui.fx || {}, t0 = Date.now(), end = t0 + ui.dur;
  let k = 0, ok = 0, err = 0, last = 0, lockUntil = 0, earLeft = fx.ear || 0, inkLeft = fx.ink ? 3 : 0, retake = !!fx.retake, used = false;
  const send = () => PH.net.send({ t: 'prog', pid: PH.pid, uid: myId, v: { ok, err } });
  const done = () => { clearInterval(iv); if (PH.cur.id !== myId) return; main.innerHTML = `<div class="pwait"><div class="pw-msg">⏱️ Tempo!</div><div class="pw-sub">${ok} acertos · ${err} erros</div></div>`; act({ ok, err, last, used }); };
  const draw = () => {
    if (PH.cur.id !== myId) return;
    const q = qs[ui.order[k % ui.order.length]]; if (!q) return done();
    const [qq, opts, correct, th] = q;
    const ear = earLeft > 0 ? pick([0, 1, 2, 3].filter(i => i !== correct)) : -1;
    main.innerHTML = `<div class="pq clockp"><div class="pq-h"><span>⏱️ Contra o Relógio</span><span class="ck-sc">✔ ${ok} · ✖ ${err}</span></div>
      <div class="ptimer"><div class="ptbar" id="ckbar"></div></div>
      <div class="pq-q">${esc(qq)}</div>
      <div class="pq-opts">${opts.map((o, i) => `<button class="pqo ${i === ear ? 'elim' : ''}" data-i="${i}" ${i === ear ? 'disabled' : ''} style="--oc:${OPT_COLORS[i]}"><span class="pqs">${OPT_SHAPES[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
      <div id="cklock" class="cklock hidden">⛔ Errou! 2 s</div>${fxTips({ ink: inkLeft > 0, freeze: fx.freeze, ear: ear >= 0 ? ear : null })}</div>`;
    if (ear >= 0) earLeft--;
    const box = $('.pq-opts');
    if (inkLeft > 0) { addInk(box, fx.inkC, 5); inkLeft--; }
    if (fx.freeze) main.querySelectorAll('.pqo').forEach((b, i) => addIce(b, 'q' + i, fx.freeze));
    main.querySelectorAll('.pqo').forEach(b => b.onclick = () => {
      if (Date.now() < lockUntil || Date.now() >= end) return;
      const i = +b.dataset.i;
      if (i === correct) { ok++; last = Date.now() - t0; SFX.init(); SFX.pop(); }
      else if (retake) { retake = false; used = true; ok++; last = Date.now() - t0; }
      else { err++; lockUntil = Date.now() + T(2000); SFX.init(); SFX.bad(); try { navigator.vibrate && navigator.vibrate([60, 40, 60]); } catch (e) { } }
      send(); k++;
      if (Date.now() < lockUntil) { const l = $('#cklock'); if (l) l.classList.remove('hidden'); main.querySelectorAll('.pqo').forEach(x => x.disabled = true); setTimeout(draw, lockUntil - Date.now()); }
      else draw();
    });
  };
  const iv = setInterval(() => {
    if (PH.cur.id !== myId) { clearInterval(iv); return; }
    const bar = $('#ckbar'); if (bar) bar.style.width = Math.max(0, (end - Date.now()) / ui.dur * 100) + '%';
    if (Date.now() >= end) done();
  }, 100);
  draw();
}

function renderPhoneUI(ui) {
  clearInterval(PH.tmr);
  PH.shownAt = Date.now();
  const main = $('#pmain');
  const lock = () => main.querySelectorAll('button').forEach(b => b.disabled = true);
  const skipBtn = ui.skip ? `<button class="pbig pskip" id="skip">Continuar ▶</button>` : '';
  const bindSkip = () => { const b = $('#skip'); if (b) b.onclick = () => { lock(); act({ skip: 1 }); b.textContent = '✋ Esperando os outros…'; }; };
  switch (ui.screen) {
    case 'lobby':
      main.innerHTML = `<div class="pwait"><div class="pw-big" style="background:${PH.me.color}">${PH.me.emoji}<span class="psym">${PH.me.sym || ''}</span></div><div class="pw-msg">Você está no show!</div><div class="pw-sub">${PH.isHost ? 'Você é o anfitrião!<br>Escolha o mapa, os turnos e as dinâmicas no tabuleiro e clique em <b>Começar o show</b>.' : PH.online ? 'Aguarde o anfitrião começar a partida.' : 'Aguarde a TV começar a partida.<br>Deixe o volume da TV alto 😄'}</div></div>`;
      break;
    case 'wait':
      main.innerHTML = `<div class="pwait"><div class="pw-msg">${esc(ui.msg || '')}</div>${ui.sub ? `<div class="pw-sub ${ui.read ? 'big' : ''}">${esc(ui.sub)}</div>` : ''}${ui.read ? `<div class="pread">📖 As alternativas aparecem em instantes…</div>${timerHTML()}` : ''}${skipBtn}</div>`;
      if (ui.read) startTimerBar(ui.read);
      bindSkip();
      break;
    case 'turn': {
      try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch (e) { }
      const nd = ui.next && DYNS[ui.next];
      main.innerHTML = `<div class="pturn"><div class="pt-t">🎲 SUA VEZ!</div>${timerHTML()}
        <button class="pbig roll ${ui.crazy ? 'crazy' : ''}" id="roll">${ui.crazy ? '🤪 ROLAR O DADO MALUCO' : ui.dice > 1 ? '✌️ ROLAR 2 DADOS' : '🎲 ROLAR O DADO'}</button>
        ${ui.items && ui.items.length ? `<div class="pt-sub">ou use <b>um</b> item antes de rolar:</div><div class="plist">${ui.items.map(k => `<button class="pitem t-${ITEMS[k].tier}" data-k="${k}"><span class="pi-e">${ITEMS[k].e}</span><span><b>${ITEMS[k].n}</b> <em class="tiertag">${TIERS[ITEMS[k].tier].n}</em><small>${ITEMS[k].d}</small></span></button>`).join('')}</div>` : ''}
        ${nd ? `<div class="pt-next">📺 Próximo Monquiz: <b>${nd.e} ${nd.n}</b></div>` : ''}
      </div>`;
      $('#roll').onclick = () => { lock(); act({ a: 'roll' }); $('#roll').textContent = '🎲 Rolando…'; };
      main.querySelectorAll('.pitem').forEach(b => b.onclick = () => { lock(); act({ a: 'item', k: b.dataset.k }); });
      startTimerBar();
      break;
    }
    case 'pick':
      main.innerHTML = `<div class="pchoose"><div class="pc-t">${esc(ui.title)}</div>${ui.sub ? `<div class="pc-s">${esc(ui.sub)}</div>` : ''}${timerHTML()}
        <div class="plist">${ui.opts.map(o => `<button class="ppl" data-id="${o.id}" style="--pc:${o.color}" ${o.dis ? 'disabled' : ''}><span class="pbav" style="background:${o.color}">${o.emoji}</span><b>${esc(o.name)} <span class="pbsym">${o.sym || ''}</span>${o.why ? `<small>${esc(o.why)}</small>` : ''}</b><span class="ppl-s">${MIC}${o.stars} ${COIN}${o.coins}${o.items ? ' · ' + o.items : ''}</span></button>`).join('')}</div>
        ${ui.cancel ? `<button class="pcancel" id="cx">Cancelar</button>` : ''}</div>`;
      main.querySelectorAll('.ppl').forEach(b => b.onclick = () => { lock(); b.classList.add('chosen'); act({ id: b.dataset.id }); });
      if (ui.cancel) $('#cx').onclick = () => { lock(); act({ cancel: true }); };
      startTimerBar();
      break;
    case 'choose':
      main.innerHTML = `<div class="pchoose"><div class="pc-t">${esc(ui.title)}</div>${ui.sub ? `<div class="pc-s">${esc(ui.sub)}</div>` : ''}${timerHTML()}
        <div class="plist ${ui.grid ? 'grid' : ''}">${ui.opts.map((o, i) => `<button class="popt ${o.color ? 'colored' : ''}" data-i="${i}" ${o.dis ? 'disabled' : ''} ${o.color ? `style="--bc:${o.color}"` : ''}><b>${esc(o.label)}${o.pat ? ` <span class="patline">${o.pat}</span>` : ''}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`).join('')}</div>
        ${ui.cancel ? `<button class="pcancel" id="cx">Cancelar</button>` : ''}</div>`;
      main.querySelectorAll('.popt').forEach(b => b.onclick = () => { lock(); b.classList.add('chosen'); act({ i: +b.dataset.i }); });
      if (ui.cancel) $('#cx').onclick = () => { lock(); act({ cancel: true }); };
      startTimerBar();
      break;
    case 'q': {
      const th = THEMES[ui.th] || { emoji: '', name: '' };
      const fx = ui.fx || {};
      main.innerHTML = `<div class="pq"><div class="pq-h"><span>${esc(ui.dyn)} · ${ui.n}/${ui.tot}</span><span>${th.emoji} ${esc(th.name)} · ${LEVEL_NAME[ui.lv] || ''}</span></div>
        <div class="pq-q">${esc(ui.q)}</div>${timerHTML()}
        <div class="pq-opts">${ui.opts.map((o, i) => `<button class="pqo ${fx.ear === i ? 'elim' : ''}" data-i="${i}" ${fx.ear === i ? 'disabled' : ''} style="--oc:${OPT_COLORS[i]}"><span class="pqs">${fx.ear === i ? '🎧' : OPT_SHAPES[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
        ${fxTips(fx)}</div>`;
      main.querySelectorAll('.pqo').forEach(b => b.onclick = () => { lock(); b.classList.add('chosen'); act({ i: +b.dataset.i }); });
      startTimerBar();
      if (fx.freeze) main.querySelectorAll('.pqo').forEach((b, i) => { if (fx.ear !== i) addIce(b, 'q' + i, fx.freeze); });
      if (fx.ink) addInk($('.pq-opts'), fx.inkC);
      break;
    }
    case 'tf':
    case 'hilo': {
      const fx = ui.fx || {};
      const btns = ui.screen === 'tf' ? [['✅', 'VERDADEIRO', '#16a34a'], ['❌', 'FALSO', '#dc2626']] : [['⬆️', 'MAIOR', '#2563eb'], ['⬇️', 'MENOR', '#ea580c']];
      main.innerHTML = `<div class="pq"><div class="pq-h"><span>${ui.screen === 'tf' ? '✅ V ou F Relâmpago' : '↕️ Mais ou Menos'} · ${ui.n}/${ui.tot}</span></div>
        <div class="pq-q">${esc(ui.q)}</div>
        ${ui.screen === 'tf' ? `<div class="tfans">${esc(ui.a)}</div>` : `<div class="tfans">O Monc diz: <b>${esc(ui.num)}</b> ${esc(ui.unit || '')}<small>A resposta certa é maior ou menor?</small></div>`}${timerHTML()}
        <div class="pq-opts two">${btns.map(([e, l, c], i) => `<button class="pqo big2" data-i="${i}" style="--oc:${c}"><span class="pqs">${e}</span><span>${l}</span></button>`).join('')}</div>${fxTips(fx)}</div>`;
      main.querySelectorAll('.pqo').forEach(b => b.onclick = () => { lock(); b.classList.add('chosen'); act({ i: +b.dataset.i }); });
      startTimerBar();
      if (fx.freeze) main.querySelectorAll('.pqo').forEach((b, i) => addIce(b, 'b' + i, fx.freeze));
      if (fx.ink) addInk($('.pq-opts'), fx.inkC, 4);
      break;
    }
    case 'num': {
      let val = '';
      const fx = ui.fx || {};
      main.innerHTML = `<div class="pq"><div class="pq-h"><span>${esc(ui.dyn)} · ${ui.n}/${ui.tot}</span></div><div class="pq-q">${esc(ui.q)}</div>${timerHTML()}
        <div class="numdisp"><span id="nv">—</span> <small>${esc(ui.unit || '')}</small></div>
        <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, 'OK'].map(k => `<button class="key ${k === 'OK' ? 'ok' : ''}" data-k="${k}">${k}</button>`).join('')}</div>${fxTips({ ink: fx.ink, freeze: fx.freeze })}</div>`;
      main.querySelector('.keypad').onclick = e => {
        const b = e.target.closest('.key'); if (!b || b.disabled) return;
        const k = b.dataset.k;
        if (k === '⌫') val = val.slice(0, -1);
        else if (k === 'OK') { if (!val) return; lock(); act({ v: Number(val) }); $('#nv').textContent = fmt(Number(val)) + ' ✓'; return; }
        else if (val.length < 7) val = (val + k).replace(/^0+(?=\d)/, '');
        $('#nv').textContent = val ? fmt(Number(val)) : '—';
      };
      startTimerBar();
      if (fx.freeze) addIce($('.keypad'), 'k', fx.freeze);
      if (fx.ink) addInk($('.keypad'), fx.inkC, 5);
      break;
    }
    case 'clock':
      runClock(ui);
      break;
    case 'res':
      main.innerHTML = `<div class="pres ${ui.ok ? 'ok' : 'bad'}"><div class="pr-m">${esc(ui.msg)}</div><div class="pr-s">${esc(ui.sub || '')}</div>${ui.skip ? timerHTML() : ''}${skipBtn}</div>`;
      try { navigator.vibrate && navigator.vibrate(ui.ok ? 60 : [80, 50, 80]); } catch (e) { }
      bindSkip(); if (ui.skip) startTimerBar();
      break;
    case 'final':
      main.innerHTML = `<div class="pres final ${ui.place === 1 ? 'ok' : ''}"><div class="pr-big">${ui.place === 1 ? '🏆' : ui.place <= 3 ? ['', '', '🥈', '🥉'][ui.place] : '🎉'}</div><div class="pr-m">${esc(ui.msg)}</div><div class="pr-s">${MIC} ${mics(ui.stars)} · ${COIN} ${mc(ui.coins)}</div><div class="pr-s">Valeu por participar do Monc's Show!</div></div>`;
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
  try { const s = JSON.parse(localStorage.getItem('qp_tv') || 'null'); if (s && Date.now() - s.ts < 6 * 3600e3 && s.G && s.G.phase !== 'lobby' && !s.G.online) saved = s.G; } catch (e) { }
  document.body.innerHTML = `<div class="pjoin homebox">
    <div class="plogo">MONC'S<br>SHOW<span class="onair sm"><span class="rec"></span>AO VIVO</span></div>
    <div class="psub">O programa de auditório de tabuleiro + quiz, para até 8 pessoas.<br>A TV mostra o show, cada um joga no celular.</div>
    <button class="pbig" id="tvbtn">📺 Abrir como TV (criar sala)</button>
    ${saved ? `<button class="pbig alt" id="resbtn">🔄 Continuar partida ${esc(saved.room)} (turno ${saved.turn})</button>` : ''}
    <div class="or">— ou —</div>
    <label class="plabel">Código da sala</label>
    <input id="code" maxlength="4" placeholder="ABCD" autocomplete="off" style="text-transform:uppercase;text-align:center;letter-spacing:.3em;font-size:28px">
    <button class="pbig alt" id="joinbtn">📱 Entrar pelo celular</button>
    <div class="or">— ou —</div>
    <button class="pbig online" id="onlinebtn">💻 Jogar online (cada um no seu computador)</button>
  </div>`;
  const keep = (LOCAL ? '&local' : '') + (FAST ? '&fast' : '');
  $('#tvbtn').onclick = () => { location.search = '?tv' + keep; };
  if (saved) $('#resbtn').onclick = () => { location.search = '?tv&resume' + keep; };
  $('#joinbtn').onclick = () => { const c = $('#code').value.trim().toUpperCase(); if (c.length === 4) location.search = '?sala=' + c + keep; };
  $('#onlinebtn').onclick = () => { location.search = '?online' + keep; };
}

window.addEventListener('DOMContentLoaded', () => {
  if (ONLINE) {
    if (PARAMS.has('host')) {
      let resume = null;
      if (PARAMS.has('resume')) { try { const s = JSON.parse(localStorage.getItem('qp_tv') || 'null'); if (s && s.G && s.G.online) resume = s.G; } catch (e) { } }
      onlineHostMain(resume);
    } else if (PARAMS.has('sala')) onlineClientMain(PARAMS.get('sala'));
    else onlineHomeMain();
    return;
  }
  if (PARAMS.has('sala')) phoneMain(PARAMS.get('sala'));
  else if (PARAMS.has('tv')) {
    let resume = null;
    if (PARAMS.has('resume')) { try { const s = JSON.parse(localStorage.getItem('qp_tv') || 'null'); if (s && s.G) resume = s.G; } catch (e) { } }
    tvMain(resume);
  } else homeMain();
});
