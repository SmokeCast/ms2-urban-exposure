const { integer, numeric, pgTable, serial, varchar } = require('drizzle-orm/pg-core');

const cities = pgTable('cities', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  country: varchar('country', { length: 80 }),
  latitude: numeric('latitude', { precision: 9, scale: 6 }).notNull(),
  longitude: numeric('longitude', { precision: 9, scale: 6 }).notNull(),
  population: integer('population'),
});

const sensitiveSites = pgTable('sensitive_sites', {
  id: serial('id').primaryKey(),
  cityId: integer('city_id').notNull().references(() => cities.id),
  name: varchar('name', { length: 150 }),
  type: varchar('type', { length: 40 }),
});

module.exports = { cities, sensitiveSites };
