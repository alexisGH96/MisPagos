// Avisos push para quienes usan la versión web (iPhone):
//  - 9:00 a.m.: pagos próximos a vencer (solo nombre y fecha, sin montos).
//  - cada 15 min: avisos de pagos compartidos ("ya pagué mi parte", confirmaciones y recordatorios).
const admin = require('firebase-admin');
const webpush = require('web-push');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA)) });
webpush.setVapidDetails('mailto:avisos@mispagos.app', process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);
const prueba = process.env.PRUEBA === 'true';
const diario = prueba || process.env.HORARIO === '0 15 * * *' || process.env.EVENTO === 'workflow_dispatch';
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
    for (const d of docs.docs) {
      const f = d.data(); let ro = null;
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
  if (diario) {
    const docs = await db.collection('avisos').get();
    for (const doc of docs.docs) {
      const a = doc.data();
      if (!a.sub) continue;
      let msg = null;
      if (prueba) msg = { title: 'Mis Pagos', body: 'Prueba: los avisos ya funcionan en este iPhone ✓' };
      else {
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
