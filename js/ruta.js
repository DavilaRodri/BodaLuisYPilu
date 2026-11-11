/* Llegada en stop motion: fotogramas de Street View desde la salida 182 de la A-5
   hasta la entrada del camino de la finca. */
(function () {
  const box = document.getElementById('ruta');
  if (!box) return;
  const imgs = [...box.querySelectorAll('.ruta__frames img')];
  const bar = box.querySelector('.ruta__bar');
  const play = box.querySelector('.ruta__play');
  const dist = box.querySelector('.ruta__dist');
  const txt = box.querySelector('.ruta__txt');
  const chaps = [...box.querySelectorAll('.ruta__chaps button')];

  // Metros que faltan hasta la entrada del camino en cada fotograma
  const M = [3930, 3700, 3525, 3315, 3180, 3130, 3000, 2645,
    780, 720, 660, 600, 540, 480, 420, 360, 300, 240, 180, 120, 60, 0, 0, 0];
  // Rótulo de cada tramo: [desde fotograma, texto]
  const T = [
    [0, 'Por la A-5, salida 182 hacia Valdehúncar'],
    [3, 'Al final de la salida, a la izquierda'],
    [5, 'En la rotonda, segunda salida: CC-408'],
    [6, 'Unos 3 km por la CC-408, entre encinas'],
    [19, 'Pasado el kilómetro 3…'],
    [21, '…donde la carretera gira a la izquierda'],
    [23, 'Aquí, a la derecha: el camino de tierra']
  ];
  // Pausas más largas en los momentos clave
  const PARA = { 0: 1400, 3: 1400, 5: 1500, 19: 1300, 21: 1200, 23: 3200 };

  const fmt = m => m === 0 ? 'Estás en la entrada' : m >= 1000
    ? 'Faltan ' + (m / 1000).toFixed(1).replace('.', ',') + ' km'
    : 'Faltan ' + Math.round(m / 10) * 10 + ' m';

  let i = 0, timer = 0, playing = false, started = false;

  function show(n) {
    i = n;
    imgs.forEach((im, k) => im.classList.toggle('is-on', k === n));
    bar.value = n;
    bar.style.setProperty('--p', (n / (imgs.length - 1) * 100).toFixed(1) + '%');
    dist.textContent = fmt(M[n]);
    let t = T[0];
    for (const x of T) if (n >= x[0]) t = x;
    txt.textContent = t[1];
    let c = 0;
    chaps.forEach((b, k) => { if (n >= +b.dataset.f) c = k; });
    chaps.forEach((b, k) => b.classList.toggle('is-on', k === c));
    box.classList.toggle('is-end', n === imgs.length - 1);
  }
  function tick() {
    const wait = PARA[i] || 380;
    timer = setTimeout(() => {
      if (!playing) return;
      show(i >= imgs.length - 1 ? 0 : i + 1);
      tick();
    }, wait);
  }
  function setPlay(on) {
    playing = on;
    clearTimeout(timer);
    box.classList.toggle('is-playing', on);
    play.setAttribute('aria-label', on ? 'Pausar' : 'Reproducir');
    if (on) tick();
  }
  function load() {
    imgs.forEach(im => { im.loading = 'eager'; });
  }

  play.addEventListener('click', () => { load(); setPlay(!playing); });
  bar.addEventListener('input', () => { load(); setPlay(false); show(+bar.value); });
  chaps.forEach(b => b.addEventListener('click', () => { load(); setPlay(false); show(+b.dataset.f); }));
  box.querySelector('.ruta__screen').addEventListener('click', () => { load(); setPlay(!playing); });

  show(0);
  setPlay(false);
  // Arranca solo la primera vez que se ve
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) {
        load();
        if (!started) { started = true; setTimeout(() => setPlay(true), 400); }
        io.disconnect();
      }
    }, { rootMargin: '200px 0px', threshold: 0 });
    io.observe(box);
  } else load();
})();
