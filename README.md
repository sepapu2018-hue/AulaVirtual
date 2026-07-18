# GestorTareas - CRUD con Docker Compose

Aplicación de tres capas (frontend, backend, base de datos) para gestionar tareas (Crear, Leer, Actualizar, Eliminar).

## Requisitos
- Docker Desktop instalado y en ejecución.

## Cómo levantar el proyecto

```bash
docker compose up --build
```

Esto construye las imágenes de `frontend` y `backend` (autoría propia) y descarga la imagen oficial de `postgres`, luego levanta los 3 contenedores.

## URLs

- Frontend (interfaz web): http://localhost:8080
- Backend (API REST):      http://localhost:3001/api/tareas
- Base de datos (Postgres): localhost:5432 (usuario: `gestortareas_user`, password: `gestortareas_pass`, db: `gestortareas_db`)

## Ver los contenedores corriendo

```bash
docker ps
```

Deben aparecer: `gestortareas_frontend`, `gestortareas_backend`, `gestortareas_db`.

## Ver los datos directamente en la base de datos

```bash
docker exec -it gestortareas_db psql -U gestortareas_user -d gestortareas_db -c "SELECT * FROM tareas;"
```

## Detener todo

```bash
docker compose down
```

(agrega `-v` solo si quieres borrar también los datos guardados: `docker compose down -v`)

## Estructura del proyecto

```
DEBERCOMPUTO/
├── docker-compose.yml
├── db/
│   └── init.sql          # crea la tabla "tareas" y un dato de ejemplo
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js          # API REST (Express)
│   └── db.js
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf         # sirve el sitio y redirige /api/ al backend
│   └── public/
│       ├── index.html
│       ├── style.css
│       └── script.js
└── informe/
    ├── INFORME_TECNICO.md
    └── capturas/           # aquí van las imágenes del informe
```
