# Diagramas ArchiMate — GestorTareas (AulaVirtual)

Este documento es la **especificación confiable** de los dos diagramas
pedidos (tecnológico y de software). También se entrega un archivo
`GestorTareas.archimate` generado como mejor esfuerzo — ábrelo primero; si
Archi lo importa sin problema, listo. **Si da error al abrirlo o se ve
incompleto, usa esta tabla para reconstruir el modelo a mano** (es un
trabajo mecánico de 15-30 minutos: crear cada elemento con su tipo, y
conectar según la tabla de relaciones).

Ambos diagramas reflejan la implementación real después del refactor en
capas (routes → controllers → services → repositories) y el stack de
despliegue actual (Docker + PostgreSQL, con RDS en producción).

## Leyenda de capas ArchiMate usadas

- 🟨 **Negocio** (amarillo en Archi): actores.
- 🟦 **Aplicación** (azul/celeste): componentes y funciones de software.
- 🟩 **Tecnología** (verde): nodos, contenedores, servicios técnicos.

---

## Diagrama 1 — Arquitectura Tecnológica

Muestra cómo los tres roles de usuario llegan, a través de la red, hasta
los contenedores Docker que corren el frontend, el backend y la base de
datos.

### Elementos

| # | Nombre | Tipo ArchiMate | Capa |
|---|---|---|---|
| 1 | Administrador | Business Actor | Negocio |
| 2 | Profesor | Business Actor | Negocio |
| 3 | Estudiante | Business Actor | Negocio |
| 4 | Dispositivo (móvil o navegador) | Device | Tecnología |
| 5 | Red (HTTP/HTTPS) | Communication Network | Tecnología |
| 6 | Contenedor: frontend-ionic | Node | Tecnología |
| 7 | Servidor Ionic (nginx) | System Software | Tecnología |
| 8 | Servicio Web Ionic | Technology Service | Tecnología |
| 9 | Contenedor: backend | Node | Tecnología |
| 10 | API REST (Express) | System Software | Tecnología |
| 11 | Interfaz HTTPS :3001/api | Technology Interface | Tecnología |
| 12 | Servicio API REST | Technology Service | Tecnología |
| 13 | Almacenamiento de archivos (uploads) | Artifact | Tecnología |
| 14 | Contenedor / instancia: base de datos (db local o RDS) | Node | Tecnología |
| 15 | Motor PostgreSQL | System Software | Tecnología |
| 16 | Servicio de Base de Datos | Technology Service | Tecnología |

### Relaciones

| Origen | Relación | Destino | Nota |
|---|---|---|---|
| Administrador | Assignment | Dispositivo | |
| Profesor | Assignment | Dispositivo | |
| Estudiante | Assignment | Dispositivo | |
| Dispositivo | Flow | Red | Tráfico HTTP/HTTPS |
| Red | Flow | Servicio Web Ionic | Carga de la app |
| Red | Flow | Servicio API REST | Llamadas a la API |
| Contenedor: frontend-ionic | Assignment | Servidor Ionic (nginx) | El contenedor aloja nginx |
| Servidor Ionic (nginx) | Realization | Servicio Web Ionic | |
| Contenedor: backend | Assignment | API REST (Express) | El contenedor aloja el backend |
| API REST (Express) | Composition | Interfaz HTTPS :3001/api | |
| API REST (Express) | Realization | Servicio API REST | |
| Contenedor: backend | Composition | Almacenamiento de archivos | Volumen de `uploads/` |
| API REST (Express) | Access | Almacenamiento de archivos | Lee/escribe archivos subidos |
| API REST (Express) | Access | Servicio de Base de Datos | Vía `pg.Pool` (SSL si es RDS) |
| Contenedor/instancia: base de datos | Assignment | Motor PostgreSQL | |
| Motor PostgreSQL | Realization | Servicio de Base de Datos | |

---

## Diagrama 2 — Arquitectura de Software

Muestra las capas internas del backend (el resultado del refactor) y los
módulos funcionales que implementan las reglas de negocio.

### Elementos

| # | Nombre | Tipo ArchiMate |
|---|---|---|
| 1 | Frontend Ionic | Application Component |
| 2 | Servicio API REST | Application Service |
| 3 | Capa de Rutas (`routes/`) | Application Component |
| 4 | Capa de Controladores (`controllers/`) | Application Component |
| 5 | Capa de Servicios (`services/`) | Application Component |
| 6 | Capa de Repositorios (`repositories/`) | Application Component |
| 7 | Base de datos relacional | Data Object |
| 8 | Función: Autenticación | Application Function |
| 9 | Función: Materias e Inscripciones | Application Function |
| 10 | Función: Tareas y Calificaciones | Application Function |
| 11 | Función: Archivos | Application Function |
| 12 | Función: Comentarios | Application Function |
| 13 | Función: Anuncios | Application Function |
| 14 | Función: Usuarios | Application Function |
| 15 | Función: Administración (panel admin) | Application Function |

> Nota: "Materias e Inscripciones" y "Tareas y Calificaciones" se agrupan
> así porque en el código real `materias.service.js` incluye la lógica de
> inscripciones, y `tareas.service.js` incluye `guardarNota`/calificaciones
> — reflejan los archivos reales, no una división ideal.

### Relaciones

| Origen | Relación | Destino | Nota |
|---|---|---|---|
| Servicio API REST | Serving | Frontend Ionic | La API sirve al frontend |
| Capa de Rutas | Realization | Servicio API REST | Las rutas exponen el servicio |
| Capa de Rutas | Triggering | Capa de Controladores | |
| Capa de Controladores | Triggering | Capa de Servicios | |
| Capa de Servicios | Triggering | Capa de Repositorios | |
| Capa de Repositorios | Access | Base de datos relacional | Único punto de acceso a SQL |
| Capa de Servicios | Assignment | Función: Autenticación | |
| Capa de Servicios | Assignment | Función: Materias e Inscripciones | |
| Capa de Servicios | Assignment | Función: Tareas y Calificaciones | |
| Capa de Servicios | Assignment | Función: Archivos | |
| Capa de Servicios | Assignment | Función: Comentarios | |
| Capa de Servicios | Assignment | Función: Anuncios | |
| Capa de Servicios | Assignment | Función: Usuarios | |
| Capa de Servicios | Assignment | Función: Administración | |

---

## Cómo reconstruirlo a mano en Archi (si el `.archimate` no abre)

1. Archi → **File → New → ArchiMate Model**.
2. Para cada fila de la tabla "Elementos": clic derecho en la carpeta de
   la capa correspondiente (Business / Application / Technology &amp;
   Physical) → **New → (tipo exacto de la tabla)** → nombrarlo igual que
   la columna "Nombre".
3. Crea una **View** nueva por cada diagrama (clic derecho en *Views* →
   *New ArchiMate View*), arrastra los elementos de esa sección a la vista.
4. Archi dibuja la relación automáticamente al arrastrar dos elementos ya
   conectados en el modelo; si no, selecciona el tipo de relación exacto
   de la tabla "Relaciones" en la paleta y dibújala manualmente entre
   origen y destino.
