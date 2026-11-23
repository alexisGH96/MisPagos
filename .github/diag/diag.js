const UA = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
const out = [];
const t = async (nom, url, f, h = {}) => { try { const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-MX', ...h }, signal: AbortSignal.timeout(20000) }); const b = Buffer.from(await r.arrayBuffer());
  out.push(`${nom}: ${r.status} ${r.headers.get('content-type')} disp=${r.headers.get('content-disposition')} len=${b.length} ${f ? f(b.toString('utf8')) : ''}`); } catch (e) { out.push(nom + ': ERROR ' + e.message.slice(0, 80)); } };
(async () => {
  await t('APK web.app', 'https://mispagos-bb986.web.app/MisPagos/android/descargar', null);
  await t('APK raw', 'https://raw.githubusercontent.com/alexisGH96/MisPagos/main/MisPagos.apk', null);
  await t('Costco sin origin', 'https://www.costco.com.mx/rest/v2/mexico/products/search?query=leche&fields=FULL&pageSize=3', tx => { try { const j = JSON.parse(tx); return (j.products || []).slice(0, 2).map(p => p.name + ' ' + (p.price || {}).value).join(' | '); } catch (e) { return tx.slice(0, 80); } });
  await t('Soriana', 'https://www.soriana.com/buscar?q=leche+entera', tx => { const m = tx.match(/data-gtmdata[^>]{0,400}/g) || []; const p = tx.match(/"price":\s*\{[^}]{0,120}/g) || tx.match(/class="sales"[\s\S]{0,200}/g) || []; return 'gtm=' + m.length + ' ' + (m[0] || '').slice(0, 220) + ' || ' + (p[0] || '').replace(/\s+/g, ' ').slice(0, 160); });
  await t('HEB search', 'https://www.heb.com.mx/leche?_q=leche&map=ft', tx => { const m = tx.match(/"Price":\s*[\d.]+/g) || tx.match(/"price":\s*[\d.]+/g) || []; return m.slice(0, 3).join(' ') + ' title=' + (tx.match(/<title>[^<]*/) || [''])[0]; });
  await t('HEB api2', 'https://www.heb.com.mx/api/catalog_system/pub/products/search/leche', tx => tx.slice(0, 60));
  await t('Chedraui', 'https://www.chedraui.com.mx/api/catalog_system/pub/products/search?ft=leche%20entera%201%20l&_from=0&_to=2', tx => JSON.parse(tx).map(p => p.productName + ' $' + p.items[0].sellers[0].commertialOffer.Price).join(' | '));
  await t('Sams', 'https://www.sams.com.mx/search?q=leche+entera', tx => { const n = tx.match(/"name":"[^"]{3,60}","[^"]*"[^}]{0,200}"price":[\d.]+/g) || []; return n.slice(0, 2).join(' || ').slice(0, 300); });
  console.log('::notice::' + out.join(' || ').replace(/\n/g, ' '));
})();
