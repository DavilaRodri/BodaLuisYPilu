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

  // Menú desplegable en móvil
  const toggle = document.querySelector('.nav__toggle');
  const menu = document.getElementById('menu');
  if (toggle && menu) {
    menu.querySelectorAll('.menu__list li').forEach((li, n) => li.style.setProperty('--n', n));
    const abrir = si => {
      toggle.setAttribute('aria-expanded', String(si));
      toggle.setAttribute('aria-label', si ? 'Cerrar menú' : 'Abrir menú');
      if (si) { menu.hidden = false; requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open'))); }
      else { menu.classList.remove('is-open'); setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 450); }
    };
    toggle.addEventListener('click', () => abrir(toggle.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', e => { if (e.target.closest('a, [data-cerrar]')) abrir(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { abrir(false); toggle.focus(); } });
  }

  // Fundido entre las fotos de la pareja
  const frame = document.querySelector('[data-fade]');
  if (frame) {  // el fundido se ve siempre; con «reducir movimiento» solo se quita el zoom
    const imgs = [...frame.querySelectorAll('img')];
    imgs.forEach(img => { img.loading = 'eager'; });
    let i = 0;
    setInterval(() => {
      if (document.hidden) return;
      imgs[i].classList.remove('is-on');
      i = (i + 1) % imgs.length;
      imgs[i].classList.add('is-on');
    }, 5500);
  }

  // Número de cuenta para el regalo
  if (cfg.iban) {
    const iban = document.getElementById('iban');
    const copy = document.getElementById('copiar');
    iban.textContent = cfg.iban;
    if (cfg.titular) {
      const holder = document.getElementById('titular');
      holder.textContent = 'A nombre de ' + cfg.titular;
      holder.hidden = false;
    }
    copy.hidden = false;
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(cfg.iban.replace(/\s+/g, ''));
        copy.firstChild.textContent = 'Copiado';
        setTimeout(() => { copy.firstChild.textContent = 'Copiar número'; }, 2000);
      } catch (e) {}
    });
  }

  // Formulario de confirmación
  const form = document.getElementById('rsvp');
  const names = document.getElementById('names');
  const msg = document.getElementById('msg');
  const send = document.getElementById('send');
  const sendText = document.getElementById('send-text');

  const PARADAS = [
    ['no', 'No, iré por mi cuenta'],
    ['castanar', 'Desde Castañar de Ibor'],
    ['navalmoral', 'Desde Navalmoral de la Mata'],
  ];
  let guestId = 0;

  function addRow(focus) {
    const n = ++guestId;
    const first = !names.children.length;
    const row = document.createElement('div');
    row.className = 'guest';
    row.innerHTML =
      '<div class="guest__name">' +
        '<input class="field" type="text" name="nombre" placeholder="Nombre y apellidos" aria-label="Nombre y apellidos" maxlength="120"' + (first ? ' autocomplete="name"' : '') + '>' +
        (first ? '' : '<button type="button" class="remove" aria-label="Quitar esta persona">×</button>') +
      '</div>' +
      '<div class="guest__opts">' +
        '<label class="mini" for="bus-' + n + '"><span>Autobús</span>' +
          '<select class="field" id="bus-' + n + '" name="autobus"><option value="">Elige una opción</option>' +
          PARADAS.map(p => '<option value="' + p[0] + '">' + p[1] + '</option>').join('') +
          '</select></label>' +
        '<label class="mini" for="pre-' + n + '"><span>Preboda</span>' +
          '<select class="field" id="pre-' + n + '" name="preboda"><option value="">Elige una opción</option>' +
          '<option value="si">Sí, iré</option><option value="no">No iré</option></select></label>' +
      '</div>';
    names.appendChild(row);
    const remove = row.querySelector('.remove');
    if (remove) remove.addEventListener('click', () => {
      row.remove();
      names.querySelector('input').focus();
    });
    if (focus) row.querySelector('input').focus();
  }
  addRow(false);

  document.getElementById('add').addEventListener('click', () => {
    if (names.children.length < 15) addRow(true);
  });

  form.addEventListener('change', e => {
    if (e.target.name !== 'asistira') return;
    const no = e.target.value === 'no';
    form.classList.toggle('is-no', no);
    document.getElementById('t-nombres').textContent = no ? 'Tu nombre (y el de quien tampoco venga)' : 'Cada persona que viene';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.textContent = '';
    msg.classList.remove('is-error');

    const choice = form.querySelector('input[name="asistira"]:checked');
    const si = choice && choice.value === 'si';
    const guests = [...names.querySelectorAll('.guest')]
      .map(g => ({ g, nombre: g.querySelector('[name="nombre"]').value.trim() }))
      .filter(x => x.nombre);
    const comentario = form.comentario.value.trim();

    if (!choice) return fail('Dinos si vendrás o no.', form.querySelector('input[name="asistira"]'));
    if (!guests.length) return fail('Escribe al menos un nombre.', names.querySelector('input'));
    if (si) {
      for (const x of guests) {
        const bus = x.g.querySelector('[name="autobus"]');
        const pre = x.g.querySelector('[name="preboda"]');
        if (!bus.value) return fail('Dinos si ' + x.nombre + ' irá en autobús.', bus);
        if (!pre.value) return fail('Dinos si ' + x.nombre + ' vendrá a la preboda.', pre);
      }
    }
    const list = guests.map(x => x.nombre);
    const asistentes = guests.map(x => ({
      nombre: x.nombre,
      autobus: si ? x.g.querySelector('[name="autobus"]').value : null,
      preboda: si ? x.g.querySelector('[name="preboda"]').value === 'si' : null
    }));

    send.disabled = true;
    sendText.textContent = 'Enviando…';
    try {
      const res = await fetch(cfg.supabaseUrl + '/rest/v1/confirmaciones', {
        method: 'POST',
        headers: { apikey: cfg.supabaseKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ asistira: si, nombres: list, asistentes, comentario: comentario || null })
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
    form.classList.remove('is-done', 'is-no');
    form.querySelector('input[name="asistira"]').focus();
  });

  function fail(text, focusEl) {
    msg.textContent = text;
    msg.classList.add('is-error');
    if (focusEl) focusEl.focus();
  }
})();
