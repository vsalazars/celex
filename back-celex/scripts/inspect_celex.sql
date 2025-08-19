-- Versión de PostgreSQL
SELECT version();

-- Esquemas + tablas públicas
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- ==== Mostrar todos los registros de todas las tablas públicas ====
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
    LOOP
        RAISE NOTICE 'Contenido de la tabla: %', r.table_name;
        EXECUTE format('TABLE public.%I', r.table_name);
    END LOOP;
END
$$;

-- ==== Información detallada de la tabla users ====

-- Descripción de la tabla users
SELECT 
  c.ordinal_position AS pos,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'users'
ORDER BY c.ordinal_position;

-- Índices de users
SELECT
  i.relname AS index_name,
  a.attname AS column_name,
  ix.indisunique AS is_unique
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE t.relkind = 'r'
  AND t.relname = 'users'
ORDER BY index_name, column_name;

-- Constraints de users
SELECT
  tc.constraint_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'users'
ORDER BY tc.constraint_type, tc.constraint_name;

-- Valores del ENUM userrole
SELECT 
  t.typname AS enum_type,
  e.enumlabel AS value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname = 'userrole'
ORDER BY e.enumsortorder;

-- Conteo de usuarios por rol
SELECT role, COUNT(*) AS total
FROM users
GROUP BY role
ORDER BY role;

-- Primeros 20 usuarios
SELECT 
  id, first_name, last_name, email, email_verified, is_ipn, boleta, curp, role, is_active, created_at
FROM users
ORDER BY id
LIMIT 20;

-- Usuarios con rol 'superadmin'
SELECT id, email, role
FROM users
WHERE role::text = 'superadmin';


--psql -U postgres -h localhost -d celex_db -f inspect_celex.sql
