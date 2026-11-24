// Revisión de seguridad. El repositorio es PÚBLICO: solo se imprimen sí/no y conteos, nunca configuraciones ni datos.
const admin = require('firebase-admin'), fs = require('fs'), crypto = require('crypto');
const sa = JSON.parse(process.env.FIREBASE_SA); admin.initializeApp({ credential: admin.credential.cert(sa) });
const out = [];
(async () => {
  try { const r = await admin.securityRules().getFirestoreRuleset(); const pub = r.source[0].content.replace(/\s+/g, ' ').trim(), loc = fs.readFileSync('firestore.rules', 'utf8').replace(/\s+/g, ' ').trim();
    out.push('reglas publicadas = archivo: ' + (pub === loc ? 'SÍ' : 'NO (difieren)'));
    out.push('reglas exigen correo verificado: ' + (/email_verified == true/.test(pub) ? 'SÍ' : 'NO'));
    out.push('regla final que niega todo: ' + (/match \/\{todo=\*\*\} \{ allow read, write: if false; \}/.test(pub) ? 'SÍ' : 'NO'));
  } catch (e) { out.push('reglas: no se pudieron leer'); }
  try { const tok = (await admin.credential.cert(sa).getAccessToken()).access_token;
    const r = await fetch(`https://cloudresourcemanager.googleapis.com/v1/projects/${sa.project_id}:testIamPermissions`, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions: ['apikeys.keys.list', 'apikeys.keys.update', 'firebaseappcheck.services.update'] }) });
    const j = await r.json(); out.push('permisos del robot: ' + ((j.permissions || []).join(', ') || 'ninguno de llaves/App Check'));
  } catch (e) { out.push('permisos: error'); }
  console.log('::notice::' + out.join(' || '));
})();
// v2
// v3
