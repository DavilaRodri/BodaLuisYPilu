/* Panel de la boda: sesión, datos, resumen, invitados, grupos y ajustes.
   El plano de mesas está en mesas.js y el PDF en pdf.js. */
(function () {
  const cfg = window.BODA;
  const API = cfg.supabaseUrl, KEY = cfg.supabaseKey;
  const DOMINIO = '@bodapilaryluis.com';
  const $ = id => document.getElementById(id);
  const AL = window.ALERGIAS, ALI = window.ALERGIA;
  const PARADAS = {}; // se rellena con las paradas de cada boda
  const EDAD = { adulto: 'Adulto', nino: 'Infantil', bebe: 'Bebé (trona)' };
  const COLORES = ['#b4746a', '#5f7a8c', '#c49a4a', '#6f7d4f', '#8a6f9e', '#4f8a83', '#a36a3f', '#7d8590', '#c0727f', '#3f6e9e'];

  const S = { boda: null, bodas: [], grupos: [], mesas: [], invitados: [], conf: {}, regalos: [], gastos: [], proveedores: [] };
  let sesion = null;

  // ---------- Utilidades ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const iniciales = n => String(n || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const grupo = id => S.grupos.find(g => g.id === id);
  const mesa = id => S.mesas.find(m => m.id === id);
  const color = inv => (grupo(inv.grupo_id) || {}).color || '#9a958a';
  const mesaTxt = m => m ? ('Mesa ' + (m.numero ?? '') + (m.nombre ? ' · ' + m.nombre : '')).trim() : '';
  const tieneDieta = i => (i.alergias && i.alergias.length) || i.alergia_otra;

  // ---------- Sesión y API ----------
  function guardar(s) {
    sesion = s ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || (Date.now() / 1000 + s.expires_in) } : null;
    try { s ? localStorage.setItem('boda-admin', JSON.stringify(sesion)) : localStorage.removeItem('boda-admin'); } catch (e) {}
  }
  async function auth(path, body) {
    const r = await fetch(API + '/auth/v1/' + path, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error_description || j.msg || 'error'), { status: r.status });
    return j;
  }
  async function token() {
    if (!sesion) throw new Error('sin sesión');
    if (sesion.expires_at - 60 < Date.now() / 1000) guardar(await auth('token?grant_type=refresh_token', { refresh_token: sesion.refresh_token }));
    return sesion.access_token;
  }
  async function api(path, opts = {}) {
    const headers = { apikey: KEY, Authorization: 'Bearer ' + await token(), ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) };
    if (opts.method && opts.method !== 'GET') ultimaEscritura = Date.now();
    const r = await fetch(API + '/rest/v1/' + path, { ...opts, headers });
    if (r.status === 401) { salir(); throw new Error('Sesión caducada'); }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.message || ('Error ' + r.status));
    }
    return r.status === 204 ? null : r.json();
  }
  const rep = { Prefer: 'return=representation' };
  const P = window.PANEL = {
    S, api, esc, norm, iniciales, grupo, mesa, color, mesaTxt, tieneDieta, EDAD, PARADAS,
    async patch(tabla, id, cambios) { const r = await api(tabla + '?id=eq.' + id, { method: 'PATCH', headers: rep, body: JSON.stringify(cambios) }); return r[0]; },
    async insert(tabla, fila) { const r = await api(tabla, { method: 'POST', headers: rep, body: JSON.stringify(fila) }); return r[0]; },
    async del(tabla, id) { await api(tabla + '?id=eq.' + id, { method: 'DELETE' }); },
    token, url: API, key: KEY,
    euros: n => (+n || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: (+n || 0) % 1 ? 2 : 0 }),
    lados() { const b = S.boda || {}; return { a: b.pareja_a || 'Novia/o 1', b: b.pareja_b || 'Novia/o 2', ambos: 'Los dos' }; },
    pagadores() { const l = P.lados(); return [l.a, l.b, 'A medias', ...((S.boda || {}).pagadores || [])]; },
    onChange: [],
    changed() { P.onChange.forEach(f => f()); }
  };

  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const u = $('u').value.trim().toLowerCase();
    const email = u.includes('@') ? u : u + DOMINIO;
    $('entrar').disabled = true; $('loginError').textContent = '';
    try {
      guardar(await auth('token?grant_type=password', { email, password: $('p').value }));
      $('p').value = '';
      abrir();
    } catch (err) {
      $('loginError').textContent = err.status === 400 ? 'Usuario o contraseña incorrectos.' : 'No se ha podido entrar. Revisa la conexión.';
    } finally { $('entrar').disabled = false; }
  });
  function salir() {
    if (sesion) fetch(API + '/auth/v1/logout', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + sesion.access_token } }).catch(() => {});
    guardar(null);
    $('app').hidden = true; $('login').hidden = false; $('u').focus();
  }
  $('salir').addEventListener('click', salir);

  // ---------- Carga ----------
  async function cargarBodas() {
    // En la web de cada boda solo se abre esa boda, aunque entre el superadmin
    S.bodas = await api('bodas?select=*&order=fecha' + (cfg.bodaId ? '&id=eq.' + cfg.bodaId : ''));
    if (!S.bodas.length) throw new Error('Esta cuenta no tiene ninguna boda.');
    let pref = null; try { pref = localStorage.getItem('boda-sel'); } catch (e) {}
    S.boda = S.bodas.find(b => b.id === pref) || S.bodas[0];
    const sel = $('bodaSel');
    sel.hidden = S.bodas.length < 2;
    sel.innerHTML = S.bodas.map(b => `<option value="${b.id}">${esc(b.nombre)}</option>`).join('');
    sel.value = S.boda.id;
  }
  $('bodaSel').addEventListener('change', async e => {
    S.boda = S.bodas.find(b => b.id === e.target.value);
    try { localStorage.setItem('boda-sel', S.boda.id); } catch (err) {}
    await cargar();
  });
  let ultimaEscritura = 0, foto = '';
  async function cargar(silencio) {
    const b = S.boda.id;
    const opc = q => api(q).catch(() => []);
    const [grupos, mesas, invitados, conf, regalos, gastos, proveedores] = await Promise.all([
      api(`grupos?boda_id=eq.${b}&select=*&order=orden,creado`),
      api(`mesas?boda_id=eq.${b}&select=*&order=numero,creado`),
      api(`invitados?boda_id=eq.${b}&select=*&order=creado.desc`),
      api(`confirmaciones?boda_id=eq.${b}&select=id,creado,asistira,comentario,nombres,email,direccion&order=creado.desc&limit=200`),
      opc(`regalos?boda_id=eq.${b}&select=*&order=creado.desc`),
      opc(`gastos?boda_id=eq.${b}&select=*&order=creado`),
      opc(`proveedores?boda_id=eq.${b}&select=*&order=nombre`)
    ]);
    if (silencio) {
      // Solo repinta si algo ha cambiado en el servidor
      const [boda] = await api('bodas?select=*&id=eq.' + b);
      const nueva = JSON.stringify([boda, grupos, mesas, invitados, conf, regalos, gastos, proveedores]);
      if (nueva === foto || !ocioso()) return;
      foto = nueva;
      if (boda) Object.assign(S.boda, boda);
    } else foto = JSON.stringify([S.boda, grupos, mesas, invitados, conf, regalos, gastos, proveedores]);
    Object.keys(PARADAS).forEach(k => delete PARADAS[k]);
    (S.boda.paradas || []).forEach(p => { PARADAS[p.id] = p.nombre; });
    Object.assign(S, { grupos, mesas, invitados, regalos, gastos, proveedores, conf: Object.fromEntries(conf.map(c => [c.id, c])) });
    S.confList = conf;
    cabecera();
    P.changed();
  }
  function cabecera() {
    $('bodaNombre').textContent = S.boda.nombre;
    $('mono').textContent = S.boda.nombre.split(/\s+y\s+|\s*&\s*/).map(w => w.trim()[0] || '').join('&').toUpperCase();
    $('bodaFecha').textContent = S.boda.fecha ? new Date(S.boda.fecha + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    document.title = 'Panel · ' + S.boda.nombre;
  }

  // ---------- Pestañas ----------
  let tab = 'resumen';
  function irA(t) {
    tab = t;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('is-on', b.dataset.tab === t));
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== 'v-' + t; });
    try { sessionStorage.setItem('boda-tab', t); } catch (e) {}
    if (t === 'mesas' && window.MESAS) window.MESAS.mostrar();
    window.scrollTo(0, 0);
  }
  $('tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) irA(b.dataset.tab); });
  P.irA = irA;

  // ---------- Resumen ----------
  function resumen() {
    const vienen = S.invitados.filter(i => i.asiste === 'si');
    const no = S.invitados.filter(i => i.asiste === 'no').length;
    const pend = S.invitados.filter(i => i.asiste === 'pendiente').length;
    const sentados = vienen.filter(i => i.mesa_id).length;
    const plazas = S.mesas.reduce((a, m) => a + m.capacidad, 0);
    const n = k => vienen.filter(k).length;
    const tile = (num, txt, main, extra) => `<div class="tile${main ? ' tile--main' : ''}"><strong>${num}${extra ? ` <small>${extra}</small>` : ''}</strong><span>${txt}</span></div>`;
    $('tiles').innerHTML =
      tile(vienen.length, vienen.length === 1 ? 'persona viene' : 'personas vienen', true) +
      tile(no, 'no pueden venir') +
      (pend ? tile(pend, 'pendientes') : '') +
      tile(sentados, 'con mesa', false, '/ ' + vienen.length) +
      tile(S.mesas.length, S.mesas.length === 1 ? 'mesa' : 'mesas', false, plazas ? plazas + ' plazas' : '') +
      Object.keys(PARADAS).map(k => tile(n(i => i.autobus === k), 'bus ' + esc(PARADAS[k].replace(/ de (la )?[A-ZÁÉÍÓÚ].*$/, '')))).join('') +
      (S.boda.menu_infantil !== false ? tile(n(i => i.edad === 'nino'), n(i => i.edad === 'nino') === 1 ? 'menú infantil' : 'menús infantiles') +
      tile(n(i => i.edad === 'bebe'), n(i => i.edad === 'bebe') === 1 ? 'trona' : 'tronas') : '') +
      tile(n(tieneDieta), 'con alergias o dieta');

    const max = Math.max(1, vienen.length);
    const barra = (txt, num, col, who) => `<div><div class="bar__top"><span>${txt}</span><b>${num}</b></div><div class="bar__track"><div class="bar__fill" style="width:${(num / max * 100).toFixed(1)}%;${col ? 'background:' + col : ''}"></div></div>${who ? `<p class="bar__who">${who}</p>` : ''}</div>`;
    const grupos = S.grupos.map(g => barra(esc(g.nombre), vienen.filter(i => i.grupo_id === g.id).length, g.color));
    const sin = vienen.filter(i => !i.grupo_id).length;
    if (sin) grupos.push(barra('Sin grupo', sin, '#c9c2b2'));
    $('porGrupo').innerHTML = grupos.join('') || '<p class="empty">Crea grupos en Invitados.</p>';

    const al = AL.map(a => ({ a, ps: vienen.filter(i => (i.alergias || []).includes(a.id)) })).filter(x => x.ps.length)
      .map(x => barra(x.a.nombre, x.ps.length, x.a.tipo === 'dieta' ? '#5f7a8c' : '#c0762b', x.ps.map(p => esc(p.nombre)).join(', ')));
    const otras = vienen.filter(i => i.alergia_otra);
    if (otras.length) al.push(barra('Otras', otras.length, '#a36a3f', otras.map(p => esc(p.nombre) + ' (' + esc(p.alergia_otra) + ')').join(', ')));
    $('porAlergia').innerHTML = al.join('') || '<p class="empty">Nadie ha indicado alergias todavía.</p>';

    const conf = (S.confList || []).slice(0, 8);
    $('ultimas').innerHTML = conf.map(c => `<div class="feed__row"><b>${esc((c.nombres || []).join(', '))}</b><span class="${c.asistira ? 'muted' : 'feed__no'}">${(c.nombres || []).length > 1 ? (c.asistira ? 'vienen' : 'no pueden venir') : (c.asistira ? 'viene' : 'no puede venir')}</span><span class="feed__d">${new Date(c.creado).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>${c.comentario ? `<p class="feed__c">«${esc(c.comentario)}»</p>` : ''}</div>`).join('') || '<p class="empty">Todavía no ha respondido nadie.</p>';
  }
  P.onChange.push(resumen);

  // ---------- Invitados ----------
  let filtro = 'si', marcados = new Set();
  const FILTROS = {
    todos: ['Todos', () => true],
    si: ['Vienen', i => i.asiste === 'si'],
    no: ['No vienen', i => i.asiste === 'no'],
    pendiente: ['Pendientes', i => i.asiste === 'pendiente'],
    sinmesa: ['Sin mesa', i => i.asiste === 'si' && !i.mesa_id],
    alergias: ['Con alergias', i => i.asiste === 'si' && tieneDieta(i)],
    singrupo: ['Sin grupo', i => !i.grupo_id],
    sininv: ['Sin invitación', i => i.asiste !== 'no' && !i.invitacion_enviada]
  };
  const dirDe = i => i.direccion || (S.conf[i.confirmacion_id] || {}).direccion || '';
  function alTags(i) {
    const t = (i.alergias || []).map(a => `<span class="${(ALI[a] || {}).tipo === 'dieta' ? 'k' : ''}">${esc((ALI[a] || {}).nombre || a)}</span>`);
    if (i.alergia_otra) t.push(`<span>${esc(i.alergia_otra)}</span>`);
    if (i.edad === 'nino') t.push('<span class="k">Infantil</span>');
    if (i.edad === 'bebe') t.push('<span class="k">Trona</span>');
    return t.join('');
  }
  P.alTags = alTags;
  function invitados() {
    const cuenta = k => S.invitados.filter(FILTROS[k][1]).length;
    $('filtros').innerHTML = Object.keys(FILTROS).filter(k => k !== 'pendiente' || cuenta(k)).map(k => `<button type="button" data-f="${k}" class="${filtro === k ? 'is-on' : ''}">${FILTROS[k][0]} <b>${cuenta(k)}</b></button>`).join('') +
      S.grupos.map(g => `<button type="button" data-f="g:${g.id}" class="${filtro === 'g:' + g.id ? 'is-on' : ''}"><i class="dot" style="background:${g.color}"></i>${esc(g.nombre)} <b>${S.invitados.filter(i => i.grupo_id === g.id).length}</b></button>`).join('');
    const q = norm($('buscar').value.trim());
    const f = filtro.startsWith('g:') ? (i => i.grupo_id === filtro.slice(2)) : FILTROS[filtro][1];
    const lista = S.invitados.filter(i => f(i) && (!q || norm(i.nombre).includes(q))).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    $('hint').textContent = lista.length + (lista.length === 1 ? ' persona' : ' personas');
    $('glist').innerHTML = lista.map(i => {
      const g = grupo(i.grupo_id), m = mesa(i.mesa_id);
      const sub = [i.autobus ? 'Bus ' + PARADAS[i.autobus] : '', i.origen === 'manual' ? 'añadido a mano' : ''].filter(Boolean).join(' · ');
      return `<div class="grow${i.asiste !== 'si' ? ' is-no' : ''}" data-id="${i.id}">
        <input type="checkbox" aria-label="Seleccionar a ${esc(i.nombre)}" ${marcados.has(i.id) ? 'checked' : ''}>
        <div class="grow__name">${esc(i.nombre)}${sub ? `<span class="grow__sub">${esc(sub)}</span>` : ''}${i.email || dirDe(i) ? `<span class="grow__contact">${[i.email ? esc(i.email) : '', esc(dirDe(i))].filter(Boolean).join(' · ')}</span>` : ''}</div>
        ${g ? `<span class="gtag" style="color:${g.color}"><i></i><span style="color:var(--ink)">${esc(g.nombre)}</span></span>` : '<span class="gtag gtag--none">Sin grupo</span>'}
        <div class="al">${alTags(i)}</div>
        <button type="button" class="thx inv${i.invitacion_enviada ? ' is-on' : ''}" data-inv aria-pressed="${!!i.invitacion_enviada}" title="${i.invitacion_enviada ? 'Invitación enviada' : 'Marcar invitación enviada'}"><svg><use href="#i-check"/></svg><span>${i.invitacion_enviada ? 'Invitación enviada' : 'Invitación'}</span></button>
        <span class="mtag">${i.asiste === 'no' ? 'No viene' : i.asiste === 'pendiente' ? 'Pendiente' : m ? `<b>Mesa ${esc(m.numero ?? '')}</b>` : 'Sin mesa'}</span>
      </div>`;
    }).join('') || `<p class="empty">${S.invitados.length ? 'Nadie con este filtro.' : 'Todavía no hay invitados. Llegarán con las confirmaciones de la web, o añádelos a mano.'}</p>`;
    bulk();
  }
  P.onChange.push(invitados);
  $('buscar').addEventListener('input', invitados);
  $('filtros').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { filtro = b.dataset.f; invitados(); } });
  $('glist').addEventListener('click', e => {
    const row = e.target.closest('.grow'); if (!row) return;
    if (e.target.closest('[data-inv]')) { invitacion([row.dataset.id], null); return; }
    if (e.target.matches('input[type=checkbox]')) {
      e.target.checked ? marcados.add(row.dataset.id) : marcados.delete(row.dataset.id);
      bulk(); return;
    }
    editar(S.invitados.find(i => i.id === row.dataset.id));
  });
  function bulk() {
    for (const id of marcados) if (!S.invitados.some(i => i.id === id)) marcados.delete(id);
    $('bulk').hidden = !marcados.size;
    $('bulkN').textContent = marcados.size + (marcados.size === 1 ? ' seleccionado' : ' seleccionados');
    $('bulkGrupo').innerHTML = '<option value="">Poner en grupo…</option>' + S.grupos.map(g => `<option value="${g.id}">${esc(g.nombre)}</option>`).join('') + '<option value="-">Quitar grupo</option>';
  }
  // Marca la invitación de estas personas y de quien confirmó con ellas (misma casa)
  async function invitacion(ids, valor) {
    const base = S.invitados.filter(i => ids.includes(i.id));
    const v = valor ?? !base[0].invitacion_enviada;
    const confs = new Set(base.map(i => i.confirmacion_id).filter(Boolean));
    const todos = S.invitados.filter(i => ids.includes(i.id) || (i.confirmacion_id && confs.has(i.confirmacion_id)));
    try {
      await api('invitados?id=in.(' + todos.map(i => i.id).join(',') + ')', { method: 'PATCH', body: JSON.stringify({ invitacion_enviada: v }) });
      todos.forEach(i => { i.invitacion_enviada = v; });
      P.changed(); P.toast(v ? (todos.length > 1 ? 'Invitación marcada para ' + todos.length + ' personas' : 'Invitación marcada') : 'Desmarcada');
    } catch (err) { P.toast('No se ha podido guardar', true); }
  }
  $('bulkInv').addEventListener('click', async () => { await invitacion([...marcados], true); marcados.clear(); invitados(); });
  $('bulkOff').addEventListener('click', () => { marcados.clear(); invitados(); });
  $('bulkGrupo').addEventListener('change', async e => {
    const v = e.target.value; if (!v) return;
    const ids = [...marcados];
    try {
      await api('invitados?id=in.(' + ids.join(',') + ')', { method: 'PATCH', body: JSON.stringify({ grupo_id: v === '-' ? null : v }) });
      S.invitados.forEach(i => { if (marcados.has(i.id)) i.grupo_id = v === '-' ? null : v; });
      marcados.clear(); P.changed(); P.toast('Grupo actualizado');
    } catch (err) { P.toast('No se ha podido guardar', true); }
  });

  // Ficha de invitado
  let actual = null;
  const seg = (el, opts, val) => {
    el.innerHTML = opts.map(([k, t]) => `<button type="button" data-v="${k}" class="${k === val ? 'is-on' : ''}">${t}</button>`).join('');
    el.dataset.v = val;
  };
  ['gAsiste', 'gEdad'].forEach(id => $(id).addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    $(id).dataset.v = b.dataset.v;
    $(id).querySelectorAll('button').forEach(x => x.classList.toggle('is-on', x === b));
  }));
  $('gAlergias').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) b.classList.toggle('is-on'); });
  function editar(i) {
    actual = i || null;
    const v = i || { nombre: '', asiste: 'si', edad: 'adulto', alergias: [], grupo_id: null, autobus: null };
    $('gTitle').textContent = i ? 'Invitado' : 'Añadir invitado';
    $('gNombre').value = v.nombre;
    seg($('gAsiste'), [['si', 'Sí'], ['no', 'No'], ['pendiente', 'Pendiente']], v.asiste);
    seg($('gEdad'), [['adulto', 'Adulto'], ['nino', 'Infantil'], ['bebe', 'Bebé (trona)']], v.edad);
    $('gEdad').closest('.f').hidden = S.boda.menu_infantil === false && v.edad === 'adulto';
    $('gGrupo').innerHTML = '<option value="">Sin grupo</option>' + S.grupos.map(g => `<option value="${g.id}">${esc(g.nombre)}</option>`).join('');
    $('gGrupo').value = v.grupo_id || '';
    $('gBus').innerHTML = '<option value="">No</option>' + Object.keys(PARADAS).map(k => `<option value="${k}">${esc(PARADAS[k])}</option>`).join('');
    $('gBus').value = v.autobus || '';
    $('gEmail').value = v.email || '';
    $('gDir').value = i ? dirDe(i) : '';
    $('gInv').checked = !!v.invitacion_enviada;
    $('gAlergias').innerHTML = AL.map(a => `<button type="button" data-v="${a.id}" class="${(v.alergias || []).includes(a.id) ? 'is-on' : ''}">${a.nombre}</button>`).join('');
    $('gOtra').value = v.alergia_otra || '';
    $('gNotas').value = v.notas || '';
    const c = i && i.confirmacion_id && S.conf[i.confirmacion_id];
    const m = i && mesa(i.mesa_id);
    $('gExtra').textContent = [c ? 'Confirmó en la web el ' + new Date(c.creado).toLocaleDateString('es-ES') + (c.comentario ? '. Nos dijo: «' + c.comentario + '»' : '') + '.' : '',  m ? 'Sentado en ' + mesaTxt(m) + '.' : ''].filter(Boolean).join(' ');
    $('gDel').hidden = !i;
    $('gDlg').showModal();
    if (!i) $('gNombre').focus();
  }
  $('nuevo').addEventListener('click', () => editar(null));
  $('gForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fila = {
      nombre: $('gNombre').value.trim(),
      asiste: $('gAsiste').dataset.v,
      edad: $('gEdad').dataset.v,
      grupo_id: $('gGrupo').value || null,
      autobus: $('gBus').value || null,
      alergias: [...$('gAlergias').querySelectorAll('.is-on')].map(b => b.dataset.v),
      alergia_otra: $('gOtra').value.trim() || null,
      notas: $('gNotas').value.trim() || null,
      email: $('gEmail').value.trim().toLowerCase() || null,
      direccion: $('gDir').value.trim() || null,
      invitacion_enviada: $('gInv').checked
    };
    if (!fila.nombre) { $('gNombre').focus(); return; }
    $('gSave').disabled = true;
    try {
      if (actual) Object.assign(actual, await P.patch('invitados', actual.id, fila));
      else S.invitados.unshift(await P.insert('invitados', { ...fila, boda_id: S.boda.id, origen: 'manual' }));
      $('gDlg').close(); P.changed(); P.toast(actual ? 'Guardado' : 'Invitado añadido');
    } catch (err) { P.toast('No se ha podido guardar: ' + err.message, true); }
    finally { $('gSave').disabled = false; }
  });
  $('gDel').addEventListener('click', async () => {
    if (!actual || !confirm('¿Borrar a ' + actual.nombre + '? No se puede deshacer.')) return;
    try { await P.del('invitados', actual.id); S.invitados = S.invitados.filter(i => i !== actual); $('gDlg').close(); P.changed(); P.toast('Borrado'); }
    catch (err) { P.toast('No se ha podido borrar', true); }
  });
  P.editar = editar;
  document.addEventListener('click', e => { const c = e.target.closest('[data-close]'); if (c) c.closest('dialog').close(); });

  // Grupos
  function grupos() {
    $('grList').innerHTML = S.grupos.map(g => `<div class="gr" data-id="${g.id}">
      <label class="swatch" style="background:${g.color}" title="Color"><input type="color" value="${g.color}" aria-label="Color de ${esc(g.nombre)}"></label>
      <input type="text" value="${esc(g.nombre)}" maxlength="40" aria-label="Nombre del grupo">
      <span class="gr__n">${S.invitados.filter(i => i.grupo_id === g.id).length}</span>
      <button class="ibtn" type="button" data-del aria-label="Borrar grupo"><svg><use href="#i-x"/></svg></button>
    </div>`).join('') || '<p class="muted">No hay grupos.</p>';
  }
  $('grupos').addEventListener('click', () => { grupos(); $('grDlg').showModal(); });
  $('grDlg').addEventListener('close', () => P.changed());
  $('grAdd').addEventListener('click', async () => {
    try {
      const g = await P.insert('grupos', { boda_id: S.boda.id, nombre: 'Nuevo grupo', color: COLORES[S.grupos.length % COLORES.length], orden: S.grupos.length + 1 });
      S.grupos.push(g); grupos();
      const inp = $('grList').querySelector(`[data-id="${g.id}"] input[type=text]`); inp.focus(); inp.select();
    } catch (err) { P.toast('No se ha podido crear', true); }
  });
  $('grList').addEventListener('change', async e => {
    const row = e.target.closest('.gr'); if (!row) return;
    const g = grupo(row.dataset.id);
    const cambio = e.target.type === 'color' ? { color: e.target.value } : { nombre: e.target.value.trim() || g.nombre };
    try { Object.assign(g, await P.patch('grupos', g.id, cambio)); row.querySelector('.swatch').style.background = g.color; }
    catch (err) { P.toast('No se ha podido guardar', true); }
  });
  $('grList').addEventListener('input', e => { if (e.target.type === 'color') e.target.parentNode.style.background = e.target.value; });
  $('grList').addEventListener('click', async e => {
    if (!e.target.closest('[data-del]')) return;
    const row = e.target.closest('.gr'); const g = grupo(row.dataset.id);
    const n = S.invitados.filter(i => i.grupo_id === g.id).length;
    if (!confirm(`¿Borrar el grupo «${g.nombre}»?` + (n ? `\n\n${n} invitados se quedarán sin grupo.` : ''))) return;
    try { await P.del('grupos', g.id); S.grupos = S.grupos.filter(x => x !== g); S.invitados.forEach(i => { if (i.grupo_id === g.id) i.grupo_id = null; }); grupos(); }
    catch (err) { P.toast('No se ha podido borrar', true); }
  });

  // ---------- Ajustes ----------
  function ajustes() {
    const b = S.boda;
    $('salaW').value = Math.round(b.sala_ancho / 100);
    $('salaH').value = Math.round(b.sala_alto / 100);
    $('fondoTxt').textContent = b.plano_url ? 'Cambiar plano' : 'Subir plano';
    $('fondoQuitar').hidden = !b.plano_url;
    $('optNombres').checked = b.pdf_nombres_en_plano;
    $('optBuscador').checked = b.buscador_activo;
    qr();
  }
  P.onChange.push(ajustes);
  async function boda(cambios) {
    try { Object.assign(S.boda, await P.patch('bodas', S.boda.id, cambios)); P.changed(); P.toast('Guardado'); }
    catch (err) { P.toast('No se ha podido guardar', true); }
  }
  P.guardarBoda = boda;
  ['salaW', 'salaH'].forEach(id => $(id).addEventListener('change', () => {
    const w = Math.min(200, Math.max(5, +$('salaW').value || 24)), h = Math.min(200, Math.max(5, +$('salaH').value || 16));
    boda({ sala_ancho: w * 100, sala_alto: h * 100 });
  }));
  $('optNombres').addEventListener('change', e => boda({ pdf_nombres_en_plano: e.target.checked }));
  $('optBuscador').addEventListener('change', e => boda({ buscador_activo: e.target.checked }));
  $('fondoFile').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 8 * 1024 * 1024) { P.toast('La imagen pesa más de 8 MB', true); return; }
    $('fondoTxt').textContent = 'Subiendo…';
    try {
      const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      const path = `${S.boda.id}/plano-${Date.now()}.${ext}`;
      const r = await fetch(`${API}/storage/v1/object/planos/${path}`, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + await token(), 'Content-Type': f.type, 'x-upsert': 'true' }, body: f });
      if (!r.ok) throw new Error(r.status);
      await boda({ plano_url: `${API}/storage/v1/object/public/planos/${path}` });
    } catch (err) { P.toast('No se ha podido subir el plano', true); ajustes(); }
    e.target.value = '';
  });
  $('fondoQuitar').addEventListener('click', () => boda({ plano_url: null }));

  function qr() {
    const url = new URL('../mesa/', location.href).href;
    $('qrBox').hidden = !S.boda.buscador_activo;
    $('qrLink').href = url; $('qrLink').textContent = url.replace(/^https?:\/\//, '');
    if (!S.boda.buscador_activo || !window.qrcode) return;
    const q = window.qrcode(0, 'M'); q.addData(url); q.make();
    $('qr').innerHTML = q.createImgTag(8, 16);
  }
  window.addEventListener('load', () => { if (S.boda) qr(); });
  $('qrDown').addEventListener('click', () => {
    const img = $('qr').querySelector('img'); if (!img) return;
    const a = document.createElement('a'); a.href = img.src; a.download = 'qr-donde-me-siento.gif'; a.click();
  });

  // Contraseña
  $('menuPass').addEventListener('click', () => { $('passMsg').textContent = ''; $('np').value = ''; $('passDlg').showModal(); });
  $('passForm').addEventListener('submit', async e => {
    e.preventDefault();
    const pw = $('np').value;
    if (pw.length < 8) { $('passMsg').textContent = 'Tiene que tener al menos 8 caracteres.'; return; }
    try {
      const r = await fetch(API + '/auth/v1/user', { method: 'PUT', headers: { apikey: KEY, Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      if (!r.ok) throw new Error();
      $('passMsg').textContent = 'Contraseña cambiada.';
      setTimeout(() => $('passDlg').close(), 1200);
    } catch (err) { $('passMsg').textContent = 'No se ha podido cambiar. Prueba otra.'; }
  });

  // ---------- Excel ----------
  $('excel').addEventListener('click', () => {
    if (!window.XLSX) { P.toast('Un momento, se está preparando. Pulsa otra vez.'); return; }
    const al = i => [...(i.alergias || []).map(a => (ALI[a] || {}).nombre || a), i.alergia_otra].filter(Boolean).join(', ');
    const filas = S.invitados.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(i => ({
      'Nombre': i.nombre,
      '¿Viene?': { si: 'Sí', no: 'No', pendiente: 'Pendiente' }[i.asiste],
      'Grupo': (grupo(i.grupo_id) || {}).nombre || '',
      'Mesa': mesa(i.mesa_id) ? mesaTxt(mesa(i.mesa_id)) : '',
      'Menú': EDAD[i.edad],
      'Alergias y dieta': al(i),
      'Autobús': PARADAS[i.autobus] || '',
      'Email': i.email || '',
      'Dirección': dirDe(i),
      'Invitación enviada': i.invitacion_enviada ? 'Sí' : 'No',
      'Notas': i.notas || '',
      'Comentario en la web': (S.conf[i.confirmacion_id] || {}).comentario || ''
    }));
    const libro = XLSX.utils.book_new();
    const h1 = XLSX.utils.json_to_sheet(filas);
    h1['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 30 }, { wch: 24 }, { wch: 28 }, { wch: 40 }, { wch: 30 }, { wch: 40 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(libro, h1, 'Invitados');
    const mesas = [['Mesa', 'Nombre', 'Invitado', 'Menú', 'Alergias y dieta']];
    S.mesas.slice().sort((a, b) => (a.numero || 0) - (b.numero || 0)).forEach(m => S.invitados.filter(i => i.mesa_id === m.id).forEach(i => mesas.push([m.numero ?? '', m.nombre || '', i.nombre, EDAD[i.edad], al(i)])));
    const h2 = XLSX.utils.aoa_to_sheet(mesas); h2['!cols'] = [{ wch: 6 }, { wch: 20 }, { wch: 30 }, { wch: 14 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(libro, h2, 'Mesas');
    // Una fila por persona y parada, con su email, para mandar a cada autobús sus detalles
    const bus = [['Parada', 'Nombre', 'Email']];
    const v = S.invitados.filter(i => i.asiste === 'si');
    Object.keys(PARADAS).forEach(k => v.filter(i => i.autobus === k).sort((x, y) => x.nombre.localeCompare(y.nombre, 'es')).forEach(i => bus.push([PARADAS[k], i.nombre, i.email || ''])));
    const h3 = XLSX.utils.aoa_to_sheet(bus); h3['!cols'] = [{ wch: 26 }, { wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(libro, h3, 'Autobuses');
    if (P.excelExtra) P.excelExtra(XLSX, libro);
    XLSX.writeFile(libro, 'invitados-' + (S.boda.slug || 'boda') + '.xlsx');
  });

  // ---------- Aviso ----------
  let tt = 0;
  P.toast = (txt, err) => {
    const t = $('toast');
    t.textContent = txt; t.classList.toggle('is-err', !!err); t.classList.add('is-on');
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove('is-on'), err ? 3800 : 2200);
    if (tab !== 'mesas') {
      // fuera del plano, el aviso flota sobre la vista actual
      document.body.appendChild(t); t.style.position = 'fixed'; t.style.bottom = window.innerWidth <= 900 ? ($('bulk').hidden ? '96px' : '190px') : ($('bulk').hidden ? '24px' : '92px'); t.style.zIndex = 60;
    } else {
      $('canvas').appendChild(t); t.style.position = ''; t.style.bottom = ''; t.style.zIndex = '';
    }
  };

  // ---------- Segundo paso para el superadmin ----------
  const aal = () => { try { return JSON.parse(atob(sesion.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).aal; } catch (e) { return null; } };
  async function authApi(path, method, body) {
    const r = await fetch(API + '/auth/v1/' + path, { method, headers: { apikey: KEY, Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.msg || j.message || ('Error ' + r.status)), { status: r.status });
    return j;
  }
  let factor = null;
  async function pideCodigo() {
    if (aal() === 'aal2') return false;
    const yo = await api('superadmins?select=user_id').catch(() => []);
    if (!yo.length) return false; // cuenta de novios: no hace falta
    const user = await authApi('user', 'GET');
    const f = (user.factors || []).find(x => x.factor_type === 'totp' && x.status === 'verified');
    $('login').hidden = true; $('app').hidden = true; $('mfa').hidden = false;
    $('mfaError').textContent = f ? '' : 'Activa primero la verificación en dos pasos desde el superadmin.';
    $('mfaOk').disabled = !f; factor = f && f.id;
    $('mfaCode').value = ''; $('mfaCode').focus();
    return true;
  }
  $('mfaForm').addEventListener('submit', async e => {
    e.preventDefault();
    const code = $('mfaCode').value.replace(/\D/g, '');
    if (code.length !== 6 || !factor) { $('mfaError').textContent = 'Son 6 cifras.'; return; }
    $('mfaOk').disabled = true; $('mfaError').textContent = '';
    try {
      const ch = await authApi('factors/' + factor + '/challenge', 'POST', {});
      guardar(await authApi('factors/' + factor + '/verify', 'POST', { challenge_id: ch.id, code }));
      $('mfa').hidden = true; abrir();
    } catch (err) { $('mfaError').textContent = 'Código incorrecto o caducado. Prueba con el siguiente.'; $('mfaCode').select(); }
    finally { $('mfaOk').disabled = false; }
  });
  $('mfaSalir').addEventListener('click', () => { $('mfa').hidden = true; salir(); });

  // ---------- Arranque ----------
  async function abrir() {
    try { if (await pideCodigo()) return; } catch (err) { $('login').hidden = false; $('loginError').textContent = err.message; return; }
    $('login').hidden = true; $('app').hidden = false;
    try {
      await cargarBodas();
      await cargar();
      let t = 'resumen'; try { t = sessionStorage.getItem('boda-tab') || t; } catch (e) {}
      irA(t);
    } catch (err) {
      if (sesion) { $('app').hidden = true; $('login').hidden = false; $('loginError').textContent = err.message; }
    }
  }
  P.recargar = cargar;

  // ---------- Auto-actualización ----------
  // Cada 20 s (y al volver a la pestaña) trae los cambios de otros: nuevas
  // confirmaciones, lo que toque la pareja desde otro móvil... Nunca mientras
  // se está editando, arrastrando o con un diálogo abierto.
  let pulsando = false;
  addEventListener('pointerdown', () => { pulsando = true; }, true);
  addEventListener('pointerup', () => { pulsando = false; }, true);
  addEventListener('pointercancel', () => { pulsando = false; }, true);
  function ocioso() {
    if (document.hidden || pulsando || $('app').hidden || !S.boda) return false;
    if (Date.now() - ultimaEscritura < 4000) return false;
    if (document.querySelector('dialog[open]')) return false;
    const a = document.activeElement;
    if (a && a.closest('#app') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'search') return false;
    return true;
  }
  let enCurso = false;
  async function refrescar() {
    if (enCurso || !ocioso()) return;
    enCurso = true;
    try { await cargar(true); } catch (e) {} finally { enCurso = false; }
  }
  setInterval(refrescar, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refrescar(); });
  addEventListener('focus', refrescar);
  try { sesion = JSON.parse(localStorage.getItem('boda-admin')); } catch (e) {}
  if (sesion) abrir(); else $('login').hidden = false;
})();
