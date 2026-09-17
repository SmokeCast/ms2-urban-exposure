import pandas as pd
import psycopg2

# Definición de columnas y carga del archivo
cols = [
    'geonameid', 'name', 'asciiname', 'alternatenames', 'latitude', 'longitude',
    'feature_class', 'feature_code', 'country_code', 'cc2', 'admin1', 'admin2',
    'admin3', 'admin4', 'population', 'elevation', 'dem', 'timezone', 'moddate'
]
df = pd.read_csv('cities500.txt', sep='\t', names=cols, low_memory=False)

# Filtramos a países de Latinoamérica para no traer las 200,000 del mundo entero
paises_latam = ['PE', 'CO', 'CL', 'AR', 'MX', 'BR', 'EC', 'BO', 'VE', 'UY', 'PY']
df = df[df['country_code'].isin(paises_latam)]
print(f'Ciudades a insertar: {len(df)}')

# Conexión a la base de datos
conn = psycopg2.connect(
    host='localhost', 
    dbname='urban_exposure', 
    user='postgres', 
    password='smokecast123'
)
cur = conn.cursor()

# Inserción de los datos fila por fila
for _, r in df.iterrows():
    cur.execute(
        'INSERT INTO cities (name, country, latitude, longitude, population) VALUES (%s,%s,%s,%s,%s)',
        (r['name'], r['country_code'], r['latitude'], r['longitude'], int(r['population']) if pd.notna(r['population']) else 0)
    )

# Confirmación y cierre de conexiones
conn.commit()
cur.close()
conn.close()

print('Listo')
