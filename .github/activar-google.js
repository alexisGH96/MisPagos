// 13.11: lee el id de cliente de Google (público: va en las páginas) y lo deja en web/auth.json; agrega github.io a los
// dominios autorizados. NO imprime nada más (los registros de Actions de este repositorio son públicos).
const admin = require('firebase-admin'), fs = require('fs');
const sa = JSON.parse(process.env.FIREBASE_SA), P = sa.project_id, API = 'https://identitytoolkit.googleapis.com/admin/v2/projects/' + P;
(async () => {
  const tok = (await admin.credential.cert(sa).getAccessToken()).access_token;
  const h = { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', 'x-goog-user-project': P };
  const g = await (await fetch(API + '/defaultSupportedIdpConfigs/google.com', { headers: h })).json();
  if (!g.enabled || !g.clientId) { console.log('::error::Google no está habilitado'); process.exit(1); }
  fs.writeFileSync('web/auth.json', JSON.stringify({ googleClientId: g.clientId }));
  const c = await (await fetch(API + '/config', { headers: h })).json();
  const dom = c.authorizedDomains || [];
  let agregado = false;
  for (const d of ['alexisgh96.github.io', 'mispagos-bb986.web.app']) if (!dom.includes(d)) { dom.push(d); agregado = true; }
  if (agregado) { const r = await fetch(API + '/config?updateMask=authorizedDomains', { method: 'PATCH', headers: h, body: JSON.stringify({ authorizedDomains: dom }) }); console.log('dominios: ' + r.status); }
  console.log('::notice::Google activado. Cliente: ' + g.clientId + ' · dominios autorizados: ' + dom.length);
})().catch(e => { console.log('::error::' + e.message); process.exit(1); });
