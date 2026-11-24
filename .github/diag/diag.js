const admin = require('firebase-admin');
const sa = JSON.parse(process.env.FIREBASE_SA);
(async () => {
  const tok = (await admin.credential.cert(sa).getAccessToken()).access_token;
  const g = async u => { const r = await fetch(u, { headers: { Authorization: 'Bearer ' + tok, 'x-goog-user-project': sa.project_id } }); return r.status + ' ' + (await r.text()).replace(/\s+/g, ' ').slice(0, 700); };
  const out = [];
  out.push('config: ' + await g(`https://identitytoolkit.googleapis.com/admin/v2/projects/${sa.project_id}/config`));
  out.push('idps: ' + await g(`https://identitytoolkit.googleapis.com/admin/v2/projects/${sa.project_id}/defaultSupportedIdpConfigs`));
  const perms = ['firebaseauth.configs.update', 'firebaseauth.configs.get', 'clientauthconfig.clients.list', 'clientauthconfig.clients.create'];
  const r = await fetch(`https://cloudresourcemanager.googleapis.com/v1/projects/${sa.project_id}:testIamPermissions`, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions: perms }) });
  out.push('iam: ' + (await r.text()).replace(/\s+/g, ' '));
  console.log('::notice::' + out.join(' || ').replace(/"clientSecret":\s*"[^"]*"/g, '"clientSecret":"***"'));
})().catch(e => { console.log('::error::' + e.message); process.exit(1); });
