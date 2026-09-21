# MS2 — Urban Exposure

API Express con PostgreSQL 16. Puerto predeterminado: 8082.
Mantiene ciudades y busca las más cercanas a unas coordenadas.

## Ejecución local

Requiere Node.js 22.12 o superior (versión de referencia: 22).
Desde esta carpeta:

```sh
npm ci
cp env.example .env
# Editar .env con la configuración local.
npm start
```

`npm run dev` reinicia al editar archivos. `npm test` ejecuta las pruebas.
Las dependencias están fijadas en `package-lock.json`.

## Base de datos

Se necesita una instancia PostgreSQL accesible y la base `db2_urban_exposure` debe existir.
MS2 usa [Drizzle ORM](https://orm.drizzle.team/docs/get-started-postgresql) con `pg`:
el esquema está declarado en `db/schema.js` y las consultas CRUD se construyen con
la API tipada de Drizzle. La búsqueda geográfica conserva una expresión `sql` parametrizada
porque Haversine no es una operación CRUD genérica.

En desarrollo, `npm start` ejecuta `drizzle-kit push --force` antes de iniciar la API.
Eso crea o actualiza las tablas según `db/schema.js` sin que tengas que escribir SQL.
El usuario de PostgreSQL necesita permisos de creación durante esta fase. La tabla
`sensitive_sites` corresponde a los sitios sensibles de la propuesta; todavía no tiene endpoints.

Para aplicar el esquema por separado:

```sh
npm run db:push
```

En un entorno productivo conviene ejecutar el cambio de esquema como un paso controlado
del despliegue y retirar `--force`; no se debe dar a la API permisos de administración de la base.
Configurar `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME` en `.env`.

## Endpoints

- `GET /health`: 200 si PostgreSQL responde; 503 si no está disponible.
- `GET /api/cities?limit=100&offset=0`: array ordenado por ID; límite máximo 500.
- `GET /api/cities/near?lat=-12.04&lon=-77.03&radius_km=150`: hasta 20 ciudades por distancia.
- `GET /api/cities/{id}`: detalle; 404 si no existe.
- `POST /api/cities`: crear.
- `PUT /api/cities/{id}`: reemplazar los campos de la ciudad.
- `DELETE /api/cities/{id}`: eliminar; 409 si tiene sitios relacionados.

Cuerpo de POST/PUT:

```json
{"name":"Lima","country":"PE","latitude":-12.0464,"longitude":-77.0428,"population":10000000}
```

Se validan coordenadas, IDs y población. Una tabla vacía devuelve `[]`.
