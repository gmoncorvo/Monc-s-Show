'use strict';
/* =========================================================================
   MODO ONLINE — cada jogador no seu computador
   O anfitrião roda o jogo (igual à TV) e transmite a própria tela para os
   outros: as partes que mudam (tabuleiro, quiz, placar, apresentador) vão
   como HTML e cada computador aplica só a diferença; animações, sons e voz
   vão como eventos e cada computador reproduz localmente.
   ========================================================================= */
const MIRROR = { host: false, client: false, seq: 0, last: {}, timer: null, lastFull: 0, fullTimer: null, q: [] };
const MROOTS = ['lobby', 'turninfo', 'roomtag', 'plist', 'dicebox', 'ov', 'bubble', 'hl', 'traps', 'bankpot', 'starG', 'brG', 'prevG', 'tokens', 'stepsG'];

/* ---------- anfitrião ---------- */
// eventos (sons, voz, animações) vão agrupados na próxima atualização da tela: menos mensagens
function mFx(k, a) { if (!MIRROR.host || !net) return; MIRROR.q.push([k, a]); mSchedule(); }

function mSerialize(id) {
  const el = document.getElementById(id); if (!el) return null;
  let h = el.outerHTML;
  // o dado "girando" troca de número a cada 90 ms: cada computador gira o seu
  if (id === 'dicebox') h = h.replace(/(<div class="die rolling">)[^<]*(<\/div>)/g, '$1?$2');
  return h;
}
function mFlush(full) {
  clearTimeout(MIRROR.timer); MIRROR.timer = null;
  if (!MIRROR.host || !net) return;
  const roots = {}; let any = false;
  for (const id of MROOTS) {
    const h = mSerialize(id); if (h == null) continue;
    if (full || MIRROR.last[id] !== h) { roots[id] = h; MIRROR.last[id] = h; any = true; }
  }
  const mode = $('#stage').className, hc = ($('#host') || {}).className || '';
  const fx = MIRROR.q; MIRROR.q = [];
  if (!full && !any && !fx.length && mode === MIRROR.last._mode && hc === MIRROR.last._hc) return;
  MIRROR.last._mode = mode; MIRROR.last._hc = hc;
  net.send({ t: 'm', seq: ++MIRROR.seq, full: !!full, map: MAP_ID, mode, hc, roots, fx });
}
function mSchedule() { if (!MIRROR.timer) MIRROR.timer = setTimeout(() => mFlush(false), 100); }
function mFullReq() {
  if (!MIRROR.host) return;
  const wait = 400 - (Date.now() - MIRROR.lastFull);
  if (wait > 0) { if (!MIRROR.fullTimer) MIRROR.fullTimer = setTimeout(() => { MIRROR.fullTimer = null; mFullReq(); }, wait); return; }
  MIRROR.lastFull = Date.now(); mFlush(true);
}
function mirrorHostStart() {
  MIRROR.host = true;
  const fx = $('#fx');
  new MutationObserver(recs => { for (const r of recs) if (!fx.contains(r.target)) { mSchedule(); return; } })
    .observe($('#stage'), { subtree: true, childList: true, attributes: true, characterData: true });
  // sons do anfitrião tocam em todos os computadores
  SFX._o = {};
  ['step', 'coin', 'lose', 'dice', 'pop', 'ok', 'bad', 'tick', 'fanfare', 'evil', 'whoosh'].forEach(n => {
    const o = SFX[n]; SFX._o[n] = o;
    SFX[n] = function (...a) { mFx('sfx', [n]); return o.apply(this, a); };
  });
}

/* ---------- convidados ---------- */
function mReq() { if (PH.net) PH.net.send({ t: 'mreq', pid: PH.pid }); }

function mParse(live, html) {
  const tpl = document.createElement('template');
  if (live instanceof SVGElement && !(live instanceof SVGSVGElement)) {
    tpl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${html}</svg>`;
    return tpl.content.firstChild && tpl.content.firstChild.firstElementChild;
  }
  tpl.innerHTML = html;
  return tpl.content.firstElementChild;
}
const keepsStyle = el => el.nodeType === 1 && (el.getAttribute('data-keep') || '').includes('style');
function mPrep(n) {   // elemento novo: tira o estilo que cada computador controla sozinho
  if (n.nodeType === 1) [n, ...n.querySelectorAll('[data-keep]')].forEach(e => { if (keepsStyle(e)) e.removeAttribute('style'); });
  return n;
}
// aplica em `a` (na tela) as diferenças de `b` (recebido), preservando os elementos
// que já existem — assim as animações e transições continuam rodando
function morph(a, b) {
  if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) { a.replaceWith(mPrep(b)); return; }
  if (a.nodeType !== 1) { if (a.data !== b.data) a.data = b.data; return; }
  const ks = keepsStyle(a);
  for (const at of [...a.attributes]) if (!b.hasAttribute(at.name) && !(ks && at.name === 'style')) a.removeAttribute(at.name);
  for (const at of [...b.attributes]) { if (ks && at.name === 'style') continue; if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value); }
  const key = n => (n.nodeType === 1 ? n.getAttribute('data-p') || n.id || null : null);
  const oldC = [...a.childNodes], newC = [...b.childNodes];
  const keyed = new Map(); oldC.forEach(n => { const k = key(n); if (k) keyed.set(k, n); });
  const free = oldC.filter(n => !key(n)); let fi = 0;
  newC.forEach((nb, i) => {
    const k = key(nb); let na = null;
    if (k) na = keyed.get(k) || null;
    else if (fi < free.length && free[fi].nodeType === nb.nodeType && free[fi].nodeName === nb.nodeName) na = free[fi++];
    const ref = a.childNodes[i] || null;
    if (na) { if (na !== ref) a.insertBefore(na, ref); morph(na, nb); }
    else a.insertBefore(mPrep(nb), ref);
  });
  while (a.childNodes.length > newC.length) a.removeChild(a.lastChild);
}

function onMirror(m) {
  if (m.map && m.map !== MAP_ID) { loadMap(m.map); buildBoardSVG(); if (!m.full) mReq(); }
  if (!m.full && MIRROR.seq && m.seq !== MIRROR.seq + 1) mReq();   // perdeu alguma atualização
  MIRROR.seq = m.seq;
  if (m.mode) $('#stage').className = m.mode;
  const he = $('#host'); if (he && m.hc != null) he.className = m.hc;
  for (const [id, html] of Object.entries(m.roots || {})) {
    const el = document.getElementById(id); if (!el) continue;
    const before = id === 'bubble' ? el.textContent : null;
    const nb = mParse(el, html); if (!nb) continue;
    morph(el, nb);
    if (id === 'bubble' && el.textContent !== before) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  }
  (m.fx || []).forEach(([k, a]) => onFx({ k, a }));
}

function clientSpeak(text) {
  if (FAST || Voice.muted || !('speechSynthesis' in window) || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR'; if (Voice.voice) u.voice = Voice.voice; u.rate = 1.08; u.pitch = 1.05;
    speechSynthesis.speak(u);
  } catch (e) { }
}
const FXH = {
  coinFlight: (from, to, count) => coinFlight(from, to, count),
  burst: (xy, chars, n, spread, cls) => burst(xy, chars, n, spread, cls),
  flash: (xy, cls) => flash(xy, cls),
  floatAt: (x, y, text, color) => floatAt(x, y, text, color),
  arc: moves => arcTokens(moves.map(m => ({ p: { id: m.id }, from: m.from, to: m.to }))),
  sfx: n => { if (typeof SFX[n] === 'function') SFX[n](); },
  say: text => clientSpeak(text),
  wheel: (final, dur) => {
    let tries = 0;
    const go = () => {
      const g = $('#wheelG');
      if (!g) { if (tries++ < 60) setTimeout(go, 50); return; }
      g.style.transition = 'none'; g.style.transform = 'rotate(0deg)'; void g.getBoundingClientRect();
      requestAnimationFrame(() => requestAnimationFrame(() => { g.style.transition = `transform ${dur}ms cubic-bezier(.12,.75,.12,1)`; g.style.transform = `rotate(${final}deg)`; }));
    };
    go();
  },
};
function onFx(m) { const h = FXH[m.k]; if (h) try { h(...(m.a || [])); } catch (e) { console.warn('fx', m.k, e); } }

/* ---------- telas do modo online ---------- */
function onlineShell(isHost) {
  document.body.className = 'online ' + (isHost ? 'host' : 'client');
  document.body.innerHTML = `<div id="stagebox"></div>
    <aside id="opanel">
      <div class="ohead"><span class="ologo">⭐ MONC'S SHOW <small>online</small></span>
        <span><button id="ovoice" class="mini" title="Voz do apresentador">🔊</button><button id="osfx" class="mini" title="Efeitos sonoros">🎵</button></span></div>
      <div id="pbar"></div><div id="pmain"></div>
    </aside>
    <div id="soundgate"><div class="sg-box"><div class="sg-e">🔊</div><div class="sg-t">Clique para entrar no show</div><div class="sg-s">O navegador só libera o som e a voz do apresentador depois de um clique.</div></div></div>`;
  $('#ovoice').onclick = () => { Voice.muted = !Voice.muted; $('#ovoice').textContent = Voice.muted ? '🔇' : '🔊'; if (Voice.muted) try { speechSynthesis.cancel(); } catch (e) { } };
  $('#osfx').onclick = () => { SFX.on = !SFX.on; $('#osfx').style.opacity = SFX.on ? 1 : 0.4; };
  $('#soundgate').onclick = () => {
    SFX.init();
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { }
    $('#soundgate').remove();
  };
  if (FAST) $('#soundgate').remove();
  const ro = new ResizeObserver(() => fitStage()); ro.observe($('#stagebox'));
}

function onlineHostMain(resume) {
  onlineShell(true);
  tvMain(resume, { container: $('#stagebox'), online: true });
  mirrorHostStart();
  phoneCore(G.room, { local: true });
  requestAnimationFrame(fitStage);
}

function onlineClientMain(room) {
  onlineShell(false);
  buildTV($('#stagebox'));
  Voice.init();
  MIRROR.client = true;
  // o dado girando é animado localmente
  setInterval(() => document.querySelectorAll('#dicebox .die.rolling').forEach(d => { d.textContent = 1 + rnd(10); }), 90);
  phoneCore(room, { online: true, onMsg: m => { if (m.t === 'm') onMirror(m); else if (m.t === 'fx') onFx(m); }, onConnect: mReq });
  requestAnimationFrame(fitStage);
}

function onlineHomeMain() {
  document.body.className = 'phone home';
  const ls = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  let saved = null;
  try { const s = JSON.parse(ls('qp_tv') || 'null'); if (s && Date.now() - s.ts < 6 * 3600e3 && s.G && s.G.online && s.G.phase !== 'lobby') saved = s.G; } catch (e) { }
  let emoji = ls('qp_emoji' + LSX) || pick(AVATARS);
  document.body.innerHTML = `<div class="pjoin homebox onlinehome">
    <div class="plogo">⭐ MONC'S<br>SHOW</div>
    <div class="psub">💻 <b>Modo online</b>: cada um joga no seu computador e todos veem o mesmo tabuleiro.<br>Dica: abram uma chamada no Discord para conversar.</div>
    <label class="plabel">Seu nome</label>
    <input id="nm" maxlength="14" placeholder="Digite seu nome" value="${esc(ls('qp_name' + LSX) || '')}" autocomplete="off">
    <label class="plabel">Escolha seu personagem</label>
    <div id="avs" class="avs">${AVATARS.map(a => `<button class="av ${a === emoji ? 'sel' : ''}" data-a="${a}">${a}</button>`).join('')}</div>
    <button class="pbig" id="hostbtn">🎬 Criar sala (sou o anfitrião)</button>
    ${saved ? `<button class="pbig alt" id="resbtn">🔄 Continuar partida ${esc(saved.room)} (turno ${saved.turn})</button>` : ''}
    <div class="or">— ou —</div>
    <label class="plabel">Código da sala</label>
    <input id="code" maxlength="4" placeholder="ABCD" autocomplete="off" style="text-transform:uppercase;text-align:center;letter-spacing:.3em;font-size:28px">
    <button class="pbig alt" id="joinbtn">🚪 Entrar na sala</button>
    <a class="backlink" id="backlink" href="#">← Voltar para o modo TV + celular</a>
  </div>`;
  const keep = (LOCAL ? '&local' : '') + (FAST ? '&fast' : '') + (LSX ? '&p=' + LSX : '');
  $('#avs').onclick = e => { const b = e.target.closest('.av'); if (!b) return; emoji = b.dataset.a; $('#avs').querySelectorAll('.av').forEach(x => x.classList.toggle('sel', x === b)); };
  const saveMe = () => {
    const n = $('#nm').value.trim();
    if (!n) { $('#nm').focus(); $('#nm').classList.add('shake'); setTimeout(() => $('#nm').classList.remove('shake'), 500); return false; }
    try { localStorage.setItem('qp_name' + LSX, n.slice(0, 14)); localStorage.setItem('qp_emoji' + LSX, emoji); } catch (e) { }
    return true;
  };
  $('#hostbtn').onclick = () => { if (saveMe()) location.search = '?online&host' + keep; };
  if (saved) $('#resbtn').onclick = () => { location.search = '?online&host&resume' + keep; };
  $('#joinbtn').onclick = () => {
    const c = $('#code').value.trim().toUpperCase();
    if (c.length !== 4) { $('#code').focus(); return; }
    if (!saveMe()) return;
    try { localStorage.setItem('qp_joined_' + LSX + c, '1'); } catch (e) { }
    location.search = '?online&sala=' + c + keep;
  };
  $('#backlink').onclick = e => { e.preventDefault(); location.search = (LOCAL ? '?local' : '') + (FAST ? (LOCAL ? '&fast' : '?fast') : ''); };
}
