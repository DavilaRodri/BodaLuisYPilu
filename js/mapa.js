/* Mapa de autobuses: el autobús sale de la parada elegida, va a la iglesia,
   después a la finca y vuelve. Posiciones aproximadas a la geografía real. */
(function () {
  const fig = document.getElementById('busmap');
  if (!fig) return;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = fig.querySelector('svg');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const PARADAS = {
    navalmoral: { x: 225, y: 93, name: 'Navalmoral de la Mata', lx: 0, ly: -14, anchor: 'middle' },
    castanar: { x: 364, y: 352, name: 'Castañar de Ibor', lx: 0, ly: 20, anchor: 'middle' }
  };
  const IGLESIA = { x: 317, y: 135, name: 'Iglesia', sub: 'Peraleda de la Mata', lx: 12, ly: 0, anchor: 'start' };
  const FINCA = { x: 262, y: 168, name: 'Finca Valmojado', sub: 'Valdehúncar', lx: 0, ly: 22, anchor: 'middle' };

  // Curva suave entre dos puntos, combada hacia un lado
  function curva(a, b, bend) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const cx = mx - dy * bend, cy = my + dx * bend;
    return `Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x} ${b.y}`;
  }
  function tramos(p) {
    return [
      `M${p.x} ${p.y}` + curva(p, IGLESIA, 0.16),
      `M${IGLESIA.x} ${IGLESIA.y}` + curva(IGLESIA, FINCA, 0.3),
      `M${FINCA.x} ${FINCA.y}` + curva(FINCA, p, 0.2)
    ];
  }

  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  // Rutas de todas las paradas, en punteado tenue
  const gRoutes = svg.querySelector('.m-routes');
  Object.values(PARADAS).forEach(p => el('path', { d: tramos(p).join('') }, gRoutes));

  // Lugares
  const gPlaces = svg.querySelector('.m-places');
  function lugar(p, cls, key) {
    const g = el('g', { class: 'm-place ' + cls, transform: `translate(${p.x} ${p.y})` }, gPlaces);
    el('circle', { r: key ? 6 : 4.5 }, g);
    const t = el('text', { x: p.lx, y: p.ly, 'text-anchor': p.anchor, 'dominant-baseline': 'middle' }, g);
    t.textContent = p.name;
    if (p.sub) {
      const s = el('text', { class: 'm-sub', x: p.lx, y: p.ly + 13, 'text-anchor': p.anchor, 'dominant-baseline': 'middle' }, g);
      s.textContent = p.sub;
    }
    return g;
  }
  const nodos = {};
  for (const id in PARADAS) {
    nodos[id] = lugar(PARADAS[id], 'm-place--stop', false);
    nodos[id].addEventListener('click', () => elegir(id, true));
  }
  const nIglesia = lugar(IGLESIA, 'm-place--key', true);
  const nFinca = lugar(FINCA, 'm-place--key', true);

  const trail = svg.querySelector('.m-trail');
  const bus = svg.querySelector('.m-bus');
  const busBody = svg.querySelector('.m-bus__body');
  const botones = [...document.querySelectorAll('.stops button')];
  const pasos = [...document.querySelectorAll('.legs li')];
  const nombres = [...document.querySelectorAll('.legs [data-from]')];
  const fin = document.getElementById('busend');
  const otraVez = document.getElementById('busagain');

  // El autobús da un pequeño bote mientras circula
  const bob = el('g', { class: 'm-bus__bob' });
  busBody.parentNode.insertBefore(bob, busBody);
  bob.appendChild(busBody);

  // Cartelito que aparece sobre el autobús en cada parada
  const tag = el('g', { class: 'm-tag' }, svg);
  const tagRect = el('rect', { rx: 9, height: 18, y: -38 }, tag);
  const tagText = el('text', { y: -26, 'text-anchor': 'middle' }, tag);
  function cartel(texto, pt) {
    if (!texto) { tag.classList.remove('is-on'); return; }
    tagText.textContent = texto;
    const w = tagText.getComputedTextLength() + 20;
    tagRect.setAttribute('width', w); tagRect.setAttribute('x', -w / 2);
    tag.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
    tag.classList.add('is-on');
  }

  // Un trazo invisible por tramo para medir y mover el autobús
  const medidores = [0, 1, 2].map(() => el('path', { fill: 'none', stroke: 'none' }, svg));

  let actual = null, raf = 0, token = 0;
  const espera = ms => new Promise(r => setTimeout(r, ms));

  function marcar(paso, p) {
    pasos.forEach((li, i) => {
      li.classList.toggle('is-done', i < paso);
      li.classList.toggle('is-now', i === paso);
      li.style.setProperty('--p', i === paso ? (p || 0) : 0);
    });
    [nodos[actual], nIglesia, nFinca].forEach((n, i) => n.classList.toggle('is-here', i === paso || (paso === 3 && i === 0)));
  }
  function ponerBus(pt, prev) {
    bus.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${(pt.y - 4).toFixed(1)})`);
    if (prev && Math.abs(pt.x - prev.x) > 0.05) busBody.setAttribute('transform', pt.x < prev.x ? 'scale(-1 1)' : '');
  }
  function terminar(p) {
    marcar(4);
    fin.textContent = '✓ Recorrido completado: de vuelta en ' + p.name;
    fin.classList.add('is-on');
    otraVez.disabled = false;
  }

  function tramo(i, largo, total, hecho, mio) {
    return new Promise(resolve => {
      const dur = Math.max(1500, largo * 12);
      const t0 = performance.now();
      let prev = medidores[i].getPointAtLength(0);
      bus.classList.add('is-moving');
      const frame = now => {
        if (mio !== token) return resolve(false);
        const k = Math.min(1, (now - t0) / dur);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const pt = medidores[i].getPointAtLength(largo * e);
        ponerBus(pt, prev);
        prev = pt;
        trail.style.strokeDashoffset = total - (hecho + largo * e);
        pasos[i + 1].style.setProperty('--p', e.toFixed(3));
        if (k < 1) { raf = requestAnimationFrame(frame); return; }
        bus.classList.remove('is-moving');
        resolve(true);
      };
      raf = requestAnimationFrame(frame);
    });
  }

  async function elegir(id, animar) {
    actual = id;
    const p = PARADAS[id];
    botones.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.stop === id)));
    for (const k in nodos) nodos[k].classList.toggle('is-on', k === id);
    nombres.forEach(n => { n.textContent = p.name; });
    const d = tramos(p);
    d.forEach((s, i) => medidores[i].setAttribute('d', s));
    trail.setAttribute('d', d.join(''));
    const largos = medidores.map(m => m.getTotalLength());
    const total = largos.reduce((a, b) => a + b, 0);
    trail.style.strokeDasharray = `${total} ${total}`;
    cancelAnimationFrame(raf);
    bus.classList.remove('is-moving');
    cartel(null);
    fin.classList.remove('is-on');
    const mio = ++token;

    // Al pulsar se anima siempre; solo el arranque automático respeta «reducir movimiento»
    if (!animar) {
      trail.style.strokeDashoffset = 0;
      ponerBus(medidores[2].getPointAtLength(largos[2]));
      if (animar) terminar(p); else { marcar(-1); fin.textContent = ''; }
      return;
    }

    otraVez.disabled = true;
    trail.style.strokeDashoffset = total;
    ponerBus(p);
    marcar(0);
    cartel('Salida', p);
    await espera(1100);
    const paradas = [[IGLESIA, 'Ceremonia'], [FINCA, '¡A la fiesta!'], [p, 'De vuelta']];
    let hecho = 0;
    for (let i = 0; i < 3; i++) {
      if (mio !== token) return;
      cartel(null);
      marcar(i + 1, 0);
      pasos[i].classList.add('is-done');
      if (!await tramo(i, largos[i], total, hecho, mio)) return;
      hecho += largos[i];
      cartel(paradas[i][1], paradas[i][0]);
      await espera(i < 2 ? 1200 : 900);
    }
    if (mio !== token) return;
    cartel(null);
    terminar(p);
  }

  botones.forEach(b => b.addEventListener('click', () => elegir(b.dataset.stop, true)));
  otraVez.addEventListener('click', () => elegir(actual, true));

  // Primera vez: arranca solo cuando el mapa entra en pantalla
  elegir('navalmoral', false);
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) { io.disconnect(); elegir(actual, true); }
    }, { threshold: 0.5 });
    io.observe(fig);
  }
})();
