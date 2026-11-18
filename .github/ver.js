// Verificación temporal (se borra al terminar): reglas de Firestore y restricción de la clave. Usa cuentas de prueba que se eliminan.
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA)) });
const KEY = 'AIzaSyAgWdj1dZ9olzq7tWN5IRDHMRYIru6EInE', P = 'mispagos-bb986';
const DOCS = `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents`;
const out = []; const log = s => out.push(s);
const sv = x => ({ stringValue: x }), iv = x => ({ integerValue: String(x) });
async function req(m, url, body, tok) { const r = await fetch(url, { method: m, headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}), body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch (e) {} return { s: r.status, j }; }
const creados = [];
async function usuario(email) {
  let u; try { u = await admin.auth().getUserByEmail(email); } catch (e) { u = await admin.auth().createUser({ email, emailVerified: true, password: 'Prueba-' + Math.random().toString(36).slice(2) }); }
  creados.push(u.uid);
  const ct = await admin.auth().createCustomToken(u.uid);
  const r = await req('POST', `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { token: ct, returnSecureToken: true });
  return { uid: u.uid, email, tok: r.j && r.j.idToken, ref: r.j && r.j.refreshToken, err: r.j && r.j.error && r.j.error.message, s: r.s };
}
const esp = (nombre, r, quiero) => log(`${(quiero === 'ok' ? r.s === 200 : r.s === 403) ? '✅' : '❌'} ${nombre}: ${r.s}${r.j && r.j.error ? ' ' + (r.j.error.status || '') : ''}`);
(async () => {
  const A = await usuario('prueba-a@mispagos-verificacion.test'), B = await usuario('prueba-b@mispagos-verificacion.test'), C = await usuario('prueba-c@mispagos-verificacion.test');
  log(`Inicio de sesión con la clave (Identity Toolkit): ${A.tok ? '✅ funciona' : '❌ ' + A.s + ' ' + A.err}`);
  const rt = await req('POST', `https://securetoken.googleapis.com/v1/token?key=${KEY}`, { grant_type: 'refresh_token', refresh_token: A.ref });
  log(`Renovar sesión con la clave (Token Service): ${rt.s === 200 ? '✅ funciona' : '❌ ' + rt.s + ' ' + JSON.stringify(rt.j).slice(0, 120)}`);
  for (const [n, u] of [['Translate', `https://translation.googleapis.com/language/translate/v2?key=${KEY}&q=hola&target=en`], ['YouTube', `https://www.googleapis.com/youtube/v3/videos?key=${KEY}&id=x&part=id`], ['Maps Geocoding', `https://maps.googleapis.com/maps/api/geocode/json?key=${KEY}&address=Monterrey`]]) {
    const r = await req('GET', u); const motivo = JSON.stringify(r.j || {}).match(/API_KEY_SERVICE_BLOCKED|SERVICE_DISABLED|API_KEY_INVALID|REQUEST_DENIED|PERMISSION_DENIED|not authorized[^"]*/);
    log(`Clave usada en ${n}: ${r.s} ${motivo ? motivo[0] : ''} ${motivo && /BLOCKED|not authorized/.test(motivo[0]) ? '✅ bloqueada por la restricción' : '⚠️ revisar'}`);
  }
  esp('Sin sesión, leer pagos compartidos (debe negarse)', await req('POST', DOCS + ':runQuery', { structuredQuery: { from: [{ collectionId: 'compartidos' }], limit: 1 } }), 'no');
  esp('Publicar mi perfil correcto', await req('PATCH', DOCS + '/usuarios/' + A.uid, { fields: { correo: sv(A.email), nombre: sv('Prueba A'), pub: sv('x'), telH: sv('a'.repeat(64)) } }, A.tok), 'ok');
  esp('Publicar perfil con el correo de OTRA persona (debe negarse)', await req('PATCH', DOCS + '/usuarios/' + A.uid, { fields: { correo: sv('alexisgalmich08@gmail.com'), nombre: sv('Falso'), pub: sv('x') } }, A.tok), 'no');
  esp('Publicar perfil con el teléfono tal cual (debe negarse)', await req('PATCH', DOCS + '/usuarios/' + A.uid, { fields: { correo: sv(A.email), nombre: sv('A'), pub: sv('x'), tel: sv('8100000000') } }, A.tok), 'no');
  esp('Escribir el perfil de otra cuenta (debe negarse)', await req('PATCH', DOCS + '/usuarios/' + B.uid, { fields: { correo: sv(A.email), nombre: sv('X'), pub: sv('x') } }, A.tok), 'no');
  const base = { nombre: sv('Prueba'), monto: sv('100'), vence: sv('2026-12-01'), frec: sv('M1'), parteCreador: iv(50), creadoPor: sv(A.uid), creadorNombre: sv('Prueba A'), creadorCorreo: sv(A.email), otroNombre: sv('Prueba B'), otroCorreo: sv(B.email), participantes: { arrayValue: { values: [sv(A.email), sv(B.email)] } }, estado: sv('pendiente'), solicitud: sv(''), actualizado: iv(Date.now()), autoRec: { booleanValue: true } };
  const c1 = await req('POST', DOCS + '/compartidos', { fields: base }, A.tok); esp('Compartir un pago normal', c1, 'ok');
  const id = c1.j && c1.j.name ? c1.j.name.split('/').pop() : null;
  esp('Compartir un pago con un campo raro (debe negarse)', await req('POST', DOCS + '/compartidos', { fields: Object.assign({}, base, { hack: sv('x') }) }, A.tok), 'no');
  esp('Compartir a nombre de otra persona (debe negarse)', await req('POST', DOCS + '/compartidos', { fields: Object.assign({}, base, { creadoPor: sv(B.uid) }) }, A.tok), 'no');
  esp('Compartir un nombre gigante (debe negarse)', await req('POST', DOCS + '/compartidos', { fields: Object.assign({}, base, { nombre: sv('x'.repeat(500)) }) }, A.tok), 'no');
  if (id) {
    esp('La otra persona lo ve', await req('GET', DOCS + '/compartidos/' + id, null, B.tok), 'ok');
    esp('Un extraño NO lo ve', await req('GET', DOCS + '/compartidos/' + id, null, C.tok), 'no');
    esp('La otra persona lo acepta', await req('PATCH', DOCS + '/compartidos/' + id + '?updateMask.fieldPaths=estado&updateMask.fieldPaths=actualizado', { fields: { estado: sv('aceptado'), actualizado: iv(Date.now()) } }, B.tok), 'ok');
    esp('La otra persona cambia el monto (debe negarse)', await req('PATCH', DOCS + '/compartidos/' + id + '?updateMask.fieldPaths=monto', { fields: { monto: sv('1') } }, B.tok), 'no');
    esp('Quien lo creó cambia el monto', await req('PATCH', DOCS + '/compartidos/' + id + '?updateMask.fieldPaths=monto&updateMask.fieldPaths=actualizado', { fields: { monto: sv('120'), actualizado: iv(Date.now()) } }, A.tok), 'ok');
    esp('La otra persona lo borra (debe negarse)', await req('DELETE', DOCS + '/compartidos/' + id, null, B.tok), 'no');
    esp('Quien lo creó lo borra', await req('DELETE', DOCS + '/compartidos/' + id, null, A.tok), 'ok');
  }
  esp('Escribir en el documento privado de otra persona (debe negarse)', await req('PATCH', DOCS + '/avisos/' + B.uid + '?updateMask.fieldPaths=sesionMin', { fields: { sesionMin: iv(1) } }, A.tok), 'no');
  esp('Escribir en mi documento privado (sesiones)', await req('PATCH', DOCS + '/avisos/' + A.uid + '?updateMask.fieldPaths=sesionMin', { fields: { sesionMin: iv(1) } }, A.tok), 'ok');
  // Estado de los perfiles reales (sin datos personales): ¿siguen con el teléfono sin cifrar?
  const us = await admin.firestore().collection('usuarios').get(); let viejo = 0, nuevo = 0;
  us.forEach(d => { if (creados.includes(d.id)) return; const f = d.data(); if (f.tel) viejo++; if (f.telH) nuevo++; });
  log(`Perfiles reales: ${us.size - 3 < 0 ? us.size : us.size - 3} · con teléfono sin cifrar (versión vieja): ${viejo} · con huella (versión nueva): ${nuevo}`);
  // limpieza
  for (const u of creados) { try { await admin.firestore().doc('usuarios/' + u).delete(); } catch (e) {} try { await admin.firestore().doc('avisos/' + u).delete(); } catch (e) {} try { await admin.auth().deleteUser(u); } catch (e) {} }
  log('Limpieza: cuentas y datos de prueba eliminados');
  for (let i = 0; i < out.length; i += 12) console.log('::notice::' + out.slice(i, i + 12).join(' %0A '));
  process.exit(0);
})().catch(async e => { console.log('::notice::ERROR ' + e.message); for (const u of creados) { try { await admin.auth().deleteUser(u); } catch (x) {} } process.exit(1); });
