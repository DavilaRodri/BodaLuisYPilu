/* Plano de mesas: mesas de cualquier forma y tamaño, arrastrar invitados a sus
   sillas, mover y bloquear mesas, plano del salón de fondo. Todo se guarda al momento. */
(function () {
  const P = window.PANEL, S = P.S;
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = $('svg'), world = $('world'), gT = $('tables'), canvas = $('canvas');
  const SEAT = 22;
  const FORMAS = [
    ['redonda', 'Redonda', '<ellipse cx="17" cy="13" rx="10" ry="10"/>'],
    ['ovalada', 'Ovalada', '<ellipse cx="17" cy="13" rx="15" ry="8"/>'],
    ['cuadrada', 'Cuadrada', '<rect x="7" y="3" width="20" height="20" rx="2"/>'],
    ['rectangular', 'Alargada', '<rect x="1" y="7" width="32" height="12" rx="2"/>']
  ];
  const CAPS = [2, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24];

  let vista = { k: 0.3, x: 0, y: 0 }, ajustada = false;
  let sel = null, picked = null, nombres = false;
  try { nombres = localStorage.getItem('boda-nombres') === '1'; } catch (e) {}

  // ---------- Geometría ----------
  // Devuelve la forma de la mesa y las sillas en coordenadas locales (sin girar)
  function geo(m) {
    const cap = m.capacidad, sillas = [];
    if (m.forma === 'redonda' || m.forma === 'ovalada') {
      const ring = Math.max(96, cap * 72 / (2 * Math.PI));
      const sx = m.forma === 'ovalada' ? 1.45 : 1, sy = m.forma === 'ovalada' ? 0.72 : 1;
      const rx = ring * sx, ry = Math.max(ring * sy, 100);
      // repartir por longitud de arco para que en la ovalada queden equidistantes
      const N = 360, pts = [], acc = [0];
      for (let i = 0; i <= N; i++) { const a = -Math.PI / 2 + i / N * 2 * Math.PI; pts.push([rx * Math.cos(a), ry * Math.sin(a)]); if (i) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); }
      const L = acc[N];
      for (let k = 0, j = 0; k < cap; k++) { const t = k / cap * L; while (acc[j + 1] < t) j++; sillas.push({ x: pts[j][0], y: pts[j][1] }); }
      return { tipo: 'ellipse', rx: rx - 36, ry: ry - 36, sillas, ext: Math.max(rx, ry) + SEAT };
    }
    if (m.forma === 'cuadrada') {
      const por = Math.ceil(cap / 4), lado = Math.max(110, por * 68), h = lado / 2, d = h + 32;
      const lados = [0, 0, 0, 0]; for (let k = 0; k < cap; k++) lados[k % 4]++;
      const pos = (n, i) => -h + (lado / n) * (i + 0.5);
      for (let i = 0; i < lados[0]; i++) sillas.push({ x: pos(lados[0], i), y: -d });
      for (let i = 0; i < lados[1]; i++) sillas.push({ x: d, y: pos(lados[1], i) });
      for (let i = 0; i < lados[2]; i++) sillas.push({ x: -pos(lados[2], i), y: d });
      for (let i = 0; i < lados[3]; i++) sillas.push({ x: -d, y: -pos(lados[3], i) });
      return { tipo: 'rect', w: lado, h: lado, sillas, ext: d + SEAT };
    }
    // alargada (presidencial: todos mirando al salón)
    if (m.presidencial) {
      const w = Math.max(140, cap * 68), H = 116;
      for (let i = 0; i < cap; i++) sillas.push({ x: -w / 2 + (w / cap) * (i + 0.5), y: -H / 2 - 32 });
      return { tipo: 'rect', w, h: H, sillas, ext: w / 2 + SEAT };
    }
    const arriba = Math.ceil(cap / 2), abajo = cap - arriba, w = Math.max(130, arriba * 68), H = 116;
    for (let i = 0; i < arriba; i++) sillas.push({ x: -w / 2 + (w / arriba) * (i + 0.5), y: -H / 2 - 32 });
    for (let i = 0; i < abajo; i++) sillas.push({ x: w / 2 - (w / Math.max(abajo, 1)) * (i + 0.5) - (arriba > abajo ? w / arriba / 2 : 0), y: H / 2 + 32 });
    return { tipo: 'rect', w, h: H, sillas, ext: w / 2 + SEAT };
  }
  const girar = (p, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }; };
  P.geo = geo; P.girar = girar;

  const el = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
  const sentados = m => S.invitados.filter(i => i.mesa_id === m.id && i.asiste === 'si');
  const libre = (m, excepto) => { const ocup = new Set(sentados(m).filter(i => i !== excepto).map(i => i.asiento)); for (let k = 0; k < m.capacidad; k++) if (!ocup.has(k)) return k; return -1; };

  // ---------- Pintar ----------
  function pintar() {
    if (!S.boda) return;
    const W = S.boda.sala_ancho, H = S.boda.sala_alto;
    ['floor', 'floorEdge'].forEach(id => { $(id).setAttribute('width', W); $(id).setAttribute('height', H); });
    const f = $('fondo');
    if (S.boda.plano_url) { f.setAttribute('href', S.boda.plano_url); f.setAttribute('width', W); f.setAttribute('height', H); f.style.display = ''; }
    else f.style.display = 'none';
    gT.textContent = '';
    S.mesas.forEach(m => mesaSVG(m));
    $('planEmpty').hidden = S.mesas.length > 0;
    lado();
    stats();
    if (sel) panel();
  }

  function mesaSVG(m) {
    const g = geo(m), ps = sentados(m);
    const porSilla = {}; ps.forEach(i => { if (i.asiento != null) porSilla[i.asiento] = i; });
    // quien no tenga silla asignada ocupa la primera libre (solo para dibujar)
    ps.filter(i => i.asiento == null || i.asiento >= m.capacidad).forEach(i => { for (let k = 0; k < m.capacidad; k++) if (!porSilla[k]) { porSilla[k] = i; break; } });
    const full = ps.length >= m.capacidad;
    const t = el('g', { class: 't' + (m.bloqueada ? ' is-locked' : '') + (full ? ' is-full' : '') + (sel === m.id ? ' is-sel' : '') + (m.presidencial ? ' is-pres' : ''), 'data-mesa': m.id, transform: `translate(${m.x} ${m.y})` }, gT);
    const top = g.tipo === 'ellipse'
      ? el('ellipse', { class: 't__top', rx: g.rx, ry: g.ry, transform: `rotate(${m.rot})` }, t)
      : el('rect', { class: 't__top', x: -g.w / 2, y: -g.h / 2, width: g.w, height: g.h, rx: 10, transform: `rotate(${m.rot})` }, t);
    top.setAttribute('data-mesa', m.id);
    g.sillas.forEach((s0, k) => {
      const s = girar(s0, m.rot), inv = porSilla[k];
      const c = el('g', { class: 'c' + (inv ? ' is-on' : ''), 'data-mesa': m.id, 'data-silla': k, transform: `translate(${s.x.toFixed(1)} ${s.y.toFixed(1)})` }, t);
      if (inv) c.setAttribute('data-inv', inv.id);
      const seat = el('circle', { class: 'c__seat', r: SEAT }, c);
      if (inv) {
        seat.style.fill = P.color(inv);
        el('text', { class: 'c__ini', y: 5.5 }, c).textContent = P.iniciales(inv.nombre);
        if (P.tieneDieta(inv) || inv.edad !== 'adulto') el('circle', { class: 'c__al', cx: 15, cy: -15, r: 7, style: inv.edad !== 'adulto' && !P.tieneDieta(inv) ? 'fill:#5f7a8c' : '' }, c);
        const len = Math.hypot(s.x, s.y) || 1, dx = s.x / len, dy = s.y / len;
        const n = el('text', { class: 'c__name' }, c);
        n.textContent = inv.nombre.split(/\s+/).slice(0, 2).join(' ');
        if (g.tipo === 'rect' && Math.abs(s0.y) > g.h / 2) {
          // filas largas: nombres en diagonal para que no se pisen
          const up = s0.y < 0 === ((m.rot % 360 + 360) % 360 < 90 || (m.rot % 360 + 360) % 360 >= 270);
          n.setAttribute('text-anchor', up ? 'start' : 'end');
          n.setAttribute('transform', `translate(${up ? 6 : -6} ${up ? -26 : 26}) rotate(-50)`);
        } else if (Math.abs(dx) < 0.3) {
          n.setAttribute('text-anchor', 'middle'); n.setAttribute('y', dy > 0 ? 44 : -32);
        } else {
          n.setAttribute('text-anchor', dx > 0 ? 'start' : 'end'); n.setAttribute('x', (dx * 30).toFixed(1)); n.setAttribute('y', (dy * 30 + 5).toFixed(1));
        }
      }
    });
    const lbl = el('g', { 'pointer-events': 'none' }, t);
    const hasName = !!m.nombre;
    el('text', { class: 't__num', y: hasName ? -6 : 4 }, lbl).textContent = m.numero ?? '·';
    if (hasName) el('text', { class: 't__name', y: 18 }, lbl).textContent = m.nombre.length > 14 ? m.nombre.slice(0, 13) + '…' : m.nombre;
    el('text', { class: 't__cnt', y: hasName ? 40 : 28 }, lbl).textContent = ps.length + '/' + m.capacidad;
    const al = ps.filter(P.tieneDieta).length;
    if (al) {
      const b = el('g', { class: 't__al', transform: `translate(${g.tipo === 'ellipse' ? g.rx * 0.62 : g.w / 2 - 18} ${g.tipo === 'ellipse' ? -g.ry * 0.62 : -g.h / 2 + 18})` }, lbl);
      el('circle', { r: 14 }, b); el('text', { y: 6 }, b).textContent = al;
    }
    if (m.bloqueada) {
      const u = el('use', { href: '#i-lock', class: 't__lock', x: -13, y: hasName ? -66 : -50, width: 26, height: 26 }, lbl);
      u.setAttribute('href', '#i-lock');
    }
  }

  function stats() {
    const v = S.invitados.filter(i => i.asiste === 'si'), s = v.filter(i => i.mesa_id).length;
    const plazas = S.mesas.reduce((a, m) => a + m.capacidad, 0);
    $('planStat').textContent = `${s} de ${v.length} sentados · ${S.mesas.length} mesas · ${plazas} plazas`;
  }

  // ---------- Lista de invitados sin mesa ----------
  function lado() {
    const q = P.norm($('buscarSide').value.trim()), gf = $('grupoSide').value;
    const sin = S.invitados.filter(i => i.asiste === 'si' && !i.mesa_id);
    $('sinMesaN').textContent = sin.length;
    const gs = $('grupoSide'), prev = gs.value;
    gs.innerHTML = '<option value="">Todos los grupos</option>' + S.grupos.map(g => `<option value="${g.id}">${P.esc(g.nombre)}</option>`).join('') + '<option value="-">Sin grupo</option>';
    gs.value = prev;
    const ord = g => { const x = S.grupos.findIndex(y => y.id === g); return x < 0 ? 999 : x; };
    const lista = sin.filter(i => (!q || P.norm(i.nombre).includes(q)) && (!gf || (gf === '-' ? !i.grupo_id : i.grupo_id === gf)))
      .sort((a, b) => ord(a.grupo_id) - ord(b.grupo_id) || a.nombre.localeCompare(b.nombre, 'es'));
    if (picked && !lista.some(i => i.id === picked)) setPicked(null);
    $('sideList').innerHTML = lista.map(i => {
      const g = P.grupo(i.grupo_id);
      const sub = [g ? g.nombre : '', i.edad === 'nino' ? 'Infantil' : i.edad === 'bebe' ? 'Trona' : '', ...(i.alergias || []).map(a => (window.ALERGIA[a] || {}).nombre), i.alergia_otra].filter(Boolean).join(' · ');
      return `<button type="button" class="gchip${picked === i.id ? ' is-picked' : ''}" data-inv="${i.id}">
        <span class="av" style="background:${P.color(i)}">${P.esc(P.iniciales(i.nombre))}</span>
        <span class="gchip__t"><span class="gchip__n">${P.esc(i.nombre)}</span>${sub ? `<span class="gchip__s">${P.esc(sub)}</span>` : ''}</span>
        ${P.tieneDieta(i) ? '<svg class="gchip__al" aria-label="Alergias"><use href="#i-alert"/></svg>' : ''}
      </button>`;
    }).join('') || `<p class="side__empty">${sin.length ? 'Nadie con este filtro.' : S.invitados.some(i => i.asiste === 'si') ? '¡Todos tienen mesa!' : 'Aún no hay invitados confirmados.'}</p>`;
  }
  $('buscarSide').addEventListener('input', lado);
  $('grupoSide').addEventListener('change', lado);
  $('sideGrab').addEventListener('click', () => {
    const c = $('side').classList.toggle('is-closed');
    $('sideGrab').setAttribute('aria-expanded', String(!c));
  });

  function setPicked(id) {
    picked = id;
    document.querySelectorAll('.gchip').forEach(b => b.classList.toggle('is-picked', b.dataset.inv === id));
    const inv = id && S.invitados.find(i => i.id === id);
    $('sideTip').textContent = inv ? `Ahora toca la mesa donde se sienta ${inv.nombre.split(' ')[0]}.` : 'Arrastra a una mesa, o tócalo y luego toca la mesa.';
    $('sideTip').classList.toggle('is-pick', !!inv);
    if (inv && window.innerWidth <= 900) { $('side').classList.add('is-closed'); $('sideGrab').setAttribute('aria-expanded', 'false'); P.toast('Toca la mesa de ' + inv.nombre.split(' ')[0]); }
  }

  // ---------- Vista: zoom y desplazamiento ----------
  function aplicar() { world.setAttribute('transform', `translate(${vista.x.toFixed(1)} ${vista.y.toFixed(1)}) scale(${vista.k.toFixed(4)})`); }
  function encajar() {
    const r = canvas.getBoundingClientRect(); if (!r.width) return;
    let x0 = 0, y0 = 0, x1 = S.boda.sala_ancho, y1 = S.boda.sala_alto;
    if (S.mesas.length && !S.boda.plano_url) {
      // sin plano de fondo, encuadrar solo las mesas
      x0 = y0 = Infinity; x1 = y1 = -Infinity;
      S.mesas.forEach(m => { const e = geo(m).ext + 90; x0 = Math.min(x0, m.x - e); y0 = Math.min(y0, m.y - e); x1 = Math.max(x1, m.x + e); y1 = Math.max(y1, m.y + e); });
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = Math.max(700, x1 - x0), h = Math.max(500, y1 - y0);
      x0 = cx - w / 2; x1 = cx + w / 2; y0 = cy - h / 2; y1 = cy + h / 2;
    }
    const bajo = window.innerWidth <= 900 ? 150 : 0;
    const k = Math.min(r.width / (x1 - x0), (r.height - bajo) / (y1 - y0)) * 0.94;
    vista = { k, x: (r.width - (x1 - x0) * k) / 2 - x0 * k, y: (r.height - bajo - (y1 - y0) * k) / 2 - y0 * k };
    aplicar();
  }
  function zoom(f, cx, cy) {
    const r = canvas.getBoundingClientRect();
    if (cx == null) { cx = r.width / 2; cy = r.height / 2; }
    const k = Math.min(4, Math.max(0.05, vista.k * f)); f = k / vista.k;
    vista.x = cx - (cx - vista.x) * f; vista.y = cy - (cy - vista.y) * f; vista.k = k; aplicar();
  }
  const aMundo = (cx, cy) => { const r = canvas.getBoundingClientRect(); return { x: (cx - r.left - vista.x) / vista.k, y: (cy - r.top - vista.y) / vista.k }; };
  $('zoomIn').addEventListener('click', () => zoom(1.3));
  $('zoomOut').addEventListener('click', () => zoom(1 / 1.3));
  $('zoomFit').addEventListener('click', encajar);
  canvas.addEventListener('wheel', e => { e.preventDefault(); const r = canvas.getBoundingClientRect(); zoom(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  $('verNombres').addEventListener('click', () => {
    nombres = !nombres; $('plan').classList.toggle('show-names', nombres); $('verNombres').setAttribute('aria-pressed', String(nombres));
    try { localStorage.setItem('boda-nombres', nombres ? '1' : '0'); } catch (e) {}
  });
  $('plan').classList.toggle('show-names', nombres); $('verNombres').setAttribute('aria-pressed', String(nombres));

  // ---------- Gestos ----------
  const ghost = $('ghost');
  const ptrs = new Map();
  let gesto = null, pinch = null;

  function destino(cx, cy) {
    const e = document.elementFromPoint(cx, cy); if (!e) return null;
    if (e.closest('#side')) return { lado: true };
    const c = e.closest('.c'); if (c) return { mesa: c.dataset.mesa, silla: +c.dataset.silla, el: c, t: c.closest('.t') };
    const t = e.closest('.t'); if (t) return { mesa: t.dataset.mesa, el: t, t };
    if (e.closest('#canvas')) return { fondo: true };
    return null;
  }
  let marcado = [];
  function marcar(d) {
    marcado.forEach(x => x.classList.remove('is-over', 'is-bad')); marcado = [];
    $('side').classList.toggle('is-drop', !!(d && d.lado && gesto && gesto.desdeMesa));
    if (!d || !d.mesa) return;
    const m = P.mesa(d.mesa), bad = m.bloqueada || (libre(m, gesto && gesto.inv) < 0);
    d.t.classList.add(bad ? 'is-bad' : 'is-over'); marcado.push(d.t);
    if (d.el !== d.t && !bad) { d.el.classList.add('is-over'); marcado.push(d.el); }
  }
  function verGhost(inv, cx, cy) {
    ghost.innerHTML = `<span class="av" style="background:${P.color(inv)}">${P.esc(P.iniciales(inv.nombre))}</span>${P.esc(inv.nombre)}`;
    ghost.hidden = false; ghost.style.left = cx + 'px'; ghost.style.top = cy + 'px';
  }

  // Lista lateral: ratón arrastra al moverse; en táctil, pulsación larga o tocar para elegir
  $('sideList').addEventListener('pointerdown', e => {
    const chip = e.target.closest('.gchip'); if (!chip || e.button > 0) return;
    const inv = S.invitados.find(i => i.id === chip.dataset.inv);
    gesto = { tipo: 'chip', inv, chip, x0: e.clientX, y0: e.clientY, id: e.pointerId, touch: e.pointerType !== 'mouse', activo: false };
    if (gesto.touch) gesto.timer = setTimeout(() => { if (gesto && gesto.chip === chip) { empezarArrastre(e.clientX, e.clientY); if (navigator.vibrate) navigator.vibrate(12); } }, 260);
  });
  function empezarArrastre(cx, cy) {
    gesto.activo = true;
    if (gesto.chip) { gesto.chip.classList.add('is-dragging'); try { gesto.chip.setPointerCapture && gesto.chip.releasePointerCapture(gesto.id); } catch (e) {} }
    if (gesto.cEl) gesto.cEl.classList.add('is-dragging');
    verGhost(gesto.inv, cx, cy);
  }
  window.addEventListener('pointermove', e => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), r = canvas.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
      zoom(d / pinch.d, mx, my); vista.x += mx - pinch.mx; vista.y += my - pinch.my; aplicar();
      pinch = { d, mx, my }; return;
    }
    if (!gesto || e.pointerId !== gesto.id) return;
    const dx = e.clientX - gesto.x0, dy = e.clientY - gesto.y0, lejos = Math.hypot(dx, dy) > 6;
    if (gesto.tipo === 'chip' || gesto.tipo === 'silla') {
      if (!gesto.activo) {
        if (gesto.touch && gesto.tipo === 'chip') { if (lejos) { clearTimeout(gesto.timer); gesto = null; } return; }
        if (!lejos) return;
        empezarArrastre(e.clientX, e.clientY);
      }
      e.preventDefault();
      ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
      marcar(destino(e.clientX, e.clientY));
    } else if (gesto.tipo === 'mesa') {
      if (!gesto.activo && !lejos) return;
      gesto.activo = true;
      const m = gesto.m;
      m.x = Math.round(gesto.mx + dx / vista.k); m.y = Math.round(gesto.my + dy / vista.k);
      gesto.el.setAttribute('transform', `translate(${m.x} ${m.y})`);
    } else if (gesto.tipo === 'pan') {
      if (!gesto.activo && !lejos) return;
      gesto.activo = true; canvas.classList.add('is-panning');
      vista.x = gesto.vx + dx; vista.y = gesto.vy + dy; aplicar();
    }
  }, { passive: false });
  // En táctil, evitar que la lista se desplace mientras se arrastra
  $('sideList').addEventListener('touchmove', e => { if (gesto && gesto.activo) e.preventDefault(); }, { passive: false });

  canvas.addEventListener('pointerdown', e => {
    if (e.button > 0 || e.target.closest('button, .plan__empty')) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      if (gesto && gesto.tipo === 'mesa' && gesto.activo) { gesto.m.x = gesto.mx; gesto.m.y = gesto.my; pintar(); }
      gesto = null; ghost.hidden = true;
      const [a, b] = [...ptrs.values()], r = canvas.getBoundingClientRect();
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top };
      return;
    }
    const c = e.target.closest('.c'), t = e.target.closest('.t');
    const base = { x0: e.clientX, y0: e.clientY, id: e.pointerId, touch: e.pointerType !== 'mouse', activo: false };
    if (c && c.dataset.inv) {
      const m = P.mesa(c.dataset.mesa);
      gesto = { ...base, tipo: m.bloqueada ? 'tap' : 'silla', inv: S.invitados.find(i => i.id === c.dataset.inv), cEl: c, desdeMesa: true, mesa: m.id, silla: +c.dataset.silla };
    } else if (t) {
      const m = P.mesa(t.dataset.mesa);
      gesto = m.bloqueada ? { ...base, tipo: 'pan', vx: vista.x, vy: vista.y, tapMesa: m.id, silla: c ? +c.dataset.silla : null }
        : { ...base, tipo: 'mesa', m, el: t, mx: m.x, my: m.y, silla: c ? +c.dataset.silla : null };
    } else {
      gesto = { ...base, tipo: 'pan', vx: vista.x, vy: vista.y };
    }
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });

  async function soltar(e) {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (!gesto || e.pointerId !== gesto.id) return;
    const g = gesto; gesto = null;
    clearTimeout(g.timer);
    canvas.classList.remove('is-panning');
    ghost.hidden = true; marcar(null);
    document.querySelectorAll('.is-dragging').forEach(x => x.classList.remove('is-dragging'));
    if (e.type === 'pointercancel') return;

    if (g.tipo === 'chip' || g.tipo === 'silla') {
      if (!g.activo) {
        if (g.tipo === 'chip') setPicked(picked === g.inv.id ? null : g.inv.id);
        else abrir(g.mesa);
        return;
      }
      const d = destino(e.clientX, e.clientY);
      if (d && d.mesa) await sentar(g.inv, d.mesa, d.silla);
      else if (g.tipo === 'silla' && d && (d.lado || d.fondo)) await sentar(g.inv, null);
      return;
    }
    if (g.tipo === 'mesa') {
      if (g.activo) {
        const m = g.m, W = S.boda.sala_ancho, H = S.boda.sala_alto;
        m.x = Math.max(0, Math.min(W, m.x)); m.y = Math.max(0, Math.min(H, m.y));
        g.el.setAttribute('transform', `translate(${m.x} ${m.y})`);
        try { await P.patch('mesas', m.id, { x: m.x, y: m.y }); } catch (err) { m.x = g.mx; m.y = g.my; pintar(); P.toast('No se ha podido mover', true); }
        return;
      }
      if (picked) { await sentar(S.invitados.find(i => i.id === picked), g.m.id, g.silla); return; }
      abrir(g.m.id); return;
    }
    if (g.tipo === 'tap') { abrir(g.mesa); return; }
    if (g.tipo === 'pan' && !g.activo) {
      if (g.tapMesa) {
        if (picked) { P.toast('La mesa está bloqueada', true); return; }
        abrir(g.tapMesa); return;
      }
      if (sel) cerrar();
    }
  }
  window.addEventListener('pointerup', soltar);
  window.addEventListener('pointercancel', soltar);

  // ---------- Sentar ----------
  async function sentar(inv, mesaId, silla) {
    if (!inv) return;
    const antes = { mesa_id: inv.mesa_id, asiento: inv.asiento };
    const origen = P.mesa(inv.mesa_id);
    if (origen && origen.bloqueada && origen.id !== mesaId) { P.toast('Su mesa está bloqueada', true); return; }
    let cambio;
    if (!mesaId) cambio = { mesa_id: null, asiento: null };
    else {
      const m = P.mesa(mesaId);
      if (m.bloqueada) { P.toast('La mesa está bloqueada', true); return; }
      const ocupada = silla != null && sentados(m).some(i => i !== inv && i.asiento === silla);
      const k = silla != null && silla < m.capacidad && !ocupada ? silla : libre(m, inv);
      if (k < 0) { P.toast('La mesa ' + (m.numero ?? '') + ' está completa', true); return; }
      if (inv.mesa_id === mesaId && inv.asiento === k) return;
      cambio = { mesa_id: mesaId, asiento: k };
    }
    Object.assign(inv, cambio);
    if (picked === inv.id) setPicked(null);
    P.changed();
    try {
      await P.patch('invitados', inv.id, cambio);
      if (cambio.mesa_id) {
        const m = P.mesa(cambio.mesa_id);
        if (window.innerWidth <= 900 && !sel && S.invitados.some(i => i.asiste === 'si' && !i.mesa_id)) { $('side').classList.remove('is-closed'); $('sideGrab').setAttribute('aria-expanded', 'true'); }
        P.toast(inv.nombre.split(' ')[0] + ' → Mesa ' + (m.numero ?? '') + (sentados(m).length >= m.capacidad ? ' (completa)' : ''));
      }
    } catch (err) {
      Object.assign(inv, antes); P.changed();
      P.toast(/complet/.test(err.message) ? 'La mesa está completa' : /bloque/.test(err.message) ? 'La mesa está bloqueada' : 'No se ha podido guardar', true);
    }
  }

  // ---------- Panel de mesa ----------
  function formas(box, val) {
    box.innerHTML = FORMAS.map(([k, t, s]) => `<button type="button" data-v="${k}" class="${k === val ? 'is-on' : ''}"><svg viewBox="0 0 34 26"><g fill="none" stroke="currentColor" stroke-width="1.8">${s}</g></svg>${t}</button>`).join('');
  }
  function abrir(id) {
    sel = id; $('drawer').hidden = false; panel(); pintar();
    // que el toque que lo abre no deje el foco en un campo (en el móvil abriría el teclado)
    setTimeout(() => { const a = document.activeElement; if (a && $('drawer').contains(a) && a.tagName === 'INPUT') a.blur(); }, 400);
  }
  function cerrar() { sel = null; $('drawer').hidden = true; pintar(); }
  P.abrirMesa = abrir;
  $('dClose').addEventListener('click', cerrar);
  function panel() {
    const m = P.mesa(sel); if (!m) { cerrar(); return; }
    $('dKicker').textContent = m.presidencial ? 'Mesa presidencial' : 'Mesa';
    $('dTitle').textContent = (m.numero != null ? 'Mesa ' + m.numero : 'Mesa') + (m.nombre ? ' · ' + m.nombre : '');
    if (document.activeElement !== $('dNum')) $('dNum').value = m.numero ?? '';
    if (document.activeElement !== $('dNombre')) $('dNombre').value = m.nombre || '';
    formas($('dForma'), m.forma);
    $('dCap').textContent = m.capacidad;
    $('dPres').checked = m.presidencial;
    $('dPres').closest('.switch').hidden = false;
    const L = $('dLock');
    L.classList.toggle('is-on', m.bloqueada);
    L.innerHTML = `<svg><use href="#i-${m.bloqueada ? 'lock' : 'unlock'}"/></svg><span>${m.bloqueada ? 'Mesa bloqueada · tocar para desbloquear' : 'Bloquear mesa'}</span>`;
    ['dNum', 'dNombre', 'dMenos', 'dMas', 'dRot', 'dPres', 'dDel'].forEach(id => { $(id).disabled = m.bloqueada; });
    $('dForma').querySelectorAll('button').forEach(b => { b.disabled = m.bloqueada; });
    const ps = sentados(m).slice().sort((a, b) => (a.asiento ?? 99) - (b.asiento ?? 99));
    $('dCount').textContent = ps.length + '/' + m.capacidad;
    $('dList').innerHTML = ps.map(i => `<li data-inv="${i.id}">
      <span class="av" style="background:${P.color(i)}">${P.esc(P.iniciales(i.nombre))}</span>
      <span class="gchip__t"><span class="gchip__n">${P.esc(i.nombre)}</span>${P.alTags(i) ? `<span class="al">${P.alTags(i)}</span>` : ''}</span>
      ${m.bloqueada ? '' : `<button class="ibtn" type="button" data-quitar aria-label="Levantar de la mesa"><svg><use href="#i-x"/></svg></button>`}
    </li>`).join('') + (ps.length < m.capacidad ? `<li class="is-free">${m.capacidad - ps.length} ${m.capacidad - ps.length === 1 ? 'sitio libre' : 'sitios libres'}</li>` : '');
  }
  async function guardarMesa(m, cambio, txt) {
    const antes = {}; for (const k in cambio) antes[k] = m[k];
    Object.assign(m, cambio); pintar();
    try { await P.patch('mesas', m.id, cambio); if (txt) P.toast(txt); }
    catch (err) { Object.assign(m, antes); pintar(); P.toast('No se ha podido guardar', true); }
  }
  $('dNum').addEventListener('change', e => { const m = P.mesa(sel); const v = parseInt(e.target.value, 10); guardarMesa(m, { numero: isNaN(v) ? null : v }); });
  $('dNombre').addEventListener('change', e => { const m = P.mesa(sel); guardarMesa(m, { nombre: e.target.value.trim() || null }); });
  $('dForma').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; const m = P.mesa(sel); guardarMesa(m, { forma: b.dataset.v }); });
  $('dRot').addEventListener('click', () => { const m = P.mesa(sel); guardarMesa(m, { rot: ((m.rot || 0) + 45) % 360 }); });
  $('dPres').addEventListener('change', e => { const m = P.mesa(sel); guardarMesa(m, { presidencial: e.target.checked }); });
  async function capacidad(delta) {
    const m = P.mesa(sel), nueva = Math.max(1, Math.min(60, m.capacidad + delta)), ps = sentados(m);
    if (nueva < ps.length) { P.toast('Hay ' + ps.length + ' personas sentadas. Levanta a alguien antes.', true); return; }
    // quien se quede fuera de las sillas que existen pasa a una libre
    const fuera = ps.filter(i => i.asiento != null && i.asiento >= nueva);
    await guardarMesa(m, { capacidad: nueva });
    for (const i of fuera) {
      const ocup = new Set(sentados(m).filter(x => x !== i).map(x => x.asiento));
      let k = 0; while (ocup.has(k)) k++;
      i.asiento = k; try { await P.patch('invitados', i.id, { asiento: k }); } catch (err) {}
    }
    if (fuera.length) pintar();
  }
  $('dMenos').addEventListener('click', () => capacidad(-1));
  $('dMas').addEventListener('click', () => capacidad(1));
  $('dLock').addEventListener('click', () => { const m = P.mesa(sel); guardarMesa(m, { bloqueada: !m.bloqueada }, m.bloqueada ? 'Mesa desbloqueada' : 'Mesa bloqueada'); });
  $('dList').addEventListener('click', e => {
    const li = e.target.closest('li[data-inv]'); if (!li) return;
    const inv = S.invitados.find(i => i.id === li.dataset.inv);
    if (e.target.closest('[data-quitar]')) sentar(inv, null); else P.editar(inv);
  });
  $('dDel').addEventListener('click', async () => {
    const m = P.mesa(sel), n = sentados(m).length;
    if (!confirm(`¿Borrar la mesa ${m.numero ?? ''}?` + (n ? `\n\nLas ${n} personas sentadas volverán a la lista.` : ''))) return;
    try {
      await P.del('mesas', m.id);
      S.mesas = S.mesas.filter(x => x !== m);
      S.invitados.forEach(i => { if (i.mesa_id === m.id) { i.mesa_id = null; i.asiento = null; } });
      cerrar(); P.changed(); P.toast('Mesa borrada');
    } catch (err) { P.toast('No se ha podido borrar', true); }
  });

  // ---------- Nueva mesa ----------
  let nueva = { forma: 'redonda', capacidad: 10 };
  function dlgMesa() {
    formas($('mForma'), nueva.forma);
    $('mCap').innerHTML = CAPS.map(c => `<button type="button" data-v="${c}" class="${c === nueva.capacidad ? 'is-on' : ''}">${c}</button>`).join('');
    $('mNombre').value = '';
    $('mDlg').showModal();
  }
  $('addMesa').addEventListener('click', dlgMesa);
  $('addMesa2').addEventListener('click', dlgMesa);
  $('mForma').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; nueva.forma = b.dataset.v; formas($('mForma'), nueva.forma); });
  $('mCap').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; nueva.capacidad = +b.dataset.v; $('mCap').querySelectorAll('button').forEach(x => x.classList.toggle('is-on', x === b)); });
  $('mForm').addEventListener('submit', async e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const c = aMundo(r.left + r.width / 2, r.top + (r.height - (window.innerWidth <= 900 ? 150 : 0)) / 2);
    const base = { ...nueva, rot: 0, presidencial: false }, ext = geo(base).ext;
    // buscar un hueco libre en espiral alrededor del centro de la vista
    const ocupado = (x, y) => S.mesas.some(m => Math.hypot(m.x - x, m.y - y) < geo(m).ext + ext + 20);
    let pos = { x: c.x, y: c.y };
    outer: for (let rad = 0; rad < 3000; rad += 60) for (let a = 0; a < 360; a += rad ? Math.max(10, 3600 / rad) : 360) {
      const x = c.x + rad * Math.cos(a * Math.PI / 180), y = c.y + rad * Math.sin(a * Math.PI / 180);
      if (x < ext || y < ext || x > S.boda.sala_ancho - ext || y > S.boda.sala_alto - ext) continue;
      if (!ocupado(x, y)) { pos = { x, y }; break outer; }
    }
    const num = S.mesas.reduce((a, m) => Math.max(a, m.numero || 0), 0) + 1;
    try {
      const m = await P.insert('mesas', { boda_id: S.boda.id, numero: num, nombre: $('mNombre').value.trim() || null, forma: nueva.forma, capacidad: nueva.capacidad, x: Math.round(pos.x), y: Math.round(pos.y) });
      S.mesas.push(m); $('mDlg').close(); P.changed(); P.toast('Mesa ' + num + ' añadida');
    } catch (err) { P.toast('No se ha podido crear la mesa', true); }
  });

  // En táctil, que el toque que abre el panel no active lo que quede debajo
  canvas.addEventListener('touchend', e => { if (!e.target.closest('button')) e.preventDefault(); }, { passive: false });
  if (window.innerWidth <= 900) { $('side').classList.add('is-closed'); $('sideGrab').setAttribute('aria-expanded', 'false'); }

  // ---------- Integración ----------
  P.onChange.push(() => { if (!$('v-mesas').hidden) pintar(); });
  window.MESAS = {
    mostrar() {
      pintar();
      requestAnimationFrame(() => { if (!ajustada) { encajar(); ajustada = true; } else aplicar(); });
    }
  };
  window.addEventListener('resize', () => { if (!$('v-mesas').hidden) encajar(); });
  $('pdf').addEventListener('click', () => { if (window.PDF) window.PDF.generar(); else P.toast('Un momento, se está preparando.'); });
})();
