CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    correo VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'estudiante',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS materias (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    profesor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    nombre VARCHAR(150) NOT NULL,
    profesor VARCHAR(150),
    orden INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tareas (
    id SERIAL PRIMARY KEY,
    materia_id INTEGER REFERENCES materias(id) ON DELETE SET NULL,
    titulo VARCHAR(150) NOT NULL,
    descripcion TEXT,
    prioridad VARCHAR(10) NOT NULL DEFAULT 'media',
    fecha_limite DATE,
    completada BOOLEAN DEFAULT FALSE,
    archivo_nombre VARCHAR(255),
    archivo_ruta VARCHAR(255),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS anuncios (
    id SERIAL PRIMARY KEY,
    materia_id INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
    contenido TEXT NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comentarios (
    id SERIAL PRIMARY KEY,
    tarea_id INTEGER NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
    autor_nombre VARCHAR(150) NOT NULL,
    autor_rol VARCHAR(20) NOT NULL,
    contenido TEXT NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS archivos_tarea (
    id SERIAL PRIMARY KEY,
    tarea_id INTEGER NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    nombre_original VARCHAR(255) NOT NULL,
    ruta VARCHAR(255) NOT NULL,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inscripciones (
    id SERIAL PRIMARY KEY,
    materia_id INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_inscripcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(materia_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS notas (
    id SERIAL PRIMARY KEY,
    tarea_id INTEGER NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nota NUMERIC(4,2) CHECK (nota >= 0 AND nota <= 10),
    comentario TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tarea_id, usuario_id)
);

-- Usuarios semilla para desarrollo local (ver README.md para el detalle
-- de credenciales de cada rol).
INSERT INTO usuarios (nombre, correo, password_hash, rol) VALUES
('Administrador', 'admin@gestortareas.com', '$2a$10$VfXTSqb66qx06rBkL2dZQO2EtCrjw6QH1YIqfMSExhjh4SPxJ9ysi', 'admin'),
('Profesor Demo', 'profesor.demo@gestortareas.com', '$2a$10$z0Alwud7WaTwjUf3pti3Z.Rf63tA73GYIGuKd1AJtuzPHA.n.1GA.', 'profesor'),
('Estudiante Demo', 'estudiante.demo@gestortareas.com', '$2a$10$VJnMZEFYDD8lPJFqrKaIx.KoqEpK3XnlgYWX3jmlUnOytiIkczsmy', 'estudiante');

INSERT INTO materias (usuario_id, nombre, profesor, orden) VALUES
(1, 'Arquitectura de Software', 'Ing. Patricio Alvear', 1),
(1, 'Computación en la Nube', 'Ing. Verónica Zapata', 2),
(1, 'Desarrollo Móvil', 'Ing. Pablo Pérez', 3);

INSERT INTO tareas (materia_id, titulo, descripcion, prioridad, fecha_limite, completada) VALUES
(1, 'Preparar presentación', 'Repasar el guion de la demo y probar el proyector', 'alta', CURRENT_DATE, FALSE),
(1, 'Tomar capturas para el informe', 'Crear, editar y eliminar una tarea para las capturas', 'media', CURRENT_DATE + 1, FALSE),
(2, 'Ejemplo de tarea completada', 'Esta tarea ya se marcó como completada', 'baja', NULL, TRUE);

INSERT INTO anuncios (materia_id, contenido) VALUES
(1, 'Bienvenidos al aula virtual de la materia. Aquí publicaré avisos importantes.'),
(1, 'Recuerden revisar la fecha límite de la presentación final.');
