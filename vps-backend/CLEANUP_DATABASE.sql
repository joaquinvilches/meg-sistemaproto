-- ═══════════════════════════════════════════════════════════════════
-- MEG Sistema - Script de Limpieza de Base de Datos
-- v1.3.0 - Corrección de Estructura de Apartados
-- ═══════════════════════════════════════════════════════════════════
--
-- IMPORTANTE: Este script elimina TODOS los datos y re-inicializa
-- con la estructura correcta. HACER BACKUP ANTES DE EJECUTAR.
--
-- ═══════════════════════════════════════════════════════════════════

-- Conectar a la base de datos PostgreSQL
-- \c meg_sistema

-- ───────────────────────────────────────
-- PASO 1: BACKUP DE DATOS ACTUALES
-- ───────────────────────────────────────

-- Ver datos actuales antes de borrar
SELECT
  id,
  user_key,
  jsonb_pretty(content) as content_formatted,
  version,
  updated_at
FROM sync_data
ORDER BY id;

-- ───────────────────────────────────────
-- PASO 2: ELIMINAR DATOS CORRUPTOS
-- ───────────────────────────────────────

-- Opción A: Eliminar SOLO los apartados principales y creación (recomendado)
DELETE FROM sync_data
WHERE id IN ('meg', 'myorganic', 'meg_creacion', 'myorganic_creacion');

-- Opción B: Eliminar TODOS los datos (usar solo si hay problemas graves)
-- DELETE FROM sync_data;

-- ───────────────────────────────────────
-- PASO 3: LIMPIAR LOGS (opcional)
-- ───────────────────────────────────────

-- Eliminar logs antiguos de sincronización (opcional)
-- DELETE FROM sync_log WHERE timestamp < NOW() - INTERVAL '7 days';

-- ───────────────────────────────────────
-- PASO 4: VERIFICAR QUE ESTÁ LIMPIO
-- ───────────────────────────────────────

SELECT COUNT(*) as total_registros FROM sync_data;

-- Debería mostrar 0 si usaste Opción B
-- O mostrar registros que NO sean meg/myorganic/meg_creacion/myorganic_creacion

-- ───────────────────────────────────────
-- PASO 5: REINICIAR EL SERVIDOR
-- ───────────────────────────────────────

-- Después de ejecutar este script:
-- 1. Salir de PostgreSQL: \q
-- 2. Reiniciar el servidor Node.js (ver INSTRUCCIONES.md)
-- 3. El servidor creará automáticamente los registros con estructura correcta

-- ═══════════════════════════════════════════════════════════════════
-- FIN DEL SCRIPT
-- ═══════════════════════════════════════════════════════════════════
