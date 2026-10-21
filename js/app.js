(function () {
  const cfg = window.BODA;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Modo noche
  (function () {
    const btn = document.getElementById('tema');
    if (!btn) return;
    const root = document.documentElement;
    const sync = () => {
      const dark = root.dataset.theme === 'dark';
      btn.setAttribute('aria-pressed', dark);
      btn.setAttribute('aria-label', dark ? 'Cambiar a modo día' : 'Cambiar a modo noche');
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = dark ? '#161714' : '#f3f2ef';
    };
    sync();
    // Sin elección guardada, sigue al sistema también si cambia en vivo
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      let saved = null;
      try { saved = localStorage.getItem('tema'); } catch (err) {}
      if (saved) return;
      root.dataset.theme = e.matches ? 'dark' : 'light';
      sync();
    });
    btn.addEventListener('click', () => {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('tema', root.dataset.theme); } catch (e) {}
      sync();
    });
  })();

  // Cuenta atrás
  const target = new Date(cfg.fecha).getTime();
  const cd = {};
  document.querySelectorAll('[data-cd]').forEach(el => { cd[el.dataset.cd] = el; });
  function tick() {
    let t = Math.max(0, target - Date.now()) / 1000;
    const d = Math.floor(t / 86400); t -= d * 86400;
    const h = Math.floor(t / 3600); t -= h * 3600;
    const m = Math.floor(t / 60);
    const s = Math.floor(t - m * 60);
    cd.d.textContent = d;
    cd.h.textContent = String(h).padStart(2, '0');
    cd.m.textContent = String(m).padStart(2, '0');
    cd.s.textContent = String(s).padStart(2, '0');
  }
  if (cd.d) { tick(); setInterval(tick, 1000); }

  // Entradas al hacer scroll
  const rising = document.querySelectorAll('.rise');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    rising.forEach(el => io.observe(el));
  } else {
    rising.forEach(el => el.classList.add('is-in'));
  }

  // Fundido entre la foto y las acuarelas
  const frame = document.querySelector('[data-fade]');
  if (frame && !reduce) {
    const imgs = [...frame.querySelectorAll('img')];
    const caption = frame.querySelector('.hero__caption');
    imgs.forEach(img => { img.loading = 'eager'; });
    let i = 0;
    imgs[0].classList.add('drift');
    setInterval(() => {
      if (document.hidden) return;
      imgs[i].classList.remove('is-on', 'drift');
      i = (i + 1) % imgs.length;
      imgs[i].classList.add('is-on', 'drift');
      if (caption) caption.textContent = imgs[i].dataset.caption;
    }, 5500);
  }

  // Formulario de confirmación
  const form = document.getElementById('rsvp');
  const names = document.getElementById('names');
  const msg = document.getElementById('msg');
  const send = document.getElementById('send');
  const sendText = document.getElementById('send-text');

  function addRow(focus) {
    const row = document.createElement('div');
    row.className = 'name-row';
    row.innerHTML =
      '<input class="field" type="text" name="nombre" placeholder="Nombre y apellidos" aria-labelledby="t-nombres" maxlength="120">' +
      '<button type="button" class="remove" aria-label="Quitar esta persona">×</button>';
    names.appendChild(row);
    row.querySelector('.remove').addEventListener('click', () => {
      row.remove();
      names.querySelector('input').focus();
    });
    if (focus) row.querySelector('input').focus();
  }

  document.getElementById('add').addEventListener('click', () => {
    if (names.children.length < 15) addRow(true);
  });

  form.addEventListener('change', e => {
    if (e.target.name !== 'asistira') return;
    document.getElementById('t-nombres').textContent =
      e.target.value === 'no' ? 'Tu nombre (y el de quien tampoco venga)' : 'Nombre de cada asistente';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.textContent = '';
    msg.classList.remove('is-error');

    const choice = form.querySelector('input[name="asistira"]:checked');
    const list = [...form.querySelectorAll('input[name="nombre"]')].map(i => i.value.trim()).filter(Boolean);
    const comentario = form.comentario.value.trim();

    if (!choice) return fail('Dinos si vendrás o no.', form.querySelector('input[name="asistira"]'));
    if (!list.length) return fail('Escribe al menos un nombre.', form.querySelector('input[name="nombre"]'));

    send.disabled = true;
    sendText.textContent = 'Enviando…';
    try {
      const res = await fetch(cfg.supabaseUrl + '/rest/v1/confirmaciones', {
        method: 'POST',
        headers: { apikey: cfg.supabaseKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ asistira: choice.value === 'si', nombres: list, comentario: comentario || null })
      });
      if (!res.ok) throw new Error(res.status);
      document.getElementById('thanks-text').textContent = choice.value === 'si'
        ? (list.length === 1 ? 'Te esperamos el 4 de septiembre.' : 'Os esperamos a los ' + list.length + ' el 4 de septiembre.')
        : 'Te echaremos de menos. Gracias por avisarnos.';
      form.classList.add('is-done');
      form.querySelector('.thanks').focus();
    } catch (err) {
      fail('No se ha podido enviar. Revisa la conexión e inténtalo de nuevo.');
    } finally {
      send.disabled = false;
      sendText.textContent = 'Enviar confirmación';
    }
  });

  document.getElementById('again').addEventListener('click', () => {
    form.reset();
    [...names.children].slice(1).forEach(r => r.remove());
    form.classList.remove('is-done');
    form.querySelector('input[name="asistira"]').focus();
  });

  function fail(text, focusEl) {
    msg.textContent = text;
    msg.classList.add('is-error');
    if (focusEl) focusEl.focus();
  }
})();
