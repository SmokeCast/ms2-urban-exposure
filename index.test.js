const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getTableName } = require('drizzle-orm');
const { cityValues } = require('./index');
const { cities, sensitiveSites } = require('./db/schema');

test('el esquema Drizzle define las dos tablas de MS2', () => {
  assert.equal(getTableName(cities), 'cities');
  assert.equal(getTableName(sensitiveSites), 'sensitive_sites');
});

test('convierte y valida el cuerpo de una ciudad', () => {
  assert.deepEqual(cityValues({
    name: ' Lima ', country: 'PE', latitude: -12, longitude: -77, population: 100,
  }), { name: 'Lima', country: 'PE', latitude: '-12', longitude: '-77', population: 100 });
  assert.throws(() => cityValues({ name: 'Lima', latitude: 91, longitude: 0 }), /latitude/);
  assert.throws(() => cityValues({ name: 'Lima', latitude: 0, longitude: 0, population: -1 }), /population/);
  assert.throws(() => cityValues({ name: '', latitude: 0, longitude: 0 }), /Nombre/);
});

test('acepta población ausente y rechaza nombres demasiado largos', () => {
  const result = cityValues({ name: 'Lima', latitude: 0, longitude: 0 });
  assert.equal(result.population, null);
  assert.throws(() => cityValues({ name: 'x'.repeat(121), latitude: 0, longitude: 0 }), /Nombre/);
});
