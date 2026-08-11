# GestorTareas - Aula Virtual

Aplicación de aula virtual con roles de **administrador**, **profesor** y
**estudiante**: gestión de materias, tareas, anuncios, calificaciones y
cuentas de usuario.

**Autores:** Jose Narvaez, Jordan Castillo

Stack:

- **Backend**: Node.js + Express + PostgreSQL, autenticación con JWT,
  organizado en capas (`routes` → `controllers` → `services` → `repositories`).
- **Frontend**: Ionic + Angular (`frontend-ionic/`).
- **Base de datos**: PostgreSQL (local en desarrollo, Amazon RDS en producción).

## Requisitos

- Docker Desktop instalado y en ejecución.
- Node.js y npm (para correr el frontend Ionic en desarrollo).
- Git.

## Instalación y ejecución en local

Pasos, en orden, para clonar el proyecto y dejarlo corriendo:

1. Clonar el repositorio y entrar a la carpeta:

   ```bash
   git clone https://github.com/sepapu2018-hue/AulaVirtual.git
   cd AulaVirtual
   ```

2. Levantar la base de datos y el backend con Docker:

   ```bash
   docker compose -f docker-compose.dev.yml up -d --build
   ```

   Este comando construye la imagen del backend, crea el contenedor de
   PostgreSQL (`gestortareas_db`, puerto `5432`) y, la primera vez que se
   crea el volumen de datos, ejecuta `db/init.sql` de forma automática:
   crea las tablas y las tres cuentas de prueba. El backend queda
   disponible en `http://localhost:3001/api`.

   Para este modo no hace falta crear un archivo `.env`: las variables
   de conexión ya están definidas dentro de `docker-compose.dev.yml`.

3. Levantar el frontend, en otra terminal:

   ```bash
   cd frontend-ionic
   npm install
   npm start
   ```

   La app queda disponible en `http://localhost:8100`.

4. Entrar con cualquiera de las cuentas de prueba (ver abajo).

Para reiniciar la base de datos desde cero (borra los datos guardados):

```bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d --build
```

### Cuentas de prueba (creadas por `db/init.sql`)

Una por rol, para probar los tres flujos de la app:

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@gestortareas.com` | `admin123` |
| Profesor | `profesor.demo@gestortareas.com` | `profesor123` |
| Estudiante | `estudiante.demo@gestortareas.com` | `estudiante123` |

Cámbialas si el proyecto se usa más allá de una demo.

## Producción

`docker-compose.yml` (en la raíz, sin sufijo) es la plantilla de producción:
usa las imágenes ya construidas en Docker Hub y se conecta a una base de
datos externa (Amazon RDS) en vez de levantar PostgreSQL en un contenedor.

1. Copiar `.env.example` a `.env` y completar las variables:
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: credenciales de conexión a PostgreSQL.
   - `DB_SSL`: `true` para conectar contra Amazon RDS.
   - `JWT_SECRET`: cadena aleatoria larga usada para firmar los tokens de sesión.
   - `ALLOWED_ORIGINS`: orígenes permitidos a llamar la API, separados por coma.

   El archivo `.env` no se sube al repositorio (está en `.gitignore`).

2. Si la base de datos es nueva, crear el esquema con `db/init.sql` y,
   opcionalmente, `db/crear_usuario_app.sql` para un usuario de base de
   datos con privilegios limitados, en vez de usar el usuario maestro.

3. Levantar los contenedores:

   ```bash
   docker compose up -d
   ```

El push a la rama `main` dispara el workflow de GitHub Actions
(`.github/workflows/docker.yml`), que construye y publica las imágenes de
`backend` y `frontend-ionic` en Docker Hub, y despliega por SSH en el
servidor de producción.

## Arquitectura del backend

El backend está organizado en capas, cada una con una responsabilidad única:

```
routes → controllers → services → repositories → base de datos
```

- **`routes/`**: define las URLs y qué middleware de permisos aplica.
- **`controllers/`**: lee la petición HTTP y llama al service correspondiente.
- **`services/`**: reglas de negocio y permisos por rol (nada de HTTP ni SQL aquí).
- **`repositories/`**: todas las consultas SQL, sin lógica de negocio.

Diagramas ArchiMate (arquitectura tecnológica y de software) en
`backend/docs/architecture/`.

## Pruebas

Pruebas unitarias con Jest sobre la capa `services/`, simulando (`mock`) los
`repositories`. No usan una base de datos real.

```bash
cd backend
npm test              # correr las pruebas
npm run test:coverage # correr las pruebas + reporte de cobertura
```

102 pruebas, cobertura ≥98% en la capa de servicios.

## Documentación de la API

- `backend/docs/API.md`: guía en Markdown con cada endpoint, parámetros,
  respuestas, errores y ejemplos con `curl`.
- `backend/docs/openapi.yaml`: especificación OpenAPI 3.0.
- `backend/docs/GestorTareas.postman_collection.json`: colección de Postman.
- Swagger UI en vivo: `http://localhost:3001/api/docs` (o el dominio de
  producción con el mismo path).

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
│   ├── server.js              # arranca src/app.js (4 líneas)
│   ├── src/
│   │   ├── app.js              # arma la app de Express
│   │   ├── config/             # variables de entorno, conexión a la BD
│   │   ├── middlewares/        # auth, seguridad, subida de archivos, errores
│   │   ├── routes/             # rutas por dominio (auth, materias, tareas...)
│   │   ├── controllers/        # leen la petición y llaman al service
│   │   ├── services/           # reglas de negocio y permisos por rol
│   │   ├── repositories/       # consultas SQL
│   │   └── utils/
│   ├── tests/unit/services/    # pruebas Jest (mocks de repositories)
│   └── docs/
│       ├── API.md               # documentación de la API
│       ├── openapi.yaml         # spec OpenAPI 3
│       ├── GestorTareas.postman_collection.json
│       └── architecture/        # diagramas ArchiMate
├── frontend-ionic/            # app Ionic + Angular (único frontend del proyecto)
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/app/
└── .github/workflows/
    └── docker.yml             # build, push y despliegue automático
```
