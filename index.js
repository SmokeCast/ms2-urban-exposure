const express = require('express');
const { asc, eq, sql } = require('drizzle-orm');
const { db, pool } = require('./db');
const { cities, sensitiveSites } = require('./db/schema');
const { spec, html: swaggerHtml } = require('./openapi');

const app = express();
app.use(express.json());
app.get('/openapi.json', (req, res) => res.json(spec));
app.get('/docs', (req, res) => res.type('html').send(swaggerHtml));
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function number(value, name, min, max, integer = false) {
  const result = Number(value);
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' ||
      !Number.isFinite(result) || result < min || result > max || (integer && !Number.isInteger(result))) {
    throw Object.assign(new Error(`Parámetro inválido: ${name}`), { status: 400 });
  }
  return result;
}

function city(row) {
  return { ...row, latitude: Number(row.latitude), longitude: Number(row.longitude),
    ...(row.distance_km !== undefined ? { distance_km: Number(row.distance_km) } : {}) };
}

function cityValues(body = {}) {
  const { name, country, latitude, longitude, population } = body || {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120 ||
      (country != null && (typeof country !== 'string' || country.length > 80))) {
    throw Object.assign(new Error('Nombre o país inválido'), { status: 400 });
  }
  return { name: name.trim(), country: country ?? null,
    latitude: String(number(latitude, 'latitude', -90, 90)),
    longitude: String(number(longitude, 'longitude', -180, 180)),
    population: population == null ? null : number(population, 'population', 0, 2147483647, true) };
}

function siteValues(body = {}) {
  const { city_id, cityId, name, type } = body || {};
  const cityIdValue = number(city_id ?? cityId, 'city_id', 1, 2147483647, true);
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 150 ||
      (type != null && (typeof type !== 'string' || type.trim().length > 40))) {
    throw Object.assign(new Error('Nombre o tipo de sitio inválido'), { status: 400 });
  }
  return { cityId: cityIdValue, name: name.trim(), type: type == null ? null : type.trim() };
}

function site(row) { return { id: row.id, city_id: row.cityId ?? row.city_id, name: row.name, type: row.type }; }

function bulkItems(body) {
  const items = Array.isArray(body) ? body : body?.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 10000) {
    throw Object.assign(new Error('El bulk debe contener entre 1 y 10000 elementos'), { status: 400 });
  }
  return items;
}

app.get('/health', async (req, res) => {
  try { await db.execute(sql`SELECT 1`); res.json({ status: 'ok', service: 'ms2-urban-exposure' }); }
  catch { res.status(503).json({ status: 'degraded', service: 'ms2-urban-exposure' }); }
});

app.get('/api/v1/cities', async (req, res) => {
  const size = number(req.query.size ?? 100, 'size', 1, 500, true);
  const page = number(req.query.page ?? 0, 'page', 0, 2147483647, true);
  const offset = page * size;
  const rows = await db.select().from(cities).orderBy(asc(cities.id)).limit(size).offset(offset);
  res.json(rows.map(city));
});

app.get('/api/v1/cities/near', async (req, res) => {
  const lat = number(req.query.lat, 'lat', -90, 90);
  const lon = number(req.query.lon, 'lon', -180, 180);
  const radius = number(req.query.radius_km ?? 150, 'radius_km', 0, 20040);
  // Esta expresión geográfica usa el operador sql de Drizzle; sus parámetros siguen siendo seguros.
  const result = await db.execute(sql`
    SELECT *, 6371 * acos(LEAST(1.0, GREATEST(-1.0,
      cos(radians(${lat})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${lon})) +
      sin(radians(${lat})) * sin(radians(latitude))
    ))) AS distance_km
    FROM cities
    WHERE 6371 * acos(LEAST(1.0, GREATEST(-1.0,
      cos(radians(${lat})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${lon})) +
      sin(radians(${lat})) * sin(radians(latitude))
    ))) <= ${radius}
    ORDER BY distance_km, id LIMIT 20`);
  res.json(result.rows.map(city));
});

// Lugares vulnerables asociados a una ciudad (hospitales, escuelas, aeropuertos, etc.).
app.get('/api/v1/sensitive-sites', async (req, res) => {
  const size = number(req.query.size ?? 100, 'size', 1, 500, true);
  const page = number(req.query.page ?? 0, 'page', 0, 2147483647, true);
  const cityId = req.query.city_id == null || req.query.city_id === '' ? null : number(req.query.city_id, 'city_id', 1, 2147483647, true);
  const query = db.select().from(sensitiveSites).orderBy(asc(sensitiveSites.id)).limit(size).offset(page * size);
  const rows = cityId == null ? await query : await db.select().from(sensitiveSites).where(eq(sensitiveSites.cityId, cityId)).orderBy(asc(sensitiveSites.id)).limit(size).offset(page * size);
  res.json(rows.map(site));
});

app.get('/api/v1/cities/:id/sensitive-sites', async (req, res) => {
  const cityRows = await db.select({ id: cities.id }).from(cities).where(eq(cities.id, req.cityId)).limit(1);
  if (!cityRows.length) return res.status(404).json({ error: 'Ciudad no encontrada' });
  const rows = await db.select().from(sensitiveSites).where(eq(sensitiveSites.cityId, req.cityId)).orderBy(asc(sensitiveSites.id));
  res.json(rows.map(site));
});

app.param('id', (req, res, next, value) => { req.cityId = number(value, 'id', 1, 2147483647, true); next(); });

app.get('/api/v1/cities/:id', async (req, res) => {
  const rows = await db.select().from(cities).where(eq(cities.id, req.cityId)).limit(1);
  if (!rows.length) return res.status(404).json({ error: 'Ciudad no encontrada' });
  res.json(city(rows[0]));
});

app.post('/api/v1/cities', async (req, res) => {
  const rows = await db.insert(cities).values(cityValues(req.body)).returning();
  res.status(201).json(city(rows[0]));
});

app.post('/api/v1/cities/bulk', async (req, res) => {
  const values = bulkItems(req.body).map(cityValues);
  const rows = await db.insert(cities).values(values).returning({ id: cities.id });
  res.status(201).json({ inserted: rows.length, ids: rows.map(row => row.id) });
});

app.put('/api/v1/cities/:id', async (req, res) => {
  const rows = await db.update(cities).set(cityValues(req.body)).where(eq(cities.id, req.cityId)).returning();
  if (!rows.length) return res.status(404).json({ error: 'Ciudad no encontrada' });
  res.json(city(rows[0]));
});

app.delete('/api/v1/cities/:id', async (req, res) => {
  const rows = await db.delete(cities).where(eq(cities.id, req.cityId)).returning();
  if (!rows.length) return res.status(404).json({ error: 'Ciudad no encontrada' });
  res.json({ message: 'Ciudad eliminada correctamente', deleted: city(rows[0]) });
});

app.post('/api/v1/sensitive-sites', async (req, res) => {
  const rows = await db.insert(sensitiveSites).values(siteValues(req.body)).returning();
  res.status(201).json(site(rows[0]));
});

app.post('/api/v1/sensitive-sites/bulk', async (req, res) => {
  const values = bulkItems(req.body).map(siteValues);
  const rows = await db.insert(sensitiveSites).values(values).returning({ id: sensitiveSites.id });
  res.status(201).json({ inserted: rows.length, ids: rows.map(row => row.id) });
});

app.put('/api/v1/sensitive-sites/:id', async (req, res) => {
  const siteId = number(req.params.id, 'id', 1, 2147483647, true);
  const rows = await db.update(sensitiveSites).set(siteValues(req.body)).where(eq(sensitiveSites.id, siteId)).returning();
  if (!rows.length) return res.status(404).json({ error: 'Sitio sensible no encontrado' });
  res.json(site(rows[0]));
});

app.delete('/api/v1/sensitive-sites/:id', async (req, res) => {
  const siteId = number(req.params.id, 'id', 1, 2147483647, true);
  const rows = await db.delete(sensitiveSites).where(eq(sensitiveSites.id, siteId)).returning();
  if (!rows.length) return res.status(404).json({ error: 'Sitio sensible no encontrado' });
  res.json({ message: 'Sitio sensible eliminado correctamente', deleted: site(rows[0]) });
});

app.use((error, req, res, next) => {
  if (error.status === 400) return res.status(400).json({ error: error.message });
  if (error.code === '23503') return res.status(409).json({ error: 'La ciudad tiene registros relacionados' });
  console.error(error.message);
  res.status(503).json({ error: 'No se pudo consultar PostgreSQL' });
});

if (require.main === module) {
  const port = Number(process.env.PORT || 8082);
  const server = app.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Ms2 en puerto ${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => pool.end()));
}

module.exports = { app, pool, db, city, cityValues, site, siteValues };
