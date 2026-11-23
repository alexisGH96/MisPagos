// Avisos push para quienes usan la versión web (iPhone):
//  - 9:00 a.m.: pagos próximos a vencer (solo nombre y fecha, sin montos) y avisos de corte (día del corte y día siguiente).
//  - cada 15 min: avisos de pagos compartidos ("ya pagué mi parte", confirmaciones y recordatorios).
const admin = require('firebase-admin');
const webpush = require('web-push');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA)) });
webpush.setVapidDetails('mailto:avisos@mispagos.app', process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);
const prueba = process.env.PRUEBA === 'true';
// 13.9: GitHub corre el robot pocas veces al día (a veces se salta la corrida de las 9:00), así que lo diario lo hace
// la PRIMERA corrida después de las 9:00 de Monterrey; la fecha queda en robot/estado para no repetirlo ese día.
const horaMty = +new Intl.DateTimeFormat('en-US', { timeZone: 'America/Monterrey', hour: 'numeric', hour12: false }).format(new Date()) % 24;
let diario = prueba || process.env.EVENTO === 'workflow_dispatch';
const hoyISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(new Date());
const dia = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
const cuando = d => d < 0 ? 'ya venció' : d === 0 ? 'vence hoy' : d === 1 ? 'vence mañana' : `vence en ${d} días`;
const sinPrefijo = n => String(n || '').replace(/^Pagar |^Pago /, '');
(async () => {
  const db = admin.firestore();
  let enviados = 0;
  const mandar = async (ref, sub, msg) => {
    try { await webpush.sendNotification(JSON.parse(sub), JSON.stringify(msg)); enviados++; return true; }
    catch (e) { console.log('Error', ref.id, e.statusCode); if (e.statusCode === 404 || e.statusCode === 410) await ref.update({ sub: admin.firestore.FieldValue.delete() }); return false; }
  };
  // ---- 1) pagos compartidos: avisos nuevos (de las últimas 6 horas) ----
  try {
    const desde = Date.now() - 6 * 3600 * 1000;
    const docs = await db.collection('compartidos').where('actualizado', '>', desde).get();
    const subDe = async correo => {   // aviso push de la persona con ese correo (si lo activó en su iPhone)
      if (!correo) return null;
      const us = await db.collection('usuarios').where('correo', '==', String(correo).toLowerCase()).limit(1).get();
      if (us.empty) return null;
      const av = await db.collection('avisos').doc(us.docs[0].id).get();
      return av.exists && av.data().sub ? av : null;
    };
    for (const d of docs.docs) {
      const f = d.data(); let ro = null;
      const nom0 = sinPrefijo(f.nombre);
      // a) pago compartido NUEVO: aviso a quien lo recibe (antes solo llegaba al abrir la app)
      if ((f.estado || '') === 'pendiente' && !f.pushInv) {
        await d.ref.update({ pushInv: true });
        const av = await subDe(f.otroCorreo);
        if (av) {
          const total = parseFloat(String(f.monto || '').replace(/[^0-9.]/g, '')) || 0;
          const parte = total * (100 - (Number(f.parteCreador) || 50)) / 100;
          await mandar(av.ref, av.data().sub, { title: `${f.creadorNombre || 'Alguien'} compartió un pago contigo`, body: `${nom0}${parte > 0 ? ': te toca $' + parte.toLocaleString('es-MX', { maximumFractionDigits: 2 }) : ''}. Ábrelo en Mis Pagos para aceptarlo.` });
        }
      }
      // b) aceptado o rechazado: aviso a quien lo creó (solo para pagos que ya pasaron por (a), así no se repiten los viejos)
      if (f.pushInv && (f.estado === 'aceptado' || f.estado === 'rechazado') && f.pushEst !== f.estado) {
        await d.ref.update({ pushEst: f.estado });
        const av = await subDe(f.creadorCorreo);
        const otro = f.otroNombre || f.otroCorreo || 'La otra persona';
        if (av) await mandar(av.ref, av.data().sub, f.estado === 'aceptado' ? { title: `${otro} aceptó el pago compartido`, body: `${nom0}: ya le toca su parte.` } : { title: `${otro} rechazó el pago compartido`, body: `Revisa ${nom0} en Mis Pagos.` });
      }
      // c) solicitud de cambio: aviso a quien lo creó
      if (f.solicitud && f.solicitud !== (f.pushSol || '')) {
        await d.ref.update({ pushSol: f.solicitud });
        let so = {}; try { so = JSON.parse(f.solicitud); } catch (e) { }
        const av = await subDe(f.creadorCorreo);
        if (av) await mandar(av.ref, av.data().sub, { title: `${so.de || f.otroNombre || 'La otra persona'} pide un cambio en ${nom0}`, body: 'Ábrelo en Mis Pagos para aprobarlo o rechazarlo.' });
      }
      try { ro = JSON.parse(f.recordatorio || 'null'); } catch (e) { }
      if (!ro || !ro.t || ro.t <= (f.pushT || 0)) continue;
      const para = (f.participantes || []).find(c => c && c.toLowerCase() !== String(ro.deCorreo || '').toLowerCase());
      await d.ref.update({ pushT: ro.t });   // aunque no tenga avisos activados, no se vuelve a revisar
      if (!para) continue;
      const us = await db.collection('usuarios').where('correo', '==', para.toLowerCase()).limit(1).get();
      if (us.empty) continue;
      const av = await db.collection('avisos').doc(us.docs[0].id).get();
      if (!av.exists || !av.data().sub) continue;
      const nom = sinPrefijo(f.nombre);
      const msg = ro.tipo === 'pagueParte' ? { title: `${ro.de} ya te pagó su parte`, body: `${nom}: ábrelo en Mis Pagos para confirmar que lo recibiste.` }
        : ro.tipo === 'parteOk' ? { title: `${ro.de} confirmó tu pago`, body: `${nom} ya aparece como pagado.` }
        : ro.tipo === 'confirmar' ? { title: `${ro.de} te pide confirmar un pago`, body: ro.msg || nom }
        : { title: `${ro.de} te recuerda un pago`, body: ro.msg || nom };
      await mandar(av.ref, av.data().sub, msg);
    }
  } catch (e) { console.log('Compartidos:', e.message); }
  // ---- 2) una vez al día: pagos por vencer ----
  const estadoRef = db.collection('robot').doc('estado');
  if (!diario && horaMty >= 9) { try { const es = await estadoRef.get(); diario = !es.exists || es.data().diario !== hoyISO; } catch (e) { diario = process.env.HORARIO === '0 15 * * *'; } }
  if (diario && !prueba) { try { await estadoRef.set({ diario: hoyISO, t: Date.now() }, { merge: true }); } catch (e) { } }
  if (diario) {
    // 2a) recordatorio automático a quien comparte un pago contigo: 2 días antes, 1 día antes y el día límite
    try {
      const todos = await db.collection('compartidos').where('estado', '==', 'aceptado').get();
      for (const d of todos.docs) {
        const f = d.data();
        if (!f.vence || f.autoRec === false || !f.otroCorreo) continue;
        const dd = dia(f.vence) - dia(hoyISO); if (dd < 0 || dd > 2) continue;
        const clave = f.vence + ':' + dd; if ((f.autoT || '') === clave) continue;
        let ro = null; try { ro = JSON.parse(f.recordatorio || 'null'); } catch (e) { }
        if (ro && (ro.tipo === 'pagueParte' || ro.tipo === 'parteOk') && ro.v === f.vence) continue;   // ya pagó su parte de este periodo
        const total = parseFloat(String(f.monto || '').replace(/[^0-9.]/g, '')) || 0;
        const fijo = parseFloat(String(f.fijoCreador || '').replace(/[^0-9.]/g, '')) || 0;
        const otra = total > 0 ? (fijo > 0 ? Math.max(0, total - fijo) : total * (100 - (Number(f.parteCreador) || 50)) / 100) : 0;
        const nom = sinPrefijo(f.nombre);
        const [yy, mm, dd0] = f.vence.split('-').map(Number);
        const fecha = dd0 + ' ' + ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][mm - 1];
        // 13.5.1: es automático, así que NO se presenta como si lo mandara quien creó el pago (antes decía
        // "Gabriela te recuerda un pago" y saludaba con el correo). Va firmado por Mis Pagos y sin saludo.
        const vence = dd === 0 ? 'vence hoy' : dd === 1 ? 'vence mañana' : 'vence en 2 días';
        const msg = `${nom} ${vence} (${fecha}).${otra > 0 ? ' Te toca $' + otra.toLocaleString('es-MX', { maximumFractionDigits: 2 }) + '.' : ''}${f.creadorNombre ? ' Pago compartido con ' + f.creadorNombre + '.' : ''}`;
        const t = Date.now(), rec = { de: 'Mis Pagos', deNombre: f.creadorNombre || '', deCorreo: f.creadorCorreo || '', msg, t, tipo: 'auto', v: f.vence };
        await d.ref.update({ recordatorio: JSON.stringify(rec), autoT: clave, pushT: t, actualizado: t });   // en Android le llega al sincronizar
        const us = await db.collection('usuarios').where('correo', '==', String(f.otroCorreo).toLowerCase()).limit(1).get();
        if (us.empty) continue;
        const av = await db.collection('avisos').doc(us.docs[0].id).get();
        if (av.exists && av.data().sub) await mandar(av.ref, av.data().sub, { title: `Recordatorio: ${nom} ${vence}`, body: msg });
      }
    } catch (e) { console.log('Recordatorios automáticos:', e.message); }
    const docs = await db.collection('avisos').get();
    for (const doc of docs.docs) {
      const a = doc.data();
      if (!a.sub) continue;
      let msg = null;
      if (prueba) msg = { title: 'Mis Pagos', body: 'Prueba: los avisos ya funcionan en este iPhone ✓' };
      else {
        // 13.8.4: avisos de corte (el día del corte y al día siguiente, por la mañana)
        try {
          const [hy, hm, hd] = hoyISO.split('-').map(Number);
          const corteEn = (y, m, c) => Math.min(c, new Date(Date.UTC(y, m, 0)).getUTCDate());   // m: 1-12
          const ayer = new Date(Date.UTC(hy, hm - 1, hd - 1)), ay = ayer.getUTCFullYear(), am = ayer.getUTCMonth() + 1, ad = ayer.getUTCDate();
          for (const k of (a.cortes || [])) {
            const c = +k.c; if (!c || !k.n) continue;
            const lim = k.v ? (() => { const [y, m, d] = k.v.split('-').map(Number); return `${d} de ${['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][m - 1]}`; })() : '';
            if (corteEn(hy, hm, c) === hd)
              await mandar(doc.ref, a.sub, { title: `Hoy es la fecha de corte de ${k.n}`, body: `Es posible que tu banco todavía no lo refleje: normalmente lo procesa en el transcurso del día. Mañana te recordamos actualizar el monto.${lim ? ' Fecha límite: ' + lim + '.' : ''}` });
            else if (corteEn(ay, am, c) === ad)
              await mandar(doc.ref, a.sub, { title: `${k.n} ya hizo su corte`, body: k.a ? 'Pide a quien lo creó que actualice el monto a pagar en Mis Pagos.' : `Abre Mis Pagos y actualiza el monto a pagar${lim ? ' antes del ' + lim : ''}.` });
          }
        } catch (e) { console.log('Avisos de corte:', e.message); }
        const lista = (a.proximos || []).map(p => ({ n: p.n, d: dia(p.v) - dia(hoyISO) })).filter(p => p.d <= 3 && p.d >= -3).sort((x, y) => x.d - y.d);
        if (!lista.length) continue;
        msg = lista.length === 1 ? { title: `${lista[0].n} ${cuando(lista[0].d)}`, body: 'Toca para abrir Mis Pagos y marcarlo cuando lo pagues.' }
          : { title: `Tienes ${lista.length} pagos por vencer`, body: lista.map(p => `${p.n} (${cuando(p.d)})`).join(' · ') };
      }
      await mandar(doc.ref, a.sub, msg);
    }
  }
  console.log(`Avisos enviados: ${enviados}`);
})().catch(e => { console.error(e); process.exit(1); });
