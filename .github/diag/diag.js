const admin = require('firebase-admin');
const sa = JSON.parse(process.env.FIREBASE_SA);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const out = [];
(async () => {
  out.push('SA: ' + sa.client_email + ' proyecto ' + sa.project_id);
  try { const r = await admin.securityRules().getFirestoreRuleset(); out.push('LEER reglas OK: ' + r.name + ' (' + r.source[0].content.length + ' car)'); }
  catch (e) { out.push('LEER reglas ERROR: ' + e.message); }
  try {
    const tok = (await admin.credential.cert(sa).getAccessToken()).access_token;
    const perms = ['firebaserules.rulesets.create','firebaserules.releases.update','firebaserules.releases.create','firebasehosting.sites.get','firebasehosting.sites.update','firebasehosting.sites.create','datastore.entities.create'];
    const r = await fetch(`https://cloudresourcemanager.googleapis.com/v1/projects/${sa.project_id}:testIamPermissions`, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions: perms }) });
    out.push('IAM ' + r.status + ': ' + (await r.text()).replace(/\s+/g, ' ').slice(0, 600));
    const h = await fetch(`https://firebasehosting.googleapis.com/v1beta1/projects/${sa.project_id}/sites`, { headers: { Authorization: 'Bearer ' + tok } });
    out.push('HOSTING ' + h.status + ': ' + (await h.text()).replace(/\s+/g, ' ').slice(0, 400));
  } catch (e) { out.push('IAM/HOSTING ERROR: ' + e.message); }
  try { const g = await fetch('https://alexisgh96.github.io/MisPagos/web/invitar.html'); out.push('github.io desde GitHub: ' + g.status + ' ' + (await g.text()).length + ' bytes'); } catch (e) { out.push('github.io ERROR ' + e.message); }
  console.log('::notice::' + out.join(' || ').replace(/\n/g, ' '));
})();
