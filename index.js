require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Ms2 - urban-exposure API',
      version: '1.0.0',
      description: 'API de ciudades y exposición urbana para SmokeCast'
    }
  },
  apis: ['./index.js']
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
// GET /api/cities -> lista todas las ciudades
app.get('/api/cities', async (req, res) => {
    try{
        const result = await pool.query('SELECT * FROM cities LIMIT 100');
        const cities = result.rows.map(city => ({
            ...city,
            latitude: parseFloat(city.latitude),
            longitude: parseFloat(city.longitude)
        }));
        res.json(cities);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/cities/near?lat=X&lon=Y&radius_km=150 -> ciudades cerca de un punto
// (Uso previsto más adelante por Ms4 para saber qué ciudades están cerca de un incendio)
app.get('/api/cities/near', async (req, res) => {
    const { lat, lon, radius_km } = req.query;
    
    if (!lat || !lon) {
        return res.status(400).json({ error: "Faltan parámetros lat y lon" });
    }

    // Fórmula de Harversine para calcular la distancia entre dos coordenadas (Haversine) sin meter PostGIS.
    // Nota: Calculamos 'distance_km' en la subconsulta para poder filtrar por ese alias en el WHERE
    const query = `
        SELECT * FROM (
            SELECT *, (
                6371 * acos(
                    cos(radians($1)) * cos(radians(latitude)) *
                    cos(radians(longitude) - radians($2)) +
                    sin(radians($1)) * sin(radians(latitude))
                )
            ) AS distance_km
            FROM cities
        ) AS nearby_cities
        WHERE distance_km <= $3
        ORDER BY distance_km
        LIMIT 20`;
    
    const radiusKm = radius_km !== undefined ? radius_km : 150;
    try {
        const result = await pool.query(query, [lat, lon, radiusKm]);
        const cities = result.rows.map(city => ({
            ...city,
            latitude: parseFloat(city.latitude),
            longitude: parseFloat(city.longitude),
            distance_km: parseFloat(city.distance_km)
        }));
        res.json(cities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/cities/:id -> una ciudad específica (previsto a ser llamado por Ms3)
app.get('/api/cities/:id', async (req, res) => {
     try {
        const result = await pool.query('SELECT * FROM cities WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Ciudad no encontrada" });
        }
        const city = {
            ...result.rows[0],
            latitude: parseFloat(result.rows[0].latitude),
            longitude: parseFloat(result.rows[0].longitude)
        };
        res.json(city);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/cities -> crear una ciudad nueva
app.use(express.json());

app.post('/api/cities', async (req, res) => {
  try {
    const { name, country, latitude, longitude, population } = req.body;
    const result = await pool.query(
      'INSERT INTO cities (name, country, latitude, longitude, population) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, country, latitude, longitude, population]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/cities/:id -> editar una ciudad existente
app.put('/api/cities/:id', async (req, res) => {
  try {
    const { name, country, latitude, longitude, population } = req.body;
    const result = await pool.query(
      'UPDATE cities SET name=$1, country=$2, latitude=$3, longitude=$4, population=$5 WHERE id=$6 RETURNING *',
      [name, country, latitude, longitude, population, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ciudad no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/cities/:id -> eliminar una ciudad
app.delete('/api/cities/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM cities WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ciudad no encontrada' });
    }
    res.json({ message: 'Ciudad eliminada correctamente', deleted: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.PORT, () => console.log(`Ms2 corriendo en puerto ${process.env.PORT}`));