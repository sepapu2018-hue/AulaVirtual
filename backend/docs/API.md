# API de GestorTareas (AulaVirtual)

API REST del backend del aula virtual: materias, tareas, archivos,
comentarios, anuncios, cuentas de usuario y el panel de administración.

## Arquitectura del backend

El backend está organizado en capas (ver `backend/src/`):

```
routes → controllers → services → repositories → PostgreSQL
```

- **routes**: declaran las rutas y qué middleware/controlador les corresponde.
- **controllers**: leen la petición HTTP, llaman al service y arman la respuesta.
- **services**: reglas de negocio y permisos (no conocen `req`/`res`).
- **repositories**: todo el SQL, sin lógica de permisos ni de HTTP.

## URL base

- Desarrollo: `http://localhost:3001/api`
- Producción: la URL pública del servidor donde corre el contenedor `backend`.

## Requisitos y variables de entorno

Ver `.env.example` en la raíz del proyecto. Resumen:

| Variable | Uso |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexión a PostgreSQL |
| `DB_SSL` | `true` para conectar contra Amazon RDS |
| `JWT_SECRET` | Firma de los tokens de sesión |
| `ALLOWED_ORIGINS` | Orígenes permitidos por CORS, separados por coma |
| `PORT` | Puerto del backend (por defecto 3000) |

## Cómo correr el backend y la base de datos

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

## Cómo correr las pruebas

```bash
cd backend
npm test              # corre la suite de Jest
npm run test:coverage # corre la suite con reporte de cobertura
```

## Autenticación

La API usa **JWT Bearer**. Tras iniciar sesión (`POST /api/auth/login`) se
recibe un `token` que debe enviarse en cada petición protegida:

```
Authorization: Bearer <token>
```

El token expira a las 12 horas. Si falta o es inválido, la API responde
`401`.

## Roles

| Rol | Puede |
|---|---|
| `admin` | Todo: gestionar materias, profesores, estudiantes, tareas, calificar, y usar el panel de administración. |
| `profesor` | Gestionar tareas/anuncios/calificaciones **solo en las materias que tiene asignadas** (`materias.profesor_id`). |
| `estudiante` | Ver las materias en las que está inscrito, entregar tareas, comentar. |

### Modo "Ver aula" (`?como=`)

Cualquier endpoint de materias, tareas o anuncios acepta el query param
`?como=<id_estudiante>`. **Solo tiene efecto si quien hace la petición es
admin** y el id corresponde a una cuenta con rol `estudiante`: en ese caso,
la petición se resuelve como si la hiciera ese estudiante (sin cerrar la
sesión del admin). Para cualquier otro rol, o si el id no es un estudiante
válido, el parámetro se ignora silenciosamente.

## Explorar la API con Swagger

Con el backend corriendo, `http://localhost:3001/api/docs` sirve una UI de
Swagger interactiva generada a partir de `openapi.yaml` (mismo directorio
que este archivo). También hay una colección lista para importar en
Postman: `GestorTareas.postman_collection.json`.

## Formato de errores

Todas las respuestas de error tienen la forma:

```json
{ "error": "Mensaje descriptivo" }
```

## Tabla de endpoints

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/health` | público | Comprobación de salud |
| POST | `/api/auth/login` | público | Iniciar sesión |
| GET | `/api/materias` | autenticado | Listar materias visibles |
| POST | `/api/materias` | admin | Crear materia |
| PUT | `/api/materias/reordenar` | admin | Reordenar materias |
| PUT | `/api/materias/:id` | admin | Editar materia |
| DELETE | `/api/materias/:id` | admin | Eliminar materia (y sus tareas) |
| GET | `/api/materias/:id/estudiantes` | admin/profesor asignado | Listar inscritos |
| POST | `/api/materias/:id/estudiantes` | admin | Inscribir estudiante |
| DELETE | `/api/materias/:id/estudiantes/:usuarioId` | admin | Retirar estudiante |
| GET | `/api/materias/:id/anuncios` | autenticado con visibilidad | Listar anuncios |
| POST | `/api/materias/:id/anuncios` | admin/profesor asignado | Publicar anuncio |
| DELETE | `/api/anuncios/:id` | admin/profesor asignado | Eliminar anuncio |
| GET | `/api/tareas` | autenticado | Listar tareas visibles |
| GET | `/api/tareas/estadisticas` | autenticado | Estadísticas de tareas |
| GET | `/api/tareas/:id` | autenticado con visibilidad | Detalle de tarea |
| GET | `/api/tareas/:id/comentarios` | autenticado con visibilidad | Listar comentarios |
| POST | `/api/tareas/:id/comentarios` | autenticado con visibilidad | Crear comentario |
| DELETE | `/api/comentarios/:id` | autenticado con visibilidad | Eliminar comentario |
| GET | `/api/tareas/:id/archivos` | autenticado con visibilidad | Listar archivos |
| POST | `/api/tareas/:id/archivo` | autenticado con visibilidad | Subir archivo (entrega) |
| DELETE | `/api/tareas/:id/archivo/:archivoId` | autenticado con visibilidad | Quitar archivo |
| GET | `/api/tareas/:id/registro` | admin/profesor asignado | Registro de entregas |
| PUT | `/api/tareas/:id/notas` | admin/profesor asignado | Calificar entrega |
| POST | `/api/tareas` | admin/profesor asignado | Crear tarea |
| PUT | `/api/tareas/:id` | admin/profesor asignado | Editar tarea |
| DELETE | `/api/tareas/completadas` | admin/profesor asignado | Eliminar tareas completadas |
| DELETE | `/api/tareas/:id` | admin/profesor asignado | Eliminar tarea |
| GET | `/api/usuarios` | admin | Listar cuentas por rol |
| POST | `/api/usuarios` | admin | Crear cuenta |
| DELETE | `/api/usuarios/:id` | admin | Eliminar cuenta |
| GET | `/api/admin/estadisticas` | admin | Estadísticas del panel de administración |
| GET | `/api/archivos/:ruta` | público | Descargar un archivo subido |

---

## Detalle de endpoints

### `POST /api/auth/login`

Inicia sesión. Sin autenticación previa. Limitado a 10 intentos cada 15
minutos por IP.

**Body**
```json
{ "correo": "admin@gestortareas.com", "password": "admin123" }
```

**200 OK**
```json
{
  "token": "eyJhbGciOi...",
  "usuario": { "id": 1, "nombre": "Administrador", "correo": "admin@gestortareas.com", "rol": "admin" }
}
```

**Errores**: `400` campos faltantes · `401` credenciales inválidas · `429` demasiados intentos.

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo":"admin@gestortareas.com","password":"admin123"}'
```

---

### `GET /api/materias`

Lista las materias visibles para el usuario autenticado (dueño, profesor
asignado, o inscrito).

**Query params**: `como` (opcional, solo admin).

**200 OK**
```json
[
  {
    "id": 1, "nombre": "Arquitectura de Software", "orden": 1,
    "fecha_creacion": "2026-07-23T13:31:56.935Z", "profesor_id": 3,
    "profesor": "Ing. Patricio Alvear", "es_dueno": true,
    "total": 5, "completadas": 2, "pendientes": 3
  }
]
```

---

### `POST /api/materias` (admin)

**Body**: `{ "nombre": string, "profesor_id": number }`

**201 Created**: la materia creada. **Errores**: `400` falta nombre o
`profesor_id`, o el `profesor_id` no corresponde a una cuenta con rol
`profesor`.

---

### `PUT /api/materias/reordenar` (admin)

**Body**: `{ "orden": number[] }` — lista de ids de materia en el nuevo orden.
Solo se reordenan las materias visibles para el usuario; el resto del
arreglo se ignora en silencio.

**200 OK**: `{ "message": "Orden actualizado" }`

---

### `PUT /api/materias/:id` (admin)

Mismo body que crear. **404** si la materia no existe o no pertenece al
admin autenticado.

---

### `DELETE /api/materias/:id` (admin)

Elimina la materia **y todas sus tareas asociadas** (el frontend muestra
una advertencia previa por esto). **200**: `{ "message": "Materia eliminada" }`.

---

### `GET /api/materias/:id/estudiantes` (admin o profesor asignado a esa materia)

**200 OK**: lista de `{ id, nombre, correo, fecha_inscripcion }`.
**403** si no eres docente de esa materia.

---

### `POST /api/materias/:id/estudiantes` (admin)

**Body**: `{ "usuario_id": number }` (debe ser una cuenta con rol `estudiante`).
Inscribir dos veces al mismo estudiante no genera error ni duplicado.

**201**: los datos del estudiante inscrito. **404**: materia o estudiante
no encontrado.

---

### `DELETE /api/materias/:id/estudiantes/:usuarioId` (admin)

**200**: `{ "message": "Estudiante desinscrito" }`. **404** si no estaba inscrito.

---

### `GET /api/materias/:id/anuncios` / `POST /api/materias/:id/anuncios`

GET: cualquier usuario con visibilidad sobre la materia. POST (crear,
`{ "contenido": string }`): solo admin o el profesor asignado. **403** si
no eres docente de la materia; **400** si el contenido viene vacío.

---

### `DELETE /api/anuncios/:id` (admin o profesor asignado)

**200**: `{ "message": "Anuncio eliminado" }`. **404** si no existe.

---

### `GET /api/tareas`

**Query params**: `materia_id` (opcional), `como` (opcional, solo admin).

**200 OK**
```json
[
  {
    "id": 10, "materia_id": 1, "titulo": "Preparar presentación",
    "descripcion": "...", "prioridad": "alta", "fecha_limite": "2026-08-09",
    "completada": false, "fecha_creacion": "...", "materia_nombre": "Arquitectura de Software",
    "num_archivos": 0, "mi_nota": null
  }
]
```

---

### `GET /api/tareas/estadisticas`

**Query params**: `materia_id` (opcional), `como` (opcional).

**200 OK**
```json
{
  "total": 11, "completadas": 5, "pendientes": 6, "vencidas": 2,
  "por_prioridad": { "alta": 4, "media": 5, "baja": 2 }
}
```

---

### `GET /api/tareas/:id`

**200 OK**: la tarea con `archivos: []` y `mi_nota: { nota, comentario } | null`.
**404** si no existe o no es visible para el usuario.

---

### `POST /api/tareas` (admin o profesor asignado)

**Body**: `{ "titulo": string, "descripcion"?: string, "prioridad"?: "alta"|"media"|"baja", "fecha_limite"?: string, "materia_id": number }`.
Una prioridad inválida o ausente se guarda como `"media"`.

**201**: la tarea creada. **400**: falta título o `materia_id`. **403**: no
eres docente de esa materia.

---

### `PUT /api/tareas/:id` (admin o profesor asignado)

Mismo body que crear, más `completada: boolean`. **403** también si se
intenta mover la tarea a una materia de la que no eres docente
(`"Materia no válida"`).

---

### `DELETE /api/tareas/completadas` (admin o profesor asignado)

**Query params**: `materia_id` (opcional), `como` (opcional). Borra todas
las tareas completadas visibles para el usuario (o solo las de una materia).

**200**: `{ "eliminadas": number }`.

---

### `DELETE /api/tareas/:id` (admin o profesor asignado)

Borra la tarea y sus archivos asociados (en base de datos y en disco).
**200**: `{ "message": "Tarea eliminada" }`.

---

### `GET /api/tareas/:id/comentarios` / `POST /api/tareas/:id/comentarios`

Cualquier usuario con visibilidad sobre la tarea. POST body:
`{ "contenido": string }`. **400** si viene vacío. El comentario guarda
`autor_nombre` y `autor_rol` de quien lo publica.

**201 (POST)**
```json
{ "id": 3, "contenido": "Una duda", "fecha_creacion": "...", "autor_nombre": "Ana", "autor_rol": "estudiante" }
```

---

### `DELETE /api/comentarios/:id`

Cualquier usuario con visibilidad sobre la materia de esa tarea puede
eliminar el comentario (no está restringido al autor). **404** si no existe
o no hay visibilidad.

---

### `GET /api/tareas/:id/archivos`

Lista los archivos adjuntos de la tarea.

---

### `POST /api/tareas/:id/archivo`

Sube un archivo como entrega. **`multipart/form-data`** con el campo de
archivo llamado **`archivo`**. Tipos permitidos: PDF, Word (`.doc`/`.docx`),
PNG, JPEG, WEBP. Tamaño máximo: **5MB**.

Al subir un archivo, la tarea se marca `completada = true`.

**200 OK**: la tarea con su lista de archivos actualizada (sin `mi_nota`).
**400**: no se envió archivo, tipo no permitido, o excede 5MB. **403**: la
entrega está bloqueada (ver más abajo). **404**: la tarea no es visible.

```bash
curl -X POST http://localhost:3001/api/tareas/10/archivo \
  -H "Authorization: Bearer $TOKEN" \
  -F "archivo=@./tarea.pdf"
```

#### Entrega bloqueada

Un estudiante **no puede** subir ni quitar archivos de una tarea si:
- ya tiene una nota registrada para esa tarea (`"Esta tarea ya fue calificada y no se puede modificar"`), o
- la fecha límite ya pasó (`"El plazo de entrega ya venció y no se puede modificar"`).

El admin nunca está sujeto a este bloqueo (ni siquiera viendo el aula de
un estudiante en modo `?como=`).

---

### `DELETE /api/tareas/:id/archivo/:archivoId`

Quita un archivo. Si era el último archivo de la tarea, la tarea vuelve a
`completada = false`. Mismas reglas de bloqueo que subir.

---

### `GET /api/tareas/:id/registro` (admin o profesor asignado)

Lista, por cada estudiante inscrito (o dueño) de la materia, cuántos
archivos entregó y su nota.

**200 OK**
```json
[{ "usuario_id": 5, "nombre": "Ana", "correo": "ana@x.com", "num_archivos": 1, "ultima_entrega": "...", "nota": "8.50", "comentario": "Bien" }]
```

---

### `PUT /api/tareas/:id/notas` (admin o profesor asignado)

**Body**: `{ "usuario_id": number, "nota": number|null, "comentario"?: string }`.
La nota debe estar entre 0 y 10 (o vacía/null para "sin calificar").
Guardar la nota de nuevo sobre un mismo estudiante actualiza el registro
existente (no crea uno duplicado).

**400**: falta `usuario_id`, o la nota está fuera de rango.

---

### `GET /api/usuarios` (admin)

**Query params**: `rol` (`estudiante` | `profesor` | `admin`; por defecto `estudiante`).

**200 OK**: `[{ id, nombre, correo, rol, fecha_creacion }]`.

---

### `POST /api/usuarios` (admin)

**Body**: `{ "nombre": string, "correo": string, "password": string, "rol"?: "estudiante"|"profesor"|"admin" }`.
Contraseña mínima: 4 caracteres. **400**: campos faltantes, contraseña
corta, o correo ya registrado.

---

### `DELETE /api/usuarios/:id` (admin)

**400** si intentas eliminar tu propia cuenta, o si es el último
administrador del sistema. **404** si no existe.

---

### `GET /api/admin/estadisticas` (admin)

Datos para el panel de administración.

**200 OK**
```json
{
  "usuarios": { "admin": 2, "profesor": 4, "estudiante": 30 },
  "materias": 7,
  "tareas": { "total": 42, "completadas": 20, "pendientes": 22 },
  "por_materia": [{ "id": 1, "nombre": "Arquitectura de Software", "completadas": 3, "pendientes": 2 }]
}
```

---

### `GET /api/archivos/:ruta`

Sirve el archivo guardado en el servidor. **Es un endpoint público**, sin
autenticación (el frontend enlaza directo con `<a href>`/`<img src>`, que
no envían el header `Authorization`); la seguridad se apoya en que la
ruta incluye un nombre de archivo generado aleatoriamente.
