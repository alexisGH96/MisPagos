const KEY = 'AIzaSyAgWdj1dZ9olzq7tWN5IRDHMRYIru6EInE';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const out = [];
const t = async (nom, url, extra = {}) => {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json,text/html', 'Origin': 'https://mispagos-bb986.web.app', ...(extra.h || {}) }, method: extra.m || 'GET', body: extra.b, signal: AbortSignal.timeout(20000) });
    const tx = await r.text();
    let info = '';
    if (extra.precio) { try { info = extra.precio(tx); } catch (e) { info = 'parse:' + e.message.slice(0, 60); } }
    out.push(`${nom}: ${r.status} ${(r.headers.get('content-type') || '').slice(0, 25)} len=${tx.length} cors=${r.headers.get('access-control-allow-origin') || '-'} ${info} ${r.status >= 400 ? tx.slice(0, 120).replace(/\s+/g, ' ') : ''}`);
  } catch (e) { out.push(`${nom}: ERROR ${e.message.slice(0, 80)}`); }
};
const vtex = tx => { const a = JSON.parse(tx); return a.length + ' prod; ' + a.slice(0, 2).map(p => p.productName + ' $' + p.items[0].sellers[0].commertialOffer.Price).join(' | '); };
(async () => {
  for (const ref of ['https://mispagos-bb986.web.app/', 'https://alexisgh96.github.io/']) await t('auth ' + ref, `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${KEY}`, { m: 'POST', h: { 'Content-Type': 'application/json', Referer: ref, Origin: ref.slice(0, -1) }, b: JSON.stringify({ email: 'nadie@ejemplo.com', password: 'xxxxxx1', returnSecureToken: true }) });
  await t('HEB vtex', 'https://www.heb.com.mx/api/catalog_system/pub/products/search?ft=leche&_from=0&_to=4', { precio: vtex });
  await t('Chedraui vtex', 'https://www.chedraui.com.mx/api/catalog_system/pub/products/search?ft=leche&_from=0&_to=4', { precio: vtex });
  await t('LaComer vtex', 'https://www.lacomer.com.mx/api/catalog_system/pub/products/search?ft=leche&_from=0&_to=4', { precio: vtex });
  await t('Soriana vtex', 'https://www.soriana.com/api/catalog_system/pub/products/search?ft=leche&_from=0&_to=4', { precio: vtex });
  await t('Soriana html', 'https://www.soriana.com/buscar?q=leche', { precio: tx => (tx.match(/"price"\s*:\s*"?[\d.]+/g) || []).slice(0, 2).join(' ') });
  await t('Walmart html', 'https://super.walmart.com.mx/search?q=leche', { precio: tx => (tx.match(/"price"\s*:\s*[\d.]+/g) || []).slice(0, 2).join(' ') });
  await t('Aurrera html', 'https://despensa.bodegaaurrera.com.mx/search?q=leche', { precio: tx => (tx.match(/"price"\s*:\s*[\d.]+/g) || []).slice(0, 2).join(' ') });
  await t('Costco occ', 'https://www.costco.com.mx/rest/v2/mexico/products/search?query=leche&fields=FULL&pageSize=3', { precio: tx => { const j = JSON.parse(tx); return (j.products || []).slice(0, 2).map(p => p.name + ' ' + (p.price || {}).formattedValue).join(' | '); } });
  await t('Sams html', 'https://www.sams.com.mx/search?q=leche', { precio: tx => (tx.match(/"price"\s*:\s*[\d.]+/g) || []).slice(0, 2).join(' ') });
  await t('CityMarket vtex', 'https://www.citymarket.com.mx/api/catalog_system/pub/products/search?ft=leche&_from=0&_to=4', { precio: vtex });
  await t('Fresko vtex', 'https://www.fresko.com.mx/api/catalog_system/pub/products/search?ft=leche&_from=0&_to=4', { precio: vtex });
  await t('HEB io', 'https://www.heb.com.mx/api/io/_v/api/intelligent-search/product_search/?query=leche&count=3', { precio: tx => { const j = JSON.parse(tx); return (j.products || []).length + ' prod'; } });
  console.log('::notice::' + out.join(' || ').replace(/\n/g, ' '));
})();
