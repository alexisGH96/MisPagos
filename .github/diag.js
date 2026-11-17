// Diagnóstico de solo lectura (temporal): pagos compartidos entre Alexis y Gaby.
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA)) });
const out = s => console.log('::notice::' + String(s).replace(/\n/g, ' '));
(async () => {
  const db = admin.firestore();
  const yo = 'alexisgalmich08@gmail.com';
  const us = await db.collection('usuarios').get();
  const usuarios = {};
  us.forEach(d => { const u = d.data(); usuarios[d.id] = u; });
  const mios = Object.entries(usuarios).filter(([k, u]) => String(u.correo || '').toLowerCase() === yo);
  out(`USUARIOS total=${us.size} · cuentas con mi correo=${mios.length} ${mios.map(([k, u]) => k.slice(0, 6) + ' tel=' + (u.tel ? 'sí' : 'no') + ' nombre=' + (u.nombre || '')).join(' | ')}`);
  const gabys = Object.entries(usuarios).filter(([k, u]) => /gab/i.test(u.nombre || '') || /gab/i.test(u.correo || ''));
  gabys.forEach(([k, u]) => out(`GABY? uid=${k.slice(0, 6)} correo=${u.correo} nombre=${u.nombre} tel=${u.tel ? 'sí' : 'no'} campos=${Object.keys(u).join(',')}`));
  const conmigo = await db.collection('compartidos').where('participantes', 'array-contains', yo).get();
  out(`DOCS conmigo (correo exacto en minúsculas) = ${conmigo.size}`);
  const filas = [];
  conmigo.forEach(d => { const f = d.data(); filas.push({ t: d.createTime.toDate(), s: `${d.id.slice(0, 6)} · ${f.estado || '(sin estado)'} · ${f.nombre} · de ${f.creadorNombre} <${f.creadorCorreo || ''}> → ${f.otroNombre} <${f.otroCorreo}> · part=${JSON.stringify(f.participantes)} · creado ${d.createTime.toDate().toISOString().slice(0, 16)} · act ${f.actualizado ? new Date(f.actualizado).toISOString().slice(0, 16) : '-'}` }); });
  filas.sort((a, b) => b.t - a.t).slice(0, 25).forEach(x => out(x.s));
  // docs creados por cuentas de Gaby (a cualquiera), por si el correo de Alexis quedó distinto
  for (const [k] of gabys) {
    const q = await db.collection('compartidos').where('creadoPor', '==', k).get();
    out(`DOCS creados por ${k.slice(0, 6)} = ${q.size}`);
    const fs = []; q.forEach(d => { const f = d.data(); fs.push({ t: d.createTime.toDate(), s: `  ${d.id.slice(0, 6)} · ${f.estado} · ${f.nombre} → ${f.otroNombre} <${f.otroCorreo}> · part=${JSON.stringify(f.participantes)} · creado ${d.createTime.toDate().toISOString().slice(0, 16)}` }); });
    fs.sort((a, b) => b.t - a.t).slice(0, 15).forEach(x => out(x.s));
  }
  process.exit(0);
})().catch(e => { out('ERROR ' + e.message); process.exit(1); });
