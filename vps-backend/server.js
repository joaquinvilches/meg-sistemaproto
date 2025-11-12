/**
 * MEG Sistema - VPS Backend Server
 * Servidor de sincronización para aplicación Electron multi-usuario
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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

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
    const userKeys = ['meg', 'myorganic', 'meg_creacion', 'myorganic_creacion'];

    for (const key of userKeys) {
      const result = await pool.query(
        'SELECT id FROM sync_data WHERE id = $1',
        [key]
      );

      if (result.rows.length === 0) {
        const defaultContent = key.includes('_creacion')
          ? { clientes: [], cotizaciones: [], ordenesCompra: [], ordenesTrabajo: [] }
          : { cotizaciones: [] };

        await pool.query(
          'INSERT INTO sync_data (id, user_key, content) VALUES ($1, $2, $3)',
          [key, key.replace('_creacion', ''), JSON.stringify(defaultContent)]
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
    version: '1.0.0'
  });
});

/**
 * PULL: Descargar datos del servidor
 * GET /api/sync/pull?userKey=meg_creacion
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
      const defaultContent = userKey.includes('_creacion')
        ? { clientes: [], cotizaciones: [], ordenesCompra: [], ordenesTrabajo: [] }
        : { cotizaciones: [] };

      await pool.query(
        'INSERT INTO sync_data (id, user_key, content) VALUES ($1, $2, $3) RETURNING content, version, updated_at',
        [userKey, userKey.replace('_creacion', ''), JSON.stringify(defaultContent)]
      );

      return res.json(defaultContent);
    }

    const data = result.rows[0].content;

    console.log(`✅ PULL exitoso - Registros: ${Object.keys(data).length}`);

    res.json(data);

  } catch (error) {
    console.error('❌ Error en PULL:', error);
    res.status(500).json({ error: 'Error al obtener datos', details: error.message });
  }
});

/**
 * PUSH: Subir datos al servidor
 * POST /api/sync/push
 * Body: { userKey: 'meg_creacion', data: {...} }
 */
app.post('/api/sync/push', async (req, res) => {
  try {
    const { userKey, data } = req.body;

    if (!userKey) {
      return res.status(400).json({ error: 'userKey es requerido' });
    }

    if (!data) {
      return res.status(400).json({ error: 'data es requerido' });
    }

    console.log(`📤 PUSH - userKey: ${userKey}`);
    console.log(`📤 Datos recibidos:`, Object.keys(data));

    // Actualizar o insertar datos
    const result = await pool.query(`
      INSERT INTO sync_data (id, user_key, content, version, updated_at)
      VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (id)
      DO UPDATE SET
        content = $3,
        version = sync_data.version + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING version, updated_at
    `, [userKey, userKey.replace('_creacion', ''), JSON.stringify(data)]);

    // Log de auditoría
    await pool.query(
      'INSERT INTO sync_log (user_key, action, details) VALUES ($1, $2, $3)',
      [userKey, 'PUSH', JSON.stringify({ timestamp: new Date() })]
    );

    console.log(`✅ PUSH exitoso - Nueva versión: ${result.rows[0].version}`);

    res.json({
      success: true,
      version: result.rows[0].version,
      updated_at: result.rows[0].updated_at
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
        jsonb_array_length(content->'cotizaciones') as num_cotizaciones
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

    // Iniciar servidor
    app.listen(PORT, '0.0.0.0', () => {
      console.log('═══════════════════════════════════════');
      console.log('  MEG Sistema - VPS Backend Server');
      console.log('═══════════════════════════════════════');
      console.log(`✅ Servidor corriendo en puerto ${PORT}`);
      console.log(`✅ Ambiente: ${process.env.NODE_ENV || 'production'}`);
      console.log(`✅ PostgreSQL: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
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
