/* Llegada en coche: vídeo hecho con Street View cada pocos metros, desde la A-5
   (antes de la salida 182) hasta la entrada del camino de la finca. */
(function () {
  const box = document.getElementById('ruta');
  if (!box) return;
  const v = box.querySelector('.ruta__video');
  const bar = box.querySelector('.ruta__bar');
  const play = box.querySelector('.ruta__play');
  const dist = box.querySelector('.ruta__dist');
  const txt = box.querySelector('.ruta__txt');
  const chaps = [...box.querySelectorAll('.ruta__chaps button')];
  const FPS = 14;
  // Decenas de metros que faltan hasta la entrada del camino, por fotograma
  const R = [423,423,421,421,420,418,418,417,416,415,414,414,413,411,411,410,409,408,407,406,405,404,403,402,401,400,400,398,397,396,395,395,393,393,392,390,390,388,388,387,386,385,384,383,382,381,380,379,378,377,376,375,374,374,372,372,370,369,369,367,367,366,365,364,363,362,361,360,360,358,358,357,355,355,354,353,352,351,350,349,348,347,346,344,344,342,341,340,339,338,337,336,334,334,332,332,330,330,328,327,326,325,325,323,323,321,320,319,318,317,316,315,314,313,312,311,311,309,309,307,306,305,304,303,302,301,299,299,298,297,296,295,294,292,292,290,290,288,287,286,285,284,283,282,281,280,279,278,277,276,275,274,273,271,271,269,269,267,267,265,264,263,262,262,260,260,259,258,257,256,255,254,253,252,250,250,248,247,246,245,243,243,241,240,239,238,237,236,235,234,232,232,230,229,228,227,226,225,223,222,221,220,219,218,216,215,214,213,212,211,209,208,207,206,206,204,203,202,201,200,199,198,197,196,195,194,193,192,191,190,188,187,186,185,184,183,182,180,180,178,177,176,175,174,173,171,171,169,169,167,166,165,164,163,162,160,159,158,157,156,155,154,153,152,150,150,148,148,146,145,144,143,142,141,140,139,138,137,136,135,134,133,132,131,130,129,128,127,126,125,124,123,122,121,120,119,118,117,116,115,114,113,112,111,110,109,108,107,106,105,104,103,102,101,99,99,97,96,95,94,93,92,90,89,88,87,86,85,84,82,82,81,80,79,78,77,75,75,73,73,72,71,70,68,68,66,66,65,64,63,61,61,59,59,57,57,56,54,54,52,52,51,50,49,48,47,46,45,44,43,42,40,40,38,38,36,36,34,33,32,31,30,29,28,26,25,24,23,22,21,20,19,18,17,16,15,14,12,12,10,10,9,8,7,5,5,4,3,2,1];
  // Rótulos: [segundo desde el que se muestra, texto]
  const T = [
    [0, 'Por la A-5 hacia la salida 182'],
    [2.2, 'Salida 182: Valdehúncar / Navalmoral Sur'],
    [6.2, 'Al final de la salida, a la izquierda'],
    [7.6, 'En la rotonda, segunda salida: CC-408'],
    [9.4, 'Unos 3 km por la CC-408, entre encinas'],
    [26.6, 'Atento: pasado el km 3, la entrada'],
    [28.8, 'Aquí, a la derecha: el camino de tierra']
  ];
  const fmt = m => m <= 10 ? 'Estás en la entrada' : m >= 1000
    ? 'Faltan ' + (m / 1000).toFixed(1).replace('.', ',') + ' km'
    : 'Faltan ' + Math.round(m / 10) * 10 + ' m';

  let raf = 0, last = '';
  function pintar() {
    const t = v.currentTime || 0, d = v.duration || 32.7;
    const m = R[Math.min(R.length - 1, Math.floor(t * FPS))] * 10;
    const s = fmt(m);
    if (s !== last) { dist.textContent = s; last = s; }
    let x = T[0];
    for (const y of T) if (t >= y[0]) x = y;
    if (txt.textContent !== x[1]) txt.textContent = x[1];
    let c = -1;
    chaps.forEach((b, k) => { if (t >= +b.dataset.t - 0.05) c = k; });
    chaps.forEach((b, k) => b.classList.toggle('is-on', k === c));
    bar.value = Math.round(t / d * 1000);
    bar.style.setProperty('--p', (t / d * 100).toFixed(1) + '%');
    box.classList.toggle('is-end', t >= 28.8);
  }
  function bucle() { pintar(); if (!v.paused) raf = requestAnimationFrame(bucle); }
  function estado() {
    const on = !v.paused;
    box.classList.toggle('is-playing', on);
    play.setAttribute('aria-label', on ? 'Pausar' : 'Reproducir');
    cancelAnimationFrame(raf);
    if (on) raf = requestAnimationFrame(bucle);
  }
  const ir = t => { v.preload = 'auto'; v.currentTime = t; pintar(); };
  const alternar = () => { v.preload = 'auto'; if (v.paused) { if (v.ended) v.currentTime = 0; v.play().catch(() => {}); } else v.pause(); };

  v.addEventListener('play', estado);
  v.addEventListener('pause', estado);
  v.addEventListener('ended', () => { estado(); pintar(); });
  v.addEventListener('seeked', pintar);
  play.addEventListener('click', alternar);
  box.querySelector('.ruta__screen').addEventListener('click', alternar);
  bar.addEventListener('input', () => { v.pause(); const d = v.duration || 32.7; ir(+bar.value / 1000 * d); });
  chaps.forEach(b => b.addEventListener('click', () => { ir(+b.dataset.t); if (v.paused) v.play().catch(() => {}); }));

  pintar();
  // Arranca solo la primera vez que se ve
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) {
        io.disconnect();
        v.preload = 'auto';
        v.play().catch(() => {});
      }
    }, { threshold: 0.6 });
    io.observe(v);
  }
})();
