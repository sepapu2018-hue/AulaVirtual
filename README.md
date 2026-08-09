# GestorTareas (AulaVirtual)

Aplicación de aula virtual con roles de administrador, profesor y estudiante:
gestión de materias, tareas, anuncios, calificaciones y cuentas de usuario.

Stack:
- **Backend**: Node.js + Express + PostgreSQL, con autenticación JWT.
- **Frontend**: Ionic + Angular (`frontend-ionic/`).
- **Base de datos**: PostgreSQL (vía Docker).

## Requisitos

- Docker Desktop instalado y en ejecución (para la base de datos y el backend).
- Node.js y npm (para correr el frontend Ionic).

## Cómo levantar el proyecto en desarrollo

**1. Base de datos y backend** (con Docker):

```bash
docker compose up -d --build
```

Esto levanta:
- `gestortareas_db` — PostgreSQL en `localhost:5432`.
- `gestortareas_backend` — API REST en `http://localhost:3001/api`.

**2. Frontend Ionic** (por separado, con `ng serve`):

```bash
cd frontend-ionic
npm install
npx ng serve --port 8100
```

La app queda disponible en `http://localhost:8100`.

## Cuenta de administrador semilla

Correo: `admin@gestortareas.com` · Contraseña: `admin123`

## Ver los contenedores corriendo

```bash
docker ps
```

Deben aparecer: `gestortareas_backend`, `gestortareas_db`.

## Ver los datos directamente en la base de datos

```bash
docker exec -it gestortareas_db psql -U gestortareas_user -d gestortareas_db -c "SELECT * FROM materias;"
```

## Detener todo

```bash
docker compose down
```

(agrega `-v` solo si quieres borrar también los datos guardados: `docker compose down -v`)

## Estructura del proyecto

```
PROYECTO INTEGRADOR/
├── docker-compose.yml
├── db/
│   └── init.sql            # esquema de la base de datos y datos semilla
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js           # API REST (Express)
│   └── db.js
└── frontend-ionic/         # app Ionic + Angular
    └── src/
        └── app/
```

## Despliegue a producción

El push a la rama `main` dispara el workflow de GitHub Actions
(`.github/workflows/docker.yml`), que construye y publica las imágenes de
`backend` y `frontend-ionic` en Docker Hub, y despliega por SSH en el
servidor de producción.
