-- Crea un usuario de aplicación con privilegios limitados a gestortareas_db,
-- en vez de usar el usuario maestro (postgres) del RDS para la conexión diaria.
-- Ejecutar conectado a la base "gestortareas_db" (no a "postgres").

CREATE ROLE gestortareas_app WITH LOGIN PASSWORD 'U2MX1mf1szUp6Gquusb4';

GRANT USAGE ON SCHEMA public TO gestortareas_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gestortareas_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gestortareas_app;

-- Para que las tablas que se creen en el futuro también queden accesibles
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gestortareas_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO gestortareas_app;
