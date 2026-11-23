// 13.10.2: precios de referencia del súper (Chedraui, API pública de su tienda en línea) para los artículos comunes.
// Corre una vez al día y deja web/super.json, que la app y la web leen. Sin datos de nadie: solo artículos genéricos.
const fs = require('fs');
// artículo → [búsqueda, palabras que debe tener el nombre del producto]
const A = {
  'Leche': ['leche entera 1 l', ['leche', 'entera', '1l']], 'Huevo': ['huevo blanco 18 piezas', ['huevo', '18']], 'Tortillas': ['tortilla de maiz', ['tortilla']],
  'Pan de caja': ['pan blanco grande', ['pan', 'blanco']], 'Bolillo': ['bolillo', ['bolillo']], 'Frijol': ['frijol 1 kg', ['frijol', '1kg']], 'Arroz': ['arroz 1 kg', ['arroz', '1kg']],
  'Azúcar': ['azucar 2 kg', ['azucar']], 'Café': ['cafe soluble', ['cafe']], 'Aceite': ['aceite vegetal 1 l', ['aceite']], 'Sal': ['sal de mesa', ['sal']],
  'Pasta para sopa': ['pasta para sopa', ['pasta']], 'Atún': ['atun en agua', ['atun']], 'Jamón': ['jamon de pavo', ['jamon']], 'Queso': ['queso panela', ['queso']],
  'Crema': ['crema acida', ['crema']], 'Yogur': ['yoghurt bebible', ['yog']], 'Mantequilla': ['mantequilla', ['mantequilla']], 'Pollo': ['pechuga de pollo', ['pollo']],
  'Carne molida': ['carne molida de res', ['molida']], 'Bistec': ['bistec de res', ['bistec']], 'Chuleta': ['chuleta de cerdo', ['chuleta']],
  'Jitomate': ['jitomate saladet', ['jitomate']], 'Cebolla': ['cebolla blanca', ['cebolla']], 'Chile': ['chile serrano', ['chile']], 'Papa': ['papa blanca', ['papa']],
  'Zanahoria': ['zanahoria', ['zanahoria']], 'Limón': ['limon', ['limon']], 'Aguacate': ['aguacate hass', ['aguacate']], 'Plátano': ['platano tabasco', ['platano']],
  'Manzana': ['manzana roja', ['manzana']], 'Naranja': ['naranja', ['naranja']], 'Cilantro': ['cilantro', ['cilantro']], 'Lechuga': ['lechuga romana', ['lechuga']],
  'Agua': ['agua natural 1 l', ['agua']], 'Refresco': ['refresco cola 3 l', ['refresco']], 'Jugo': ['jugo de naranja 1 l', ['jugo']], 'Cereal': ['cereal de maiz', ['cereal']],
  'Galletas': ['galletas marias', ['galleta']], 'Avena': ['avena', ['avena']], 'Harina': ['harina de trigo 1 kg', ['harina']], 'Salsa': ['salsa picante', ['salsa']],
  'Mayonesa': ['mayonesa', ['mayonesa']], 'Catsup': ['catsup', ['catsup']], 'Papel de baño': ['papel higienico', ['papel', 'higienico']], 'Servilletas': ['servilletas', ['servilleta']],
  'Jabón para trastes': ['lavatrastes liquido', ['lavatrastes']], 'Detergente': ['detergente en polvo', ['detergente']], 'Suavizante': ['suavizante de telas', ['suavizante']],
  'Cloro': ['cloro', ['cloro']], 'Shampoo': ['shampoo', ['shampoo']], 'Jabón de baño': ['jabon de tocador', ['jabon']], 'Pasta de dientes': ['pasta dental', ['pasta', 'dental']],
  'Desodorante': ['desodorante', ['desodorante']], 'Pañales': ['panales etapa 4', ['pañal']], 'Croquetas': ['croquetas para perro', ['croqueta']],
  'Bolsas de basura': ['bolsas para basura', ['bolsa']], 'Aluminio': ['papel aluminio', ['aluminio']]};
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/(\d)\s+(l|kg|g|ml|pzas?|piezas)\b/g, '$1$2');
const espera = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const out = {fuente: 'Chedraui en línea', fecha: new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Monterrey'}).format(new Date()), art: {}};
  let ok = 0;
  for (const [n, [q, req]] of Object.entries(A)) {
    try {
      const r = await fetch('https://www.chedraui.com.mx/api/catalog_system/pub/products/search?ft=' + encodeURIComponent(q) + '&_from=0&_to=19', {headers: {'User-Agent': 'Mozilla/5.0 (Linux; Android 15) Chrome/131.0 Mobile', 'Accept': 'application/json'}, signal: AbortSignal.timeout(20000)});
      const a = JSON.parse(await r.text());
      const prods = a.map(p => ({n: p.productName, p: +((((p.items || [])[0] || {}).sellers || [])[0] || {commertialOffer: {}}).commertialOffer.Price || 0, d: (((p.items || [])[0] || {}).sellers || [])[0]?.commertialOffer?.AvailableQuantity > 0}))
        .filter(x => x.p > 0 && x.d !== false && req.map(norm).every(w => norm(x.n).replace(/\s/g, '').includes(w.replace(/\s/g, '')) || norm(x.n).includes(w)));
      if (prods.length) { prods.sort((x, y) => x.p - y.p); out.art[n] = {min: prods[0], top: prods.slice(0, 3)}; ok++; }
    } catch (e) { console.log(n + ': ' + e.message); }
    await espera(350);
  }
  if (ok < 10) { console.log('::error::Muy pocos precios (' + ok + '): no se actualiza super.json'); process.exit(1); }
  fs.writeFileSync('web/super.json', JSON.stringify(out));
  console.log(`::notice::Precios del súper: ${ok} de ${Object.keys(A).length} artículos`);
})();
