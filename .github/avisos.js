// Manda los avisos de pagos próximos a quienes los activaron en la versión web.
// Solo lee de Firestore el nombre y la fecha de los próximos pagos (sin montos).
const admin = require('firebase-admin');
const webpush = require('web-push');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA)) });
webpush.setVapidDetails('mailto:avisos@mispagos.app', process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);
const prueba = process.env.PRUEBA === 'true';
const hoyISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(new Date());
const dia = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
const cuando = d => d < 0 ? 'ya venció' : d === 0 ? 'vence hoy' : d === 1 ? 'vence mañana' : `vence en ${d} días`;
(async () => {
  const db = admin.firestore();
  const docs = await db.collection('avisos').get();
  let enviados = 0;
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
    try { await webpush.sendNotification(JSON.parse(a.sub), JSON.stringify(msg)); enviados++; }
    catch (e) { console.log('Error', doc.id, e.statusCode); if (e.statusCode === 404 || e.statusCode === 410) await doc.ref.update({ sub: admin.firestore.FieldValue.delete() }); }
  }
  console.log(`Avisos enviados: ${enviados}`);
})().catch(e => { console.error(e); process.exit(1); });
