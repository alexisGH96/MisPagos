// 13.9: copia de la web en Firebase Hosting (https://mispagos-bb986.web.app/MisPagos/...), la red de Google.
// Así el enlace de invitación abre aunque una red bloquee github.io. Corre solo cuando cambian la web o el APK.
const admin = require('firebase-admin'), fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const sa = JSON.parse(process.env.FIREBASE_SA), SITE = 'mispagos-bb986', API = 'https://firebasehosting.googleapis.com/v1beta1';
(async () => {
  const tok = (await admin.credential.cert(sa).getAccessToken()).access_token;
  const pedir = async (m, url, body, tipo) => { const r = await fetch(url, { method: m, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': tipo || 'application/json' }, body: tipo ? body : body && JSON.stringify(body) });
    const t = await r.text(); if (!r.ok) throw new Error(m + ' ' + url.replace(/https:\/\/[^/]+/, '') + ' → ' + r.status + ' ' + Buffer.from(t.slice(0, 400)).toString('base64')); return t ? JSON.parse(t) : {}; };
  // archivos: /MisPagos/web/* , /MisPagos/MisPagos.apk , /MisPagos/version.json (mismas rutas que en github.io)
  const lista = []; for (const f of fs.readdirSync('web')) if (fs.statSync(path.join('web', f)).isFile()) lista.push(['web/' + f, '/MisPagos/web/' + f]);
  for (const f of ['version.json'])   // el APK no: el plan gratuito de Firebase no permite archivos ejecutables (se descarga de GitHub)
  if (fs.existsSync(f)) lista.push([f, '/MisPagos/' + f]);
  // 13.10.1: el APK sin extensión (el plan gratuito rechaza archivos .apk); se descarga como MisPagos.apk por los encabezados
  if (fs.existsSync('MisPagos.apk')) lista.push(['MisPagos.apk', '/MisPagos/android/descargar']);
  const gz = {}, mapa = {};
  for (const [loc, ruta] of lista) { const z = zlib.gzipSync(fs.readFileSync(loc), { level: 9 }); const h = crypto.createHash('sha256').update(z).digest('hex'); gz[h] = z; mapa[ruta] = h; }
  const ver = await pedir('POST', `${API}/sites/${SITE}/versions`, { config: {
    redirects: [{ glob: '/', location: '/MisPagos/web/', statusCode: 302 }, { glob: '/MisPagos', location: '/MisPagos/web/', statusCode: 302 }, { glob: '/MisPagos/', location: '/MisPagos/web/', statusCode: 302 }],
    headers: [{ glob: '/MisPagos/android/descargar', headers: { 'Content-Type': 'application/vnd.android.package-archive', 'Content-Disposition': 'attachment; filename="MisPagos.apk"', 'Cache-Control': 'no-cache' } }, { glob: '**/sw.js', headers: { 'Cache-Control': 'no-cache' } }, { glob: '**/*.html', headers: { 'Cache-Control': 'no-cache' } }, { glob: '**/*.json', headers: { 'Cache-Control': 'no-cache' } }] } });
  const pop = await pedir('POST', `${API}/${ver.name}:populateFiles`, { files: mapa });
  for (const h of pop.uploadRequiredHashes || []) await pedir('POST', `${pop.uploadUrl}/${h}`, gz[h], 'application/octet-stream');
  await pedir('PATCH', `${API}/${ver.name}?update_mask=status`, { status: 'FINALIZED' });
  await pedir('POST', `${API}/sites/${SITE}/releases?versionName=${encodeURIComponent(ver.name)}`, { message: process.env.MSG || 'web' });
  console.log(`::notice::Hosting publicado: ${lista.length} archivos (${(pop.uploadRequiredHashes || []).length} subidos) · https://${SITE}.web.app/MisPagos/web/`);
})().catch(e => { console.log('::error::' + e.message); process.exit(1); });
