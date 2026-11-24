// Diagnóstico sin datos personales (el repositorio es público): solo fechas e indicadores.
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA)) });
(async () => {
  const out = []; const desde = Date.now() - 3 * 86400e3; let total = 0;
  let tok; do { const r = await admin.auth().listUsers(1000, tok); tok = r.pageToken;
    for (const u of r.users) { total++; const t = Date.parse(u.metadata.creationTime); if (t < desde) continue;
      const d = await admin.firestore().collection('usuarios').doc(u.uid).get(); const f = d.exists ? d.data() : {};
      const comp = await admin.firestore().collection('compartidos').where('para', '==', (u.email || '').toLowerCase()).get().catch(() => null);
      out.push(`creada ${u.metadata.creationTime} · ultimoAcceso ${u.metadata.lastSignInTime} · verificado=${u.emailVerified} · perfil=${d.exists} · telH=${!!f.telH} · nombre=${!!f.nombre} · pub=${!!f.pub} · compartidosParaEl=${comp ? comp.size : '?'}`); } } while (tok);
  console.log('::notice::Cuentas totales ' + total + ' || ' + (out.join(' || ') || 'ninguna nueva en 3 días'));
  const c = await admin.firestore().collection('compartidos').limit(1).get(); if (!c.empty) console.log('::notice::campos de compartidos: ' + Object.keys(c.docs[0].data()).join(','));
})().catch(e => { console.log('::error::' + e.message); process.exit(1); });
