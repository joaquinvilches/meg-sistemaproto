/**
 * MEG Sistema - VPS Backend Server
 * Servidor de sincronización para aplicación Electron multi-usuario
 *
 * v1.2.6 - FIX CRÍTICO: Merge en lugar de Replace
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3002;

// ═══════════════════════════════════════
// Configuración de PostgreSQL
// ═══════════════════════════════════════

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'meg_sistema',
  user: process.env.DB_USER || 'meg_user',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test de conexión
pool.on('connect', () => {
  console.log('✅ Conectado a PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Error inesperado en PostgreSQL:', err);
  process.exit(-1);
});

// ═══════════════════════════════════════
// Middleware
// ═══════════════════════════════════════

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(compression());

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ═══════════════════════════════════════
// Funciones de Merge
// ═══════════════════════════════════════

/**
 * Merge de datos con estrategia Last-Write-Wins
 *
 * @param {Object} existingData - Datos actuales en VPS
 * @param {Object} newData - Datos nuevos desde PC
 * @returns {Object} - Datos mergeados
 */
function mergeData(existingData, newData) {
  console.log('🔀 Iniciando merge de datos...');

  const merged = { ...existingData };

  // Merge de cada array (cotizaciones, clientes, ordenesCompra, ordenesTrabajo)
  for (const key of Object.keys(newData)) {
    if (Array.isArray(newData[key])) {
      const existingArray = existingData[key] || [];
      const newArray = newData[key] || [];

      console.log(`  📊 ${key}: Existentes=${existingArray.length}, Nuevos=${newArray.length}`);

      // Merge por ID único
      merged[key] = mergeArrayByUniqueId(existingArray, newArray, key);

      console.log(`  ✅ ${key}: Resultado=${merged[key].length}`);
    } else {
      // Para datos no-array, simplemente sobrescribir
      merged[key] = newData[key];
    }
  }

  return merged;
}

/**
 * Merge de arrays por ID único con Last-Write-Wins
 *
 * @param {Array} existingArray - Array existente
 * @param {Array} newArray - Array nuevo
 * @param {String} arrayType - Tipo de array (para determinar campo ID)
 * @returns {Array} - Array mergeado
 */
function mergeArrayByUniqueId(existingArray, newArray, arrayType) {
  // Determinar campo de ID según tipo
  const idField = getIdField(arrayType);

  // Crear mapa de elementos existentes por ID
  const existingMap = new Map();
  existingArray.forEach(item => {
    if (item[idField]) {
      existingMap.set(item[idField], item);
    }
  });

  // Merge: agregar o actualizar con Last-Write-Wins
  newArray.forEach(newItem => {
    if (!newItem[idField]) {
      console.warn(`⚠️ Item sin ${idField}:`, newItem);
      return;
    }

    const existingItem = existingMap.get(newItem[idField]);

    if (!existingItem) {
      // Nuevo item: agregarlo
      existingMap.set(newItem[idField], newItem);
      console.log(`  ➕ Nuevo: ${newItem[idField]}`);
    } else {
      // Item existente: Last-Write-Wins (comparar fechas)
      const shouldUpdate = isNewer(newItem, existingItem);

      if (shouldUpdate) {
        existingMap.set(newItem[idField], newItem);
        console.log(`  🔄 Actualizado: ${newItem[idField]}`);
      } else {
        console.log(`  ⏭️  Omitido (más antiguo): ${newItem[idField]}`);
      }
    }
  });

  // Convertir mapa de vuelta a array
  return Array.from(existingMap.values());
}

/**
 * Obtener campo de ID según tipo de array
 */
function getIdField(arrayType) {
  switch (arrayType) {
    case 'cotizaciones':
      return 'numero';
    case 'clientes':
      return 'rut';
    case 'ordenesCompra':
      return 'numero';
    case 'ordenesTrabajo':
      return 'numero';
    default:
      return 'id';
  }
}

/**
 * Comparar si newItem es más reciente que existingItem
 * Estrategia: Last-Write-Wins basado en fecha
 */
function isNewer(newItem, existingItem) {
  // Si existe campo 'updatedAt' o 'fecha', comparar
  const newDate = new Date(newItem.updatedAt || newItem.fecha || 0);
  const existingDate = new Date(existingItem.updatedAt || existingItem.fecha || 0);

  // Si las fechas son válidas, comparar
  if (!isNaN(newDate.getTime()) && !isNaN(existingDate.getTime())) {
    return newDate >= existingDate;
  }

  // Si no hay fechas, asumir que el nuevo es más reciente
  return true;
}

/**
 * Limpieza automática: eliminar items con deleted=true y más de 30 días
 * Esto mantiene la base de datos limpia sin crecer indefinidamente
 */
async function cleanupDeletedItems() {
  try {
    console.log('[CLEANUP] Iniciando limpieza automática de items eliminados...');

    const DAYS_TO_KEEP = 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_KEEP);
    const cutoffISO = cutoffDate.toISOString();

    const result = await pool.query('SELECT id, content FROM sync_data');
    let totalCleaned = 0;

    for (const row of result.rows) {
      try {
        const data = row.content;
        let hasChanges = false;

        // Limpiar cada tipo de array
        ['cotizaciones', 'clientes', 'ordenesCompra', 'ordenesTrabajo'].forEach(key => {
          if (Array.isArray(data[key])) {
            const originalLength = data[key].length;

            // Filtrar: eliminar items con deleted=true Y updatedAt > 30 días
            data[key] = data[key].filter(item => {
              if (!item.deleted) return true; // Mantener items NO eliminados

              const itemDate = item.updatedAt || item.fecha || null;
              if (!itemDate) return true; // Si no tiene fecha, mantener por seguridad

              return itemDate > cutoffISO; // Mantener si es más reciente que 30 días
            });

            const cleaned = originalLength - data[key].length;
            if (cleaned > 0) {
              console.log(`[CLEANUP] ${row.id} - ${key}: eliminados ${cleaned} items antiguos`);
              totalCleaned += cleaned;
              hasChanges = true;
            }
          }
        });

        // Si hubo cambios, actualizar en la base de datos
        if (hasChanges) {
          await pool.query(
            'UPDATE sync_data SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [JSON.stringify(data), row.id]
          );
        }
      } catch (parseErr) {
        console.error(`[CLEANUP] Error procesando ${row.id}:`, parseErr);
      }
    }

    if (totalCleaned > 0) {
      console.log(`[CLEANUP] ✅ Limpieza completada: ${totalCleaned} items eliminados`);
    } else {
      console.log('[CLEANUP] ✅ No hay items antiguos para limpiar');
    }
  } catch (error) {
    console.error('[CLEANUP] ❌ Error en limpieza automática:', error);
  }
}

// ═══════════════════════════════════════
// Inicialización de Base de Datos
// ═══════════════════════════════════════

async function initDatabase() {
  try {
    console.log('Inicializando base de datos...');

    // Crear tabla de datos sincronizados
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sync_data (
        id TEXT PRIMARY KEY,
        user_key TEXT NOT NULL,
        content JSONB NOT NULL,
        version INTEGER DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Crear índices
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sync_data_user_key
      ON sync_data(user_key)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sync_data_updated_at
      ON sync_data(updated_at DESC)
    `);

    // Crear tabla de logs (opcional, para auditoría)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id SERIAL PRIMARY KEY,
        user_key TEXT NOT NULL,
        action TEXT NOT NULL,
        details JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Base de datos inicializada correctamente');

    // Insertar datos iniciales si no existen
    const userKeys = ['meg', 'myorganic'];

    for (const key of userKeys) {
      const result = await pool.query(
        'SELECT id FROM sync_data WHERE id = $1',
        [key]
      );

      if (result.rows.length === 0) {
        const defaultContent = {
          clientes: [],
          cotizaciones: [],
          ordenesCompra: [],
          ordenesTrabajo: []
        };

        await pool.query(
          'INSERT INTO sync_data (id, user_key, content) VALUES ($1, $2, $3)',
          [key, key, JSON.stringify(defaultContent)]
        );

        console.log(`✅ Datos iniciales creados para: ${key}`);
      }
    }

  } catch (error) {
    console.error('❌ Error al inicializar base de datos:', error);
    throw error;
  }
}

// ═══════════════════════════════════════
// Endpoints de Sincronización
// ═══════════════════════════════════════

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.2.8'
  });
});

/**
 * PULL: Descargar datos del servidor
 * GET /api/sync/pull?userKey=myorganic
 */
app.get('/api/sync/pull', async (req, res) => {
  try {
    const { userKey } = req.query;

    if (!userKey) {
      return res.status(400).json({ error: 'userKey es requerido' });
    }

    console.log(`📥 PULL - userKey: ${userKey}`);

    const result = await pool.query(
      'SELECT content, version, updated_at FROM sync_data WHERE id = $1',
      [userKey]
    );

    if (result.rows.length === 0) {
      // Si no existe, crear registro vacío
      const defaultContent = {
        clientes: [],
        cotizaciones: [],
        ordenesCompra: [],
        ordenesTrabajo: []
      };

      await pool.query(
        'INSERT INTO sync_data (id, user_key, content) VALUES ($1, $2, $3) RETURNING content, version, updated_at',
        [userKey, userKey, JSON.stringify(defaultContent)]
      );

      console.log(`✅ PULL - Registro creado para ${userKey}`);
      return res.json(defaultContent);
    }

    const data = result.rows[0].content;

    console.log(`✅ PULL exitoso - userKey: ${userKey}`);
    console.log(`   📊 Datos: ${JSON.stringify(Object.keys(data).map(k => `${k}=${Array.isArray(data[k]) ? data[k].length : '?'}`))}`);

    res.json(data);

  } catch (error) {
    console.error('❌ Error en PULL:', error);
    res.status(500).json({ error: 'Error al obtener datos', details: error.message });
  }
});

/**
 * PUSH: Subir datos al servidor CON MERGE
 * POST /api/sync/push?userKey=myorganic
 * Body: { cotizaciones: [...], clientes: [...], ... }
 */
app.post('/api/sync/push', async (req, res) => {
  try {
    const userKey = req.query.userKey;
    const newData = req.body;

    if (!userKey) {
      return res.status(400).json({ error: 'userKey es requerido' });
    }

    if (!newData || Object.keys(newData).length === 0) {
      return res.status(400).json({ error: 'data es requerido' });
    }

    console.log(`📤 PUSH - userKey: ${userKey}`);
    console.log(`📤 Datos nuevos recibidos:`, Object.keys(newData).map(k => `${k}=${Array.isArray(newData[k]) ? newData[k].length : '?'}`));

    // 1. Obtener datos existentes
    const existingResult = await pool.query(
      'SELECT content FROM sync_data WHERE id = $1',
      [userKey]
    );

    let mergedData;

    if (existingResult.rows.length === 0) {
      // No existe: crear nuevo registro
      console.log('📝 Creando nuevo registro...');
      mergedData = newData;
    } else {
      // Existe: hacer MERGE
      const existingData = existingResult.rows[0].content;
      console.log(`📂 Datos existentes:`, Object.keys(existingData).map(k => `${k}=${Array.isArray(existingData[k]) ? existingData[k].length : '?'}`));

      mergedData = mergeData(existingData, newData);
      console.log(`✅ Datos mergeados:`, Object.keys(mergedData).map(k => `${k}=${Array.isArray(mergedData[k]) ? mergedData[k].length : '?'}`));
    }

    // 2. Guardar datos mergeados
    const result = await pool.query(`
      INSERT INTO sync_data (id, user_key, content, version, updated_at)
      VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (id)
      DO UPDATE SET
        content = $3,
        version = sync_data.version + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING version, updated_at
    `, [userKey, userKey, JSON.stringify(mergedData)]);

    // 3. Log de auditoría
    await pool.query(
      'INSERT INTO sync_log (user_key, action, details) VALUES ($1, $2, $3)',
      [userKey, 'PUSH', JSON.stringify({
        timestamp: new Date(),
        newItems: Object.keys(newData).reduce((acc, k) => {
          acc[k] = Array.isArray(newData[k]) ? newData[k].length : 0;
          return acc;
        }, {}),
        mergedItems: Object.keys(mergedData).reduce((acc, k) => {
          acc[k] = Array.isArray(mergedData[k]) ? mergedData[k].length : 0;
          return acc;
        }, {})
      })]
    );

    console.log(`✅ PUSH exitoso - Nueva versión: ${result.rows[0].version}`);

    res.json({
      success: true,
      version: result.rows[0].version,
      updated_at: result.rows[0].updated_at,
      merged: mergedData
    });

  } catch (error) {
    console.error('❌ Error en PUSH:', error);
    res.status(500).json({ error: 'Error al guardar datos', details: error.message });
  }
});

/**
 * Login (básico - para futura autenticación)
 */
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Credenciales hardcodeadas (igual que en la app local)
    const credentials = {
      'meg_2025': 'meg4731$',
      'myorganic_2025': 'myorganic4731$'
    };

    if (credentials[username] === password) {
      const userKey = username.replace('_2025', '');
      const company = userKey === 'meg' ? 'MEG Industrial' : 'MyOrganic';

      console.log(`✅ Login exitoso: ${username}`);

      res.json({
        success: true,
        username,
        userKey,
        company
      });
    } else {
      console.log(`❌ Login fallido: ${username}`);
      res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ error: 'Error en autenticación' });
  }
});

/**
 * Estadísticas (opcional)
 */
app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        user_key,
        version,
        updated_at,
        jsonb_array_length(content->'clientes') as num_clientes,
        jsonb_array_length(content->'cotizaciones') as num_cotizaciones,
        jsonb_array_length(content->'ordenesCompra') as num_ordenes_compra,
        jsonb_array_length(content->'ordenesTrabajo') as num_ordenes_trabajo
      FROM sync_data
      ORDER BY updated_at DESC
    `);

    res.json({ stats: result.rows });

  } catch (error) {
    console.error('❌ Error en stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// ═══════════════════════════════════════
// Manejo de Errores
// ═══════════════════════════════════════

app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// ═══════════════════════════════════════
// Iniciar Servidor
// ═══════════════════════════════════════

async function startServer() {
  try {
    // Inicializar base de datos
    await initDatabase();

    // Ejecutar limpieza automática al iniciar (después de 10 segundos)
    setTimeout(() => cleanupDeletedItems(), 10000);

    // Programar limpieza automática cada 24 horas
    setInterval(() => cleanupDeletedItems(), 24 * 60 * 60 * 1000);

    // Iniciar servidor
    app.listen(PORT, '0.0.0.0', () => {
      console.log('═══════════════════════════════════════');
      console.log('  MEG Sistema - VPS Backend Server');
      console.log('  v1.2.8 - SOFT DELETE + CLEANUP');
      console.log('═══════════════════════════════════════');
      console.log(`✅ Servidor corriendo en puerto ${PORT}`);
      console.log(`✅ Ambiente: ${process.env.NODE_ENV || 'production'}`);
      console.log(`✅ PostgreSQL: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
      console.log(`✅ Limpieza automática: cada 24 horas (30 días retención)`);
      console.log('═══════════════════════════════════════');
    });

  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error);
    process.exit(1);
  }
}

// Manejo de señales de terminación
process.on('SIGTERM', async () => {
  console.log('SIGTERM recibido, cerrando servidor...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT recibido, cerrando servidor...');
  await pool.end();
  process.exit(0);
});

// Iniciar
startServer();
