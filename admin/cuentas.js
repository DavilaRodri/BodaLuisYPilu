/* Panel de la boda: regalos, gastos, proveedores y ajustes de la pareja. */
(function () {
  const P = window.PANEL, S = P.S, esc = P.esc, euros = P.euros;
  const e0 = n => (+n || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const $ = id => document.getElementById(id);
  const CATS = ['Finca y banquete', 'Ceremonia', 'Fotografía y vídeo', 'Música', 'Flores y decoración', 'Vestido y traje', 'Belleza', 'Invitaciones', 'Alianzas y joyas', 'Transporte', 'Alojamiento', 'Luna de miel', 'Detalles para invitados', 'Otros'];
  const FORMAS = { transferencia: 'Transferencia', bizum: 'Bizum', efectivo: 'Efectivo', sobre: 'Sobre', regalo: 'Regalo', otro: 'Otro' };
  const num = v => Math.round((parseFloat(String(v).replace(',', '.')) || 0) * 100) / 100;
  const fecha = d => d ? new Date(d + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const tile = (n, txt, main, extra) => `<div class="tile tile--eur${main ? ' tile--main' : ''}"><strong>${n}${extra ? ` <small>${extra}</small>` : ''}</strong><span>${txt}</span></div>`;
  const seg = (el, opts, val) => { el.innerHTML = opts.map(([k, t]) => `<button type="button" data-v="${k}" class="${k === val ? 'is-on' : ''}">${esc(t)}</button>`).join(''); el.dataset.v = val; };
  const segClick = el => el.addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    el.dataset.v = b.dataset.v; el.querySelectorAll('button').forEach(x => x.classList.toggle('is-on', x === b));
    el.dispatchEvent(new Event('change'));
  });

  // ============ Regalos ============
  let rFiltro = 'todos';
  const RF = {
    todos: ['Todos', () => true],
    gracias: ['Sin agradecer', r => !r.agradecido],
    a: [() => P.lados().a, r => r.lado === 'a'],
    b: [() => P.lados().b, r => r.lado === 'b'],
    ambos: ['De los dos', r => r.lado === 'ambos']
  };
  const invDe = r => S.invitados.filter(i => i.regalo_id === r.id);

  function regalos() {
    const R = S.regalos, L = P.lados();
    const total = R.reduce((a, r) => a + +r.importe, 0);
    const pers = R.reduce((a, r) => a + (+r.personas || 0), 0);
    const sinGracias = R.filter(r => !r.agradecido).length;
    const vienen = S.invitados.filter(i => i.asiste === 'si').length;
    const lado = k => R.filter(r => r.lado === k).reduce((a, r) => a + +r.importe, 0);
    $('rTiles').innerHTML =
      tile(e0(total), 'recibido en total', true) +
      tile(R.length, R.length === 1 ? 'regalo' : 'regalos') +
      tile(pers ? euros(total / pers) : '–', 'de media por persona', false) +
      tile(sinGracias, sinGracias === 1 ? 'sin agradecer' : 'sin agradecer') +
      (S.boda.cuentas_separadas || R.some(r => r.lado !== 'ambos')
        ? tile(e0(lado('a') + lado('ambos') / 2), 'para ' + esc(L.a), false) + tile(e0(lado('b') + lado('ambos') / 2), 'para ' + esc(L.b), false)
        : '') +
      (vienen ? tile(pers, 'personas han regalado', false, '/ ' + vienen) : '');

    const cuenta = k => R.filter(RF[k][1]).length;
    const nombre = k => typeof RF[k][0] === 'function' ? RF[k][0]() : RF[k][0];
    $('rFiltros').innerHTML = Object.keys(RF).filter(k => k === 'todos' || k === 'gracias' || cuenta(k)).map(k => `<button type="button" data-f="${k}" class="${rFiltro === k ? 'is-on' : ''}">${esc(nombre(k))} <b>${cuenta(k)}</b></button>`).join('');

    const q = P.norm($('rBuscar').value.trim());
    const lista = R.filter(r => RF[rFiltro][1](r) && (!q || P.norm(r.de).includes(q) || invDe(r).some(i => P.norm(i.nombre).includes(q))));
    $('rList').innerHTML = lista.map(r => {
      const sub = [r.personas + (r.personas === 1 ? ' persona' : ' personas'), FORMAS[r.forma], fecha(r.recibido)].filter(Boolean).join(' · ');
      return `<div class="rrow" data-id="${r.id}">
        <div class="grow__name">${esc(r.de)}<span class="grow__sub">${esc(sub)}</span></div>
        <span class="gtag gtag--side">${esc(L[r.lado])}</span>
        <b class="rrow__eur">${euros(r.importe)}</b>
        <button type="button" class="thx${r.agradecido ? ' is-on' : ''}" data-thx aria-pressed="${r.agradecido}" title="${r.agradecido ? 'Agradecido' : 'Marcar como agradecido'}"><svg><use href="#i-check"/></svg><span>${r.agradecido ? 'Agradecido' : 'Dar las gracias'}</span></button>
      </div>`;
    }).join('') || `<p class="empty">${R.length ? 'Ningún regalo con este filtro.' : 'Todavía no habéis apuntado ningún regalo.'}</p>`;

    // Quién viene y aún no tiene regalo apuntado (solo si se están enlazando invitados)
    const enlazados = S.invitados.some(i => i.regalo_id);
    const faltan = S.invitados.filter(i => i.asiste === 'si' && !i.regalo_id);
    $('rFaltan').hidden = !enlazados || !faltan.length;
    if (enlazados && faltan.length) {
      $('rFaltan').innerHTML = `<h2>Vienen y no tienen regalo apuntado <span class="muted">${faltan.length}</span></h2>
        <p class="muted">Solo cuenta a quien habéis enlazado en algún regalo. Puede que hayan regalado junto a otra persona.</p>
        <div class="names">${faltan.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(i => `<span>${esc(i.nombre)}</span>`).join('')}</div>`;
    }
  }
  P.onChange.push(regalos);
  $('rBuscar').addEventListener('input', regalos);
  $('rFiltros').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { rFiltro = b.dataset.f; regalos(); } });
  $('rList').addEventListener('click', async e => {
    const row = e.target.closest('.rrow'); if (!row) return;
    const r = S.regalos.find(x => x.id === row.dataset.id);
    if (e.target.closest('[data-thx]')) {
      try { Object.assign(r, await P.patch('regalos', r.id, { agradecido: !r.agradecido })); regalos(); P.toast(r.agradecido ? 'Marcado como agradecido' : 'Desmarcado'); }
      catch (err) { P.toast('No se ha podido guardar', true); }
      return;
    }
    editarRegalo(r);
  });

  let rAct = null, rSel = new Set();
  segClick($('rLado'));
  function chipsSel() {
    $('rInvSel').innerHTML = [...rSel].map(id => S.invitados.find(i => i.id === id)).filter(Boolean)
      .map(i => `<button type="button" class="is-on" data-id="${i.id}">${esc(i.nombre)} ×</button>`).join('');
  }
  function buscarInv() {
    const q = P.norm($('rInvQ').value.trim());
    if (!q) { $('rInvRes').innerHTML = ''; return; }
    const res = S.invitados.filter(i => !rSel.has(i.id) && P.norm(i.nombre).includes(q)).slice(0, 6);
    $('rInvRes').innerHTML = res.map(i => {
      const otro = i.regalo_id && (!rAct || i.regalo_id !== rAct.id) ? S.regalos.find(r => r.id === i.regalo_id) : null;
      return `<button type="button" data-id="${i.id}">${esc(i.nombre)}${otro ? `<small>ya en «${esc(otro.de)}»</small>` : ''}</button>`;
    }).join('') || '<p class="muted small">Nadie con ese nombre.</p>';
  }
  $('rInvQ').addEventListener('input', buscarInv);
  $('rInvRes').addEventListener('click', e => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    rSel.add(b.dataset.id); $('rInvQ').value = ''; buscarInv(); chipsSel(); autoRellenar();
    $('rInvQ').focus();
  });
  $('rInvSel').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) { rSel.delete(b.dataset.id); chipsSel(); autoRellenar(); } });
  let deTocado = false, persTocado = false;
  $('rDe').addEventListener('input', () => { deTocado = true; });
  $('rPersonas').addEventListener('input', () => { persTocado = true; });
  function autoRellenar() {
    const ns = [...rSel].map(id => (S.invitados.find(i => i.id === id) || {}).nombre).filter(Boolean);
    if (!deTocado && ns.length) $('rDe').value = ns.length < 3 ? ns.join(' y ') : ns.slice(0, -1).join(', ') + ' y ' + ns[ns.length - 1];
    if (!persTocado && ns.length) $('rPersonas').value = ns.length;
  }
  function editarRegalo(r) {
    rAct = r || null; deTocado = !!r; persTocado = !!r;
    const v = r || { de: '', personas: 1, importe: '', lado: 'ambos', forma: 'transferencia', recibido: new Date().toISOString().slice(0, 10), agradecido: false, notas: '' };
    const L = P.lados();
    $('rTitle').textContent = r ? 'Regalo' : 'Añadir regalo';
    $('rDe').value = v.de; $('rPersonas').value = v.personas; $('rImporte').value = v.importe === '' ? '' : +v.importe;
    seg($('rLado'), [['a', L.a], ['b', L.b], ['ambos', 'Los dos']], v.lado);
    $('rForma').value = v.forma; $('rFecha').value = v.recibido || ''; $('rGracias').checked = v.agradecido; $('rNotas').value = v.notas || '';
    rSel = new Set(r ? invDe(r).map(i => i.id) : []);
    $('rInvQ').value = ''; $('rInvRes').innerHTML = ''; chipsSel();
    $('rDel').hidden = !r;
    $('rDlg').showModal();
    if (!r) $('rInvQ').focus();
  }
  $('rNuevo').addEventListener('click', () => editarRegalo(null));
  $('rForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fila = {
      de: $('rDe').value.trim(), personas: Math.max(0, parseInt($('rPersonas').value, 10) || 0), importe: num($('rImporte').value),
      lado: $('rLado').dataset.v, forma: $('rForma').value, recibido: $('rFecha').value || null, agradecido: $('rGracias').checked, notas: $('rNotas').value.trim() || null
    };
    if (!fila.de) { $('rDe').focus(); return; }
    $('rSave').disabled = true;
    try {
      let r = rAct;
      if (r) Object.assign(r, await P.patch('regalos', r.id, fila));
      else { r = await P.insert('regalos', { ...fila, boda_id: S.boda.id }); S.regalos.unshift(r); }
      // Enlaces con invitados
      const antes = new Set(invDe(r).map(i => i.id));
      const quitar = [...antes].filter(id => !rSel.has(id)), poner = [...rSel].filter(id => !antes.has(id));
      if (quitar.length) await P.api('invitados?id=in.(' + quitar.join(',') + ')', { method: 'PATCH', body: JSON.stringify({ regalo_id: null }) });
      if (poner.length) await P.api('invitados?id=in.(' + poner.join(',') + ')', { method: 'PATCH', body: JSON.stringify({ regalo_id: r.id }) });
      S.invitados.forEach(i => { if (quitar.includes(i.id)) i.regalo_id = null; if (poner.includes(i.id)) i.regalo_id = r.id; });
      $('rDlg').close(); P.changed(); P.toast(rAct ? 'Guardado' : 'Regalo apuntado');
    } catch (err) { P.toast('No se ha podido guardar: ' + err.message, true); }
    finally { $('rSave').disabled = false; }
  });
  $('rDel').addEventListener('click', async () => {
    if (!rAct || !confirm('¿Borrar el regalo de ' + rAct.de + '?')) return;
    try {
      await P.del('regalos', rAct.id);
      S.regalos = S.regalos.filter(r => r !== rAct); S.invitados.forEach(i => { if (i.regalo_id === rAct.id) i.regalo_id = null; });
      $('rDlg').close(); P.changed(); P.toast('Borrado');
    } catch (err) { P.toast('No se ha podido borrar', true); }
  });

  // ============ Gastos ============
  let modo = 'gastos', xFiltro = 'todos';
  const pend = g => Math.max(0, +g.importe - +g.pagado);
  const prov = id => S.proveedores.find(p => p.id === id);
  segClick($('gxModo'));
  $('gxModo').addEventListener('change', () => { modo = $('gxModo').dataset.v; $('xGastos').hidden = modo !== 'gastos'; $('xProv').hidden = modo !== 'prov'; });
  $('xNuevo').addEventListener('click', () => modo === 'prov' ? editarProv(null) : editarGasto(null));

  // Reparto: lo que cada uno pone y lo que recibe en regalos
  function reparto() {
    const L = P.lados(), filas = {};
    const add = (k, campo, v) => { (filas[k] = filas[k] || { total: 0, pagado: 0, regalos: 0 })[campo] += v; };
    S.gastos.forEach(g => {
      const k = g.paga || 'A medias';
      if (k === 'A medias') { add(L.a, 'total', +g.importe / 2); add(L.a, 'pagado', +g.pagado / 2); add(L.b, 'total', +g.importe / 2); add(L.b, 'pagado', +g.pagado / 2); }
      else { add(k, 'total', +g.importe); add(k, 'pagado', +g.pagado); }
    });
    if (S.boda.cuentas_separadas) S.regalos.forEach(r => {
      if (r.lado === 'ambos') { add(L.a, 'regalos', +r.importe / 2); add(L.b, 'regalos', +r.importe / 2); } else add(L[r.lado], 'regalos', +r.importe);
    });
    return filas;
  }

  function gastos() {
    const G = S.gastos;
    const total = G.reduce((a, g) => a + +g.importe, 0), pagado = G.reduce((a, g) => a + +g.pagado, 0);
    const regalosT = S.regalos.reduce((a, r) => a + +r.importe, 0);
    const pres = +S.boda.presupuesto || 0;
    $('xTiles').innerHTML =
      tile(e0(total), 'cuesta la boda', true) +
      tile(e0(pagado), 'pagado') +
      tile(e0(total - pagado), 'falta por pagar') +
      `<label class="tile tile--edit"><strong><input type="number" id="xPres" min="0" step="100" inputmode="decimal" value="${pres || ''}" placeholder="—" aria-label="Presupuesto"><i>€</i></strong><span>presupuesto${pres ? (total > pres ? ` · <em class="over">te pasas ${e0(total - pres)}</em>` : ` · quedan ${e0(pres - total)}`) : ''}</span></label>` +
      tile(e0(regalosT), 'en regalos') +
      tile(e0(total - regalosT), total - regalosT >= 0 ? 'os cuesta de verdad' : 'os sobra');

    // Quién paga
    const filas = reparto(), sep = S.boda.cuentas_separadas;
    const ks = Object.keys(filas);
    $('xQuien').innerHTML = ks.length ? `<div class="who">${ks.map(k => {
      const f = filas[k], neto = f.total - f.regalos;
      return `<div class="who__row"><b>${esc(k)}</b>
        <span><small>Pone</small>${euros(f.total)}</span>
        <span><small>Pagado</small>${euros(f.pagado)}</span>
        <span><small>Falta</small>${euros(f.total - f.pagado)}</span>
        ${sep ? `<span><small>Recibe</small>${euros(f.regalos)}</span><span class="who__net"><small>${neto >= 0 ? 'Le cuesta' : 'Le sobra'}</small>${euros(Math.abs(neto))}</span>` : ''}
      </div>`;
    }).join('')}</div>${sep ? '' : '<p class="muted small sp-top">Lo que va «a medias» cuenta la mitad para cada uno.</p>'}` : '<p class="empty">Cuando apuntéis gastos, aquí veréis cuánto pone cada uno.</p>';

    // Próximos pagos
    const prox = G.filter(g => g.vence && pend(g) > 0).sort((a, b) => a.vence.localeCompare(b.vence)).slice(0, 6);
    const hoy = new Date().toISOString().slice(0, 10);
    $('xProx').innerHTML = prox.map(g => `<div class="feed__row" data-id="${g.id}"><b>${esc(g.concepto)}</b><span class="${g.vence < hoy ? 'feed__no' : 'muted'}">${euros(pend(g))}</span><span class="feed__d">${g.vence < hoy ? 'Vencido · ' : ''}${fecha(g.vence)}</span></div>`).join('') || '<p class="empty">No hay pagos con fecha pendientes.</p>';

    const XF = { todos: ['Todos', () => true], pend: ['Por pagar', g => pend(g) > 0], ok: ['Pagados', g => pend(g) === 0] };
    $('xFiltros').innerHTML = Object.keys(XF).map(k => `<button type="button" data-f="${k}" class="${xFiltro === k ? 'is-on' : ''}">${XF[k][0]} <b>${G.filter(XF[k][1]).length}</b></button>`).join('');
    const lista = G.filter(XF[xFiltro][1]);
    const porCat = {};
    lista.forEach(g => (porCat[g.categoria || 'Otros'] = porCat[g.categoria || 'Otros'] || []).push(g));
    const orden = Object.keys(porCat).sort((a, b) => (CATS.indexOf(a) + 99) % 99 - (CATS.indexOf(b) + 99) % 99);
    $('xList').innerHTML = orden.map(c => {
      const gs = porCat[c], st = gs.reduce((a, g) => a + +g.importe, 0);
      return `<section class="xcat"><h3><span>${esc(c)}</span><b>${euros(st)}</b></h3><div class="glist">${gs.map(g => {
        const p = prov(g.proveedor_id), pc = +g.importe ? Math.min(100, +g.pagado / +g.importe * 100) : 100;
        const sub = [p ? p.nombre : '', g.paga || 'A medias', g.vence && pend(g) > 0 ? 'antes del ' + fecha(g.vence) : ''].filter(Boolean).join(' · ');
        return `<div class="xrow" data-id="${g.id}">
          <div class="grow__name">${esc(g.concepto)}<span class="grow__sub">${esc(sub)}</span></div>
          <div class="xrow__pay"><div class="bar__track"><div class="bar__fill" style="width:${pc.toFixed(1)}%"></div></div><span>${pend(g) > 0 ? 'Faltan ' + euros(pend(g)) : 'Pagado'}</span></div>
          <b class="rrow__eur">${euros(g.importe)}</b>
        </div>`;
      }).join('')}</div></section>`;
    }).join('') || `<p class="empty card">${G.length ? 'Nada con este filtro.' : 'Todavía no habéis apuntado ningún gasto.'}</p>`;

    proveedores();
  }
  P.onChange.push(gastos);
  $('xFiltros').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { xFiltro = b.dataset.f; gastos(); } });
  $('xList').addEventListener('click', e => { const r = e.target.closest('.xrow'); if (r) editarGasto(S.gastos.find(g => g.id === r.dataset.id)); });
  $('xProx').addEventListener('click', e => { const r = e.target.closest('[data-id]'); if (r) editarGasto(S.gastos.find(g => g.id === r.dataset.id)); });
  $('xTiles').addEventListener('change', e => {
    if (e.target.id !== 'xPres') return;
    P.guardarBoda({ presupuesto: e.target.value === '' ? null : num(e.target.value) });
  });

  let xAct = null;
  const opciones = (lista, val) => {
    const l = val && !lista.includes(val) ? [...lista, val] : lista;
    return l.map(v => `<option${v === val ? ' selected' : ''}>${esc(v)}</option>`).join('');
  };
  function editarGasto(g) {
    xAct = g || null;
    const v = g || { concepto: '', categoria: CATS[0], proveedor_id: null, importe: '', pagado: 0, vence: '', paga: S.boda.cuentas_separadas ? P.lados().a : 'A medias', notas: '' };
    $('xTitle').textContent = g ? 'Gasto' : 'Añadir gasto';
    $('xConcepto').value = v.concepto;
    $('xCat').innerHTML = opciones(CATS, v.categoria || 'Otros');
    $('xProvSel').innerHTML = '<option value="">Ninguno</option>' + S.proveedores.map(p => `<option value="${p.id}"${p.id === v.proveedor_id ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('') + '<option value="+">+ Nuevo proveedor…</option>';
    $('xImporte').value = v.importe === '' ? '' : +v.importe; $('xPagado').value = +v.pagado || '';
    $('xPaga').innerHTML = opciones(P.pagadores(), v.paga || 'A medias');
    $('xVence').value = v.vence || ''; $('xNotas').value = v.notas || '';
    $('xDel').hidden = !g;
    $('xDlg').showModal();
    if (!g) $('xConcepto').focus();
  }
  $('xTodo').addEventListener('click', () => { $('xPagado').value = $('xImporte').value; });
  $('xProvSel').addEventListener('change', async e => {
    if (e.target.value !== '+') return;
    const n = (prompt('Nombre del proveedor') || '').trim();
    if (!n) { e.target.value = ''; return; }
    try {
      const p = await P.insert('proveedores', { boda_id: S.boda.id, nombre: n, categoria: $('xCat').value });
      S.proveedores.push(p); S.proveedores.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      e.target.insertAdjacentHTML('afterbegin', '');
      e.target.innerHTML = '<option value="">Ninguno</option>' + S.proveedores.map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('') + '<option value="+">+ Nuevo proveedor…</option>';
      e.target.value = p.id;
    } catch (err) { P.toast('No se ha podido crear', true); e.target.value = ''; }
  });
  $('xForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fila = {
      concepto: $('xConcepto').value.trim(), categoria: $('xCat').value, proveedor_id: $('xProvSel').value && $('xProvSel').value !== '+' ? $('xProvSel').value : null,
      importe: num($('xImporte').value), pagado: num($('xPagado').value), vence: $('xVence').value || null, paga: $('xPaga').value, notas: $('xNotas').value.trim() || null
    };
    if (!fila.concepto) { $('xConcepto').focus(); return; }
    $('xSave').disabled = true;
    try {
      if (xAct) Object.assign(xAct, await P.patch('gastos', xAct.id, fila));
      else S.gastos.push(await P.insert('gastos', { ...fila, boda_id: S.boda.id }));
      $('xDlg').close(); P.changed(); P.toast(xAct ? 'Guardado' : 'Gasto apuntado');
    } catch (err) { P.toast('No se ha podido guardar: ' + err.message, true); }
    finally { $('xSave').disabled = false; }
  });
  $('xDel').addEventListener('click', async () => {
    if (!xAct || !confirm('¿Borrar «' + xAct.concepto + '»?')) return;
    try { await P.del('gastos', xAct.id); S.gastos = S.gastos.filter(g => g !== xAct); $('xDlg').close(); P.changed(); P.toast('Borrado'); }
    catch (err) { P.toast('No se ha podido borrar', true); }
  });

  // ============ Proveedores ============
  function proveedores() {
    $('pList').innerHTML = S.proveedores.map(p => {
      const gs = S.gastos.filter(g => g.proveedor_id === p.id);
      const t = gs.reduce((a, g) => a + +g.importe, 0), f = gs.reduce((a, g) => a + pend(g), 0);
      const web = p.web ? (/^https?:\/\//.test(p.web) ? p.web : 'https://' + p.web.replace(/^@/, 'instagram.com/')) : '';
      return `<article class="pcard" data-id="${p.id}">
        <p class="pcard__cat">${esc(p.categoria || 'Proveedor')}</p>
        <h3>${esc(p.nombre)}</h3>
        ${p.contacto ? `<p class="muted">${esc(p.contacto)}</p>` : ''}
        <div class="pcard__links">
          ${p.telefono ? `<a href="tel:${esc(p.telefono.replace(/\s+/g, ''))}"><svg><use href="#i-phone"/></svg>${esc(p.telefono)}</a>` : ''}
          ${p.email ? `<a href="mailto:${esc(p.email)}"><svg><use href="#i-mail"/></svg>${esc(p.email)}</a>` : ''}
          ${web ? `<a href="${esc(web)}" target="_blank" rel="noopener">${esc(p.web)}</a>` : ''}
        </div>
        ${p.notas ? `<p class="pcard__notas">${esc(p.notas)}</p>` : ''}
        ${gs.length ? `<p class="pcard__eur"><b>${euros(t)}</b>${f > 0 ? ` · faltan ${euros(f)}` : ' · pagado'}</p>` : ''}
      </article>`;
    }).join('') || '<p class="empty card">Apuntad aquí a la finca, el fotógrafo, la música… con su teléfono y lo que hayáis hablado.</p>';
  }
  $('pList').addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const c = e.target.closest('.pcard'); if (c) editarProv(S.proveedores.find(p => p.id === c.dataset.id));
  });
  let pAct = null;
  function editarProv(p) {
    pAct = p || null;
    const v = p || { nombre: '', categoria: CATS[0] };
    $('pTitle').textContent = p ? 'Proveedor' : 'Añadir proveedor';
    $('pNombre').value = v.nombre; $('pCat').innerHTML = opciones(CATS, v.categoria || 'Otros');
    ['contacto', 'telefono', 'email', 'web', 'notas'].forEach(k => { $({ contacto: 'pContacto', telefono: 'pTel', email: 'pEmail', web: 'pWeb', notas: 'pNotas' }[k]).value = v[k] || ''; });
    $('pDel').hidden = !p;
    $('pDlg').showModal();
    if (!p) $('pNombre').focus();
  }
  $('pForm').addEventListener('submit', async e => {
    e.preventDefault();
    const t = id => $(id).value.trim() || null;
    const fila = { nombre: $('pNombre').value.trim(), categoria: $('pCat').value, contacto: t('pContacto'), telefono: t('pTel'), email: t('pEmail'), web: t('pWeb'), notas: t('pNotas') };
    if (!fila.nombre) { $('pNombre').focus(); return; }
    $('pSave').disabled = true;
    try {
      if (pAct) Object.assign(pAct, await P.patch('proveedores', pAct.id, fila));
      else S.proveedores.push(await P.insert('proveedores', { ...fila, boda_id: S.boda.id }));
      S.proveedores.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      $('pDlg').close(); P.changed(); P.toast(pAct ? 'Guardado' : 'Proveedor añadido');
    } catch (err) { P.toast('No se ha podido guardar: ' + err.message, true); }
    finally { $('pSave').disabled = false; }
  });
  $('pDel').addEventListener('click', async () => {
    if (!pAct || !confirm('¿Borrar a ' + pAct.nombre + '? Sus gastos se quedan, sin proveedor.')) return;
    try { await P.del('proveedores', pAct.id); S.proveedores = S.proveedores.filter(p => p !== pAct); S.gastos.forEach(g => { if (g.proveedor_id === pAct.id) g.proveedor_id = null; }); $('pDlg').close(); P.changed(); P.toast('Borrado'); }
    catch (err) { P.toast('No se ha podido borrar', true); }
  });

  // ============ Ajustes de la pareja ============
  function ajustes() {
    const b = S.boda;
    $('parA').value = b.pareja_a || ''; $('parB').value = b.pareja_b || '';
    $('optSeparadas').checked = !!b.cuentas_separadas;
    $('pagList').innerHTML = (b.pagadores || []).map((p, k) => `<button type="button" class="is-on" data-k="${k}" title="Quitar">${esc(p)} ×</button>`).join('') || '<span class="muted small">Nadie más por ahora.</span>';
    $('retAl').value = String(b.borrar_alergias_meses || 3); $('retTodo').value = String(b.borrar_datos_meses || 36);
  }
  P.onChange.push(ajustes);
  $('parA').addEventListener('change', e => P.guardarBoda({ pareja_a: e.target.value.trim() || null }));
  $('parB').addEventListener('change', e => P.guardarBoda({ pareja_b: e.target.value.trim() || null }));
  $('optSeparadas').addEventListener('change', e => P.guardarBoda({ cuentas_separadas: e.target.checked }));
  $('retAl').addEventListener('change', e => P.guardarBoda({ borrar_alergias_meses: +e.target.value }));
  $('retTodo').addEventListener('change', e => P.guardarBoda({ borrar_datos_meses: +e.target.value }));
  $('pagForm').addEventListener('submit', e => {
    e.preventDefault();
    const n = $('pagNuevo').value.trim(); if (!n) return;
    const l = S.boda.pagadores || [];
    if (P.pagadores().includes(n)) { P.toast('Ya está en la lista'); return; }
    $('pagNuevo').value = '';
    P.guardarBoda({ pagadores: [...l, n] });
  });
  $('pagList').addEventListener('click', e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const l = (S.boda.pagadores || []).slice(); l.splice(+b.dataset.k, 1);
    P.guardarBoda({ pagadores: l });
  });

  // ============ Excel: hojas extra ============
  P.excelExtra = (XLSX, libro) => {
    const L = P.lados();
    if (S.regalos.length) {
      const h = XLSX.utils.json_to_sheet(S.regalos.map(r => ({ 'De parte de': r.de, 'Personas': r.personas, 'Importe': +r.importe, 'Invitados de': L[r.lado], 'Cómo': FORMAS[r.forma], 'Recibido': r.recibido || '', 'Agradecido': r.agradecido ? 'Sí' : 'No', 'Notas': r.notas || '' })));
      h['!cols'] = [{ wch: 34 }, { wch: 9 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 11 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(libro, h, 'Regalos');
    }
    if (S.gastos.length) {
      const h = XLSX.utils.json_to_sheet(S.gastos.map(g => ({ 'Concepto': g.concepto, 'Categoría': g.categoria || '', 'Proveedor': (prov(g.proveedor_id) || {}).nombre || '', 'Importe': +g.importe, 'Pagado': +g.pagado, 'Falta': pend(g), 'Quién paga': g.paga || 'A medias', 'Fecha límite': g.vence || '', 'Notas': g.notas || '' })));
      h['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(libro, h, 'Gastos');
    }
    if (S.proveedores.length) {
      const h = XLSX.utils.json_to_sheet(S.proveedores.map(p => ({ 'Nombre': p.nombre, 'Categoría': p.categoria || '', 'Contacto': p.contacto || '', 'Teléfono': p.telefono || '', 'Email': p.email || '', 'Web': p.web || '', 'Notas': p.notas || '' })));
      h['!cols'] = [{ wch: 26 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 26 }, { wch: 26 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(libro, h, 'Proveedores');
    }
  };
})();
