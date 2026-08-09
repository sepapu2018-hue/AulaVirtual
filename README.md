# GestorTareas (AulaVirtual)

Aplicación de aula virtual con roles de **administrador**, **profesor** y
**estudiante**: gestión de materias, tareas, anuncios, calificaciones y
cuentas de usuario.

Stack:

- **Backend**: Node.js + Express + PostgreSQL, autenticación con JWT.
- **Frontend**: Ionic + Angular (`frontend-ionic/`).
- **Base de datos**: PostgreSQL (local en desarrollo, Amazon RDS en producción).

## Requisitos

- Docker Desktop instalado y en ejecución.
- Node.js y npm (para correr el frontend Ionic en desarrollo).

## Configuración

1. Copia `.env.example` a `.env` y completa las variables:
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: credenciales de conexión a PostgreSQL.
   - `DB_SSL`: pon `true` al conectar contra Amazon RDS; déjalo vacío para una base local.
   - `JWT_SECRET`: cadena aleatoria larga usada para firmar los tokens de sesión.
   - `ALLOWED_ORIGINS`: orígenes permitidos a llamar la API, separados por coma.

   El archivo `.env` **no se sube al repositorio** (está en `.gitignore`).

2. Si es la primera vez que usas la base de datos, crea el esquema con
   `db/init.sql`, y opcionalmente `db/crear_usuario_app.sql` para un usuario
   de aplicación con privilegios limitados (recomendado en vez del usuario
   maestro).

## Desarrollo local

**1. Base de datos y backend**, construidos desde el código fuente:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Levanta `gestortareas_db` (PostgreSQL en `localhost:5432`) y
`gestortareas_backend` (API REST en `http://localhost:3001/api`).

**2. Frontend Ionic**, por separado:

```bash
cd frontend-ionic
npm install
npx ng serve --port 8100
```

La app queda en `http://localhost:8100`.

### Cuenta de administrador semilla

Correo: `admin@gestortareas.com` · Contraseña: `admin123`
(creada por `db/init.sql`; cámbiala si el proyecto se usa más allá de una demo).

## Producción

`docker-compose.yml` (en la raíz, sin sufijo) es la plantilla de producción:
usa las imágenes ya construidas en Docker Hub y las variables de `.env`, sin
levantar una base de datos local (se conecta a RDS).

```bash
docker compose up -d
```

El push a la rama `main` dispara el workflow de GitHub Actions
(`.github/workflows/docker.yml`), que construye y publica las imágenes de
`backend` y `frontend-ionic` en Docker Hub, y despliega por SSH en el
servidor de producción.

## Seguridad

- Rate limiting en el login (10 intentos cada 15 minutos por IP).
- CORS restringido a los orígenes listados en `ALLOWED_ORIGINS`.
- Cabeceras HTTP estándar de seguridad vía `helmet`.
- Subida de archivos validada por tipo (solo PDF, Word e imágenes) y tamaño (máx. 5MB).
- Contraseñas con hash `bcrypt`; sesiones con JWT (expiran a las 12h).
- Permisos por rol verificados en cada endpoint (admin / profesor / estudiante).

## Comandos útiles

Ver los contenedores corriendo:

```bash
docker compose ps
```

Ver los datos directamente en la base de datos:

```bash
docker exec -it gestortareas_db psql -U gestortareas_user -d gestortareas_db -c "SELECT * FROM materias;"
```

Detener todo (agrega `-v` solo si además quieres borrar los datos guardados):

```bash
docker compose down
```

## Estructura del proyecto

```
PROYECTO INTEGRADOR/
├── docker-compose.yml       # plantilla de producción (imágenes de Docker Hub + .env)
├── docker-compose.dev.yml   # desarrollo local (build desde código fuente + db local)
├── .env.example             # plantilla de variables de entorno
├── db/
│   ├── init.sql              # esquema de la base de datos y datos semilla
│   └── crear_usuario_app.sql # usuario de BD con privilegios limitados
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js              # API REST (Express)
│   └── db.js
├── frontend-ionic/            # app Ionic + Angular (único frontend del proyecto)
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/app/
└── .github/workflows/
    └── docker.yml             # build, push y despliegue automático
```
