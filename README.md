# GestorTareas - Aula Virtual con Docker Compose y Amazon RDS

Aplicación de tres capas (frontend, backend, base de datos) para gestionar materias, tareas, anuncios, comentarios y notas de un aula virtual.

## Requisitos

- Docker Desktop instalado y en ejecución.
- Una base de datos PostgreSQL accesible (Amazon RDS en producción, o un Postgres local para desarrollo).

## Configuración inicial

1. Copia `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
2. Completa las variables en `.env`:
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: credenciales de conexión a PostgreSQL.
   - `JWT_SECRET`: cadena aleatoria larga usada para firmar los tokens de sesión (genera una nueva, no reutilices la de otro proyecto).
   - `ALLOWED_ORIGINS`: lista separada por comas de los orígenes permitidos a llamar la API (ej. `http://localhost:8081,http://<IP_PUBLICA>:8081`).

   El archivo `.env` **no se sube al repositorio** (está en `.gitignore`), porque contiene contraseñas y secretos reales.

3. Si es la primera vez que usas la base de datos, crea el esquema ejecutando `db/init.sql` contra ella, y opcionalmente `db/crear_usuario_app.sql` para crear un usuario de aplicación con privilegios limitados (recomendado en vez de usar el usuario maestro).

## Cómo levantar el proyecto

```bash
docker compose up --build
```

Esto construye las imágenes de `frontend` y `backend` (autoría propia) y levanta los 2 contenedores, conectándose a la base de datos configurada en `.env`.

## URLs (desarrollo local)

- Frontend (interfaz web): http://localhost:8081
- Backend (API REST):      http://localhost:3001/api/tareas

> En el despliegue en AWS, estos mismos puertos (8081 y 3001) se exponen sobre la IP pública de la instancia EC2.

## Ver los contenedores corriendo

```bash
docker compose ps
```

Deben aparecer: `gestortareas_frontend` y `gestortareas_backend`.

## Ver los datos directamente en la base de datos

```bash
psql "host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER password=$DB_PASSWORD sslmode=require" -c "SELECT * FROM tareas;"
```

## Detener todo

```bash
docker compose down
```

## Seguridad

- El login tiene límite de intentos (10 cada 15 minutos) para dificultar ataques de fuerza bruta.
- La API solo acepta peticiones desde los orígenes listados en `ALLOWED_ORIGINS`.
- La subida de archivos valida el tipo (solo PDF, Word e imágenes) y el tamaño (máx. 5MB).
- Se usa `helmet` para cabeceras de seguridad HTTP estándar.
- **Usuario administrador de prueba:** `admin@gestortareas.com` / `admin123` (creado por `init.sql`). Si este proyecto se usa más allá de una demo académica, cambia esta contraseña desde la aplicación apenas inicies sesión por primera vez.

## Estructura del proyecto

```
DEBERCOMPUTO/
├── docker-compose.yml
├── .env.example            # plantilla de variables de entorno (sin valores reales)
├── db/
│   ├── init.sql             # crea las tablas y carga datos de ejemplo
│   └── crear_usuario_app.sql # crea un usuario de BD con privilegios limitados
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js             # API REST (Express)
│   └── db.js
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf            # sirve el sitio y redirige /api/ al backend
│   └── public/
│       ├── index.html
│       ├── style.css
│       └── script.js
└── informe/
    ├── INFORME_TECNICO.docx
    ├── INFORME_TECNICO.md
    └── capturas/              # aquí van las imágenes del informe
```
