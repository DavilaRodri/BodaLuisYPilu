/* PDF para el banquete: plano con las mesas (y los nombres, si se quiere),
   lista por mesa con menús y alergias, y resumen de alergias. */
(function () {
  const P = window.PANEL, S = P.S;
  const AL = window.ALERGIA;
  let listo = null;

  function cargarScript(src) {
    return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  }
  async function b64(url) {
    const buf = await (await fetch(url)).arrayBuffer();
    let s = ''; const u = new Uint8Array(buf);
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function preparar() {
    if (!listo) listo = (async () => {
      if (!window.jspdf) await cargarScript('vendor/jspdf.umd.min.js');
      const [l, r] = await Promise.all([b64('vendor/Jost-Light.ttf'), b64('vendor/Jost-Regular.ttf')]);
      return { l, r };
    })();
    return listo;
  }
  async function imagen(url) {
    const blob = await (await fetch(url)).blob();
    const data = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
    const dim = await new Promise(ok => { const im = new Image(); im.onload = () => ok({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => ok(null); im.src = data; });
    return { data, dim, fmt: /png/.test(blob.type) ? 'PNG' : /webp/.test(blob.type) ? 'WEBP' : 'JPEG' };
  }

  const INK = [38, 36, 31], MUTED = [107, 102, 92], LINE = [200, 192, 176], OLIVE = [79, 93, 63], AMBER = [192, 118, 43], BLUE = [95, 122, 140], PAPER = [251, 249, 244];
  const hex = h => { const n = parseInt(String(h || '#9a958a').slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const alTxt = i => [...(i.alergias || []).map(a => (AL[a] || {}).nombre || a), i.alergia_otra].filter(Boolean).join(', ');
  const menuTxt = i => i.edad === 'nino' ? 'Menú infantil' : i.edad === 'bebe' ? 'Trona' : '';
  const corto = n => n.split(/\s+/).slice(0, 2).join(' ');

  async function generar() {
    const btn = document.getElementById('pdf');
    btn.disabled = true;
    P.toast('Preparando el PDF…');
    try {
      const f = await preparar();
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      doc.addFileToVFS('Jost-Light.ttf', f.l); doc.addFont('Jost-Light.ttf', 'Jost', 'light');
      doc.addFileToVFS('Jost-Regular.ttf', f.r); doc.addFont('Jost-Regular.ttf', 'Jost', 'normal');
      const PW = 297, PH = 210, M = 14;
      const fecha = S.boda.fecha ? new Date(S.boda.fecha + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
      const mesas = S.mesas.slice().sort((a, b) => (a.numero ?? 1e9) - (b.numero ?? 1e9));
      const sentados = m => S.invitados.filter(i => i.mesa_id === m.id && i.asiste === 'si').sort((a, b) => (a.asiento ?? 99) - (b.asiento ?? 99));
      const vienen = S.invitados.filter(i => i.asiste === 'si');
      const font = (w, size, col) => { doc.setFont('Jost', w === 'r' ? 'normal' : 'light'); doc.setFontSize(size); doc.setTextColor(...(col || INK)); };
      let pagina = 0;
      function cabecera(titulo, sub) {
        if (pagina++) doc.addPage();
        doc.setFillColor(...PAPER); doc.rect(0, 0, PW, PH, 'F');
        font('l', 22); doc.text(titulo, M, M + 6);
        font('l', 10, MUTED); doc.text([S.boda.nombre, fecha].filter(Boolean).join(' · '), M, M + 12.5);
        if (sub) { font('l', 10, MUTED); doc.text(sub, PW - M, M + 6, { align: 'right' }); }
        doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, M + 16, PW - M, M + 16);
      }
      function pie() {
        font('l', 8, MUTED);
        doc.text('Generado el ' + new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' + S.boda.nombre, M, PH - 7);
        doc.text(String(pagina), PW - M, PH - 7, { align: 'right' });
      }

      // ---------- 1. Plano ----------
      const conNombres = S.boda.pdf_nombres_en_plano;
      cabecera('Plano de mesas', `${vienen.filter(i => i.mesa_id).length} invitados · ${mesas.length} mesas`);
      const area = { x: M, y: M + 21, w: PW - 2 * M, h: PH - M - 21 - 14 };
      if (mesas.length) {
        // encuadre: el salón entero si hay plano de fondo; si no, solo las mesas
        let bx0, by0, bx1, by1;
        if (S.boda.plano_url) { bx0 = 0; by0 = 0; bx1 = S.boda.sala_ancho; by1 = S.boda.sala_alto; }
        else {
          bx0 = by0 = Infinity; bx1 = by1 = -Infinity;
          mesas.forEach(m => { const e = P.geo(m).ext + (conNombres ? 120 : 30); bx0 = Math.min(bx0, m.x - e); by0 = Math.min(by0, m.y - e); bx1 = Math.max(bx1, m.x + e); by1 = Math.max(by1, m.y + e); });
        }
        const k = Math.min(area.w / (bx1 - bx0), area.h / (by1 - by0));
        const ox = area.x + (area.w - (bx1 - bx0) * k) / 2 - bx0 * k, oy = area.y + (area.h - (by1 - by0) * k) / 2 - by0 * k;
        const X = x => ox + x * k, Y = y => oy + y * k;
        if (S.boda.plano_url) {
          try {
            const im = await imagen(S.boda.plano_url);
            if (im.dim) {
              const W = S.boda.sala_ancho * k, H = S.boda.sala_alto * k, r = Math.min(W / im.dim.w, H / im.dim.h);
              doc.setGState(new doc.GState({ opacity: 0.45 }));
              doc.addImage(im.data, im.fmt, X(0) + (W - im.dim.w * r) / 2, Y(0) + (H - im.dim.h * r) / 2, im.dim.w * r, im.dim.h * r);
              doc.setGState(new doc.GState({ opacity: 1 }));
            }
          } catch (e) {}
          doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.roundedRect(X(0), Y(0), S.boda.sala_ancho * k, S.boda.sala_alto * k, 2, 2, 'S');
        }
        const poly = (pts, estilo) => {
          const [p0, ...rest] = pts; let px = p0[0], py = p0[1];
          doc.lines(rest.map(p => { const d = [p[0] - px, p[1] - py]; px = p[0]; py = p[1]; return d; }), p0[0], p0[1], [1, 1], estilo, true);
        };
        const tam = Math.max(4.2, Math.min(7, 13 * k * 2.83));
        mesas.forEach(m => {
          const g = P.geo(m), ps = sentados(m);
          const forma = g.tipo === 'ellipse'
            ? Array.from({ length: 64 }, (_, i) => { const a = i / 64 * 2 * Math.PI; return P.girar({ x: g.rx * Math.cos(a), y: g.ry * Math.sin(a) }, m.rot); })
            : [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => P.girar({ x: sx * g.w / 2, y: sy * g.h / 2 }, m.rot));
          doc.setFillColor(255, 255, 255); doc.setDrawColor(...(m.presidencial ? OLIVE : LINE)); doc.setLineWidth(m.presidencial ? 0.5 : 0.35);
          poly(forma.map(p => [X(m.x + p.x), Y(m.y + p.y)]), 'FD');
          const porSilla = {}; ps.forEach(i => { if (i.asiento != null && i.asiento < m.capacidad) porSilla[i.asiento] = i; });
          ps.filter(i => i.asiento == null || i.asiento >= m.capacidad).forEach(i => { for (let s = 0; s < m.capacidad; s++) if (!porSilla[s]) { porSilla[s] = i; break; } });
          g.sillas.forEach((s0, s) => {
            const p = P.girar(s0, m.rot), inv = porSilla[s], cx = X(m.x + p.x), cy = Y(m.y + p.y), r = 20 * k;
            if (inv) { doc.setFillColor(...hex(P.color(inv))); doc.circle(cx, cy, r, 'F'); }
            else { doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.circle(cx, cy, r, 'S'); }
            if (inv && (P.tieneDieta(inv) || inv.edad !== 'adulto')) {
              doc.setFillColor(...(P.tieneDieta(inv) ? AMBER : BLUE)); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.2);
              doc.circle(cx + r * 0.7, cy - r * 0.7, Math.max(0.7, r * 0.42), 'FD');
            }
            if (inv && conNombres) {
              const len = Math.hypot(p.x, p.y) || 1, dx = p.x / len, dy = p.y / len;
              font(P.tieneDieta(inv) ? 'r' : 'l', tam, P.tieneDieta(inv) ? AMBER : INK);
              if (g.tipo === 'rect' && Math.abs(s0.y) > g.h / 2) {
                const w = doc.getTextWidth(corto(inv.nombre)), a = 50 * Math.PI / 180;
                if (dy < 0 || (Math.abs(dy) < 0.2 && s0.y < 0)) doc.text(corto(inv.nombre), cx + 0.6, cy - r - 0.6, { angle: 50 });
                else doc.text(corto(inv.nombre), cx - 0.6 - w * Math.cos(a), cy + r + 0.6 + w * Math.sin(a), { angle: 50 });
              } else {
                const al = Math.abs(dx) < 0.3 ? 'center' : dx > 0 ? 'left' : 'right';
                const tx = cx + dx * (r + 1.2), ty = Math.abs(dx) < 0.3 ? cy + (dy > 0 ? r + tam * 0.42 : -r - 0.8) : cy + tam * 0.14;
                doc.text(corto(inv.nombre), tx, ty, { align: al });
              }
            }
          });
          const nt = Math.max(7, Math.min(16, 34 * k * 2.83));
          font('r', nt); doc.text(String(m.numero ?? ''), X(m.x), Y(m.y) + (m.nombre ? -0.2 : nt * 0.17), { align: 'center' });
          if (m.nombre) { font('l', nt * 0.55, MUTED); doc.text(m.nombre, X(m.x), Y(m.y) + nt * 0.3, { align: 'center', maxWidth: (g.tipo === 'ellipse' ? g.rx * 2 : g.w) * k * 0.9 }); }
        });
        // leyenda
        font('l', 8, MUTED); let lx = M, ly = PH - 12;
        const pt = (col, txt) => { doc.setFillColor(...col); doc.circle(lx + 1.2, ly - 1, 1.2, 'F'); doc.text(txt, lx + 3.6, ly); lx += doc.getTextWidth(txt) + 9; };
        pt(AMBER, 'Alergia o dieta'); pt(BLUE, 'Menú infantil o trona');
        S.grupos.filter(g => vienen.some(i => i.grupo_id === g.id && i.mesa_id)).forEach(g => pt(hex(g.color), g.nombre));
      } else {
        font('l', 12, MUTED); doc.text('Todavía no hay mesas.', PW / 2, PH / 2, { align: 'center' });
      }
      pie();

      // ---------- 2. Mesas, una tarjeta por mesa ----------
      if (mesas.length) {
        const cols = 3, gap = 6, cw = (PW - 2 * M - gap * (cols - 1)) / cols, lh = 4.6;
        let col = 0, y0 = 0, fila = 0;
        const nueva = () => { cabecera('Mesas', 'Nombres, menús y alergias'); y0 = M + 22; col = 0; fila = 0; };
        nueva();
        const alto = m => 15 + Math.max(1, sentados(m).length) * lh + (sentados(m).some(i => alTxt(i) || menuTxt(i)) ? sentados(m).filter(i => alTxt(i) || menuTxt(i)).length * 3.6 : 0) + 6;
        const colsY = [y0, y0, y0];
        mesas.forEach(m => {
          const h = alto(m);
          let c = colsY.indexOf(Math.min(...colsY));
          if (colsY[c] + h > PH - 14) { pie(); nueva(); colsY.fill(y0); c = 0; }
          const x = M + c * (cw + gap), y = colsY[c];
          doc.setFillColor(255, 255, 255); doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.roundedRect(x, y, cw, h, 2.5, 2.5, 'FD');
          const ps = sentados(m);
          font('r', 12); doc.text('Mesa ' + (m.numero ?? ''), x + 5, y + 8);
          if (m.nombre) { const w = doc.getTextWidth('Mesa ' + (m.numero ?? '')); font('l', 12, MUTED); doc.text(' · ' + m.nombre, x + 5 + w, y + 8, { maxWidth: cw - 30 - w }); }
          const ad = ps.filter(i => i.edad === 'adulto').length, ni = ps.filter(i => i.edad === 'nino').length, be = ps.filter(i => i.edad === 'bebe').length;
          font('l', 8, MUTED); doc.text(`${ps.length}/${m.capacidad}`, x + cw - 5, y + 8, { align: 'right' });
          doc.text([ad + ' adultos', ni ? ni + ' infantil' : '', be ? be + (be === 1 ? ' trona' : ' tronas') : ''].filter(Boolean).join(' · '), x + 5, y + 12.5);
          let yy = y + 18.5;
          if (!ps.length) { font('l', 9, MUTED); doc.text('Sin invitados todavía', x + 5, yy); }
          ps.forEach(i => {
            doc.setFillColor(...hex(P.color(i))); doc.circle(x + 6, yy - 1.2, 1, 'F');
            font('l', 9.5); doc.text(i.nombre, x + 9, yy, { maxWidth: cw - 13 });
            yy += lh;
            const extra = [menuTxt(i), alTxt(i)].filter(Boolean).join(' · ');
            if (extra) { font('r', 7.8, alTxt(i) ? AMBER : BLUE); doc.text(extra, x + 9, yy - 1.2, { maxWidth: cw - 13 }); yy += 3.6; }
          });
          colsY[c] = y + h + gap;
        });
        pie();
      }

      // ---------- 3. Alergias y dietas ----------
      const conAl = vienen.filter(i => P.tieneDieta(i) || i.edad !== 'adulto').sort((a, b) => ((P.mesa(a.mesa_id) || {}).numero ?? 1e9) - ((P.mesa(b.mesa_id) || {}).numero ?? 1e9) || a.nombre.localeCompare(b.nombre, 'es'));
      cabecera('Alergias, dietas y menús especiales', `${vienen.filter(P.tieneDieta).length} con alergia o dieta · ${vienen.filter(i => i.edad === 'nino').length} ${vienen.filter(i => i.edad === 'nino').length === 1 ? 'infantil' : 'infantiles'} · ${vienen.filter(i => i.edad === 'bebe').length} ${vienen.filter(i => i.edad === 'bebe').length === 1 ? 'trona' : 'tronas'}`);
      let y = M + 26;
      const cX = [M, M + 22, M + 110, M + 150];
      const th = () => { font('r', 8.5, MUTED); ['Mesa', 'Nombre', 'Menú', 'Alergias y dieta'].forEach((t, i) => doc.text(t, cX[i], y)); y += 3; doc.setDrawColor(...LINE); doc.line(M, y, PW - M, y); y += 5; };
      th();
      if (!conAl.length) { font('l', 10, MUTED); doc.text('Nadie ha indicado alergias, dietas ni menús especiales.', M, y + 2); }
      conAl.forEach(i => {
        if (y > PH - 18) { pie(); cabecera('Alergias, dietas y menús especiales (sigue)'); y = M + 26; th(); }
        const m = P.mesa(i.mesa_id);
        font('r', 10); doc.text(m ? String(m.numero ?? '') : '—', cX[0], y);
        font('l', 10); doc.text(i.nombre, cX[1], y, { maxWidth: 84 });
        font('l', 10, MUTED); doc.text(menuTxt(i) || 'Adulto', cX[2], y);
        font('r', 10, AMBER); const t = doc.splitTextToSize(alTxt(i) || '—', PW - M - cX[3]); doc.text(t, cX[3], y);
        y += Math.max(1, t.length) * 4.6 + 2;
        doc.setDrawColor(236, 231, 221); doc.line(M, y - 3.6, PW - M, y - 3.6);
      });
      const sin = vienen.filter(i => !i.mesa_id);
      if (sin.length) {
        y += 6; if (y > PH - 30) { pie(); cabecera('Sin mesa asignada'); y = M + 26; }
        font('r', 11, INK); doc.text(`Sin mesa asignada (${sin.length})`, M, y); y += 6;
        font('l', 9.5, MUTED); const t = doc.splitTextToSize(sin.map(i => i.nombre).join(', '), PW - 2 * M); doc.text(t, M, y);
      }
      pie();

      doc.save('mesas-' + (S.boda.slug || 'boda') + '.pdf');
      P.toast('PDF descargado');
    } catch (err) {
      console.error(err);
      P.toast('No se ha podido crear el PDF', true);
    } finally { btn.disabled = false; }
  }
  window.PDF = { generar };
})();
