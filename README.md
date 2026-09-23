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
`sensitive_sites` contiene lugares vulnerables asociados a una ciudad (hospitales, escuelas, aeropuertos, estaciones de bomberos, etc.). Se puede consultar con `GET /api/v1/sensitive-sites?city_id=...` o `GET /api/v1/cities/{id}/sensitive-sites`.

Documentación OpenAPI/Swagger: `http://127.0.0.1:8082/docs` · JSON: `http://127.0.0.1:8082/openapi.json`.

Para aplicar el esquema por separado:

```sh
npm run db:push
```

En un entorno productivo conviene ejecutar el cambio de esquema como un paso controlado
del despliegue y retirar `--force`; no se debe dar a la API permisos de administración de la base.
Configurar `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME` en `.env`.

## Endpoints

- `GET /health`: 200 si PostgreSQL responde; 503 si no está disponible.
- `GET /api/v1/cities?page=0&size=100`: array ordenado por ID; tamaño máximo 500.
- `GET /api/v1/cities/near?lat=-12.04&lon=-77.03&radius_km=150`: hasta 20 ciudades por distancia.
- `GET /api/v1/cities/{id}`: detalle; 404 si no existe.
- `POST /api/v1/cities`: crear.
- `POST /api/v1/cities/bulk`: inserta hasta 10 000 ciudades en una operación.
- `PUT /api/v1/cities/{id}`: reemplazar los campos de la ciudad.
- `DELETE /api/v1/cities/{id}`: eliminar; 409 si tiene sitios relacionados.
- `GET /api/v1/sensitive-sites?page=0&size=100&city_id=1`: lista sitios sensibles, opcionalmente filtrados por ciudad.
- `GET /api/v1/cities/{id}/sensitive-sites`: devuelve todos los sitios sensibles de una ciudad.
- `POST /api/v1/sensitive-sites`, `PUT /api/v1/sensitive-sites/{id}` y `DELETE /api/v1/sensitive-sites/{id}`: administra sitios sensibles.
- `POST /api/v1/sensitive-sites/bulk`: inserta hasta 10 000 sitios sensibles en una operación.

Los endpoints bulk aceptan `{ "items": [ ... ] }` y devuelven la cantidad e IDs
insertados. El seed continúa siendo el mecanismo para la carga masiva inicial.

Cuerpo de POST/PUT:

```json
{"name":"Lima","country":"PE","latitude":-12.0464,"longitude":-77.0428,"population":10000000}
```

Se validan coordenadas, IDs y población. Una tabla vacía devuelve `[]`.
