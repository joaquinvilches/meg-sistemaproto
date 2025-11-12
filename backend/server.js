require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// CORS
const corsOptions = {
  origin: NODE_ENV === 'production' 
    ? ['https://tudominio.com', 'https://www.tudominio.com'] 
    : '*',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// ✅ BODY PARSERS (ORDEN IMPORTANTE)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Credenciales
const USERS = {
  "meg_2025": process.env.MEG_PASSWORD || "meg4731$",
  "myorganic_2025": process.env.MYORGANIC_PASSWORD || "myorganic4731$"
};

// Base de datos
const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, 'data.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error al abrir la base de datos:', err.message);
    process.exit(1);
  }
  
  console.log('✅ Conectado a SQLite:', DB_PATH);
  
  // Crear tabla
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS app_data (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS app_data_new (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    db.run(`
      INSERT OR IGNORE INTO app_data_new (id, content)
      SELECT id, content FROM app_data
    `);
    
    db.run(`DROP TABLE IF EXISTS app_data`);
    db.run(`ALTER TABLE app_data_new RENAME TO app_data`);
    
    // Inicializar usuarios
    const initUser = (id, data) => {
      db.get('SELECT COUNT(*) as count FROM app_data WHERE id = ?', [id], (err, row) => {
        if (!err && row.count === 0) {
          db.run('INSERT INTO app_data (id, content) VALUES (?, ?)', [id, JSON.stringify(data)], (err) => {
            if (!err) console.log(`✅ Usuario inicializado: ${id}`);
          });
        }
      });
    };
    
    initUser('meg', { cotizaciones: [] });
    initUser('myorganic', { cotizaciones: [] });
    initUser('meg_creacion', { clientes: [], cotizaciones: [], ordenesCompra: [] });
    initUser('myorganic_creacion', { clientes: [], cotizaciones: [], ordenesCompra: [] });
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Validación
const VALID_KEYS = ['meg', 'myorganic'];
const validateKey = (key) => VALID_KEYS.includes(key);

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: "Faltan credenciales" });
  }
  
  const expectedPass = USERS[username];
  if (expectedPass && password === expectedPass) {
    const userKey = username.includes('myorganic') ? 'myorganic' : 'meg';
    res.json({ success: true, userKey });
  } else {
    res.status(401).json({ error: "Credenciales inválidas" });
  }
});

// GET /api/data
app.get('/api/data', (req, res) => {
  const key = req.query.key || 'meg';
  
  if (!validateKey(key)) {
    return res.status(400).json({ error: 'Key inválida' });
  }
  
  db.get('SELECT content FROM app_data WHERE id = ?', [key], (err, row) => {
    if (err) {
      console.error('Error al leer datos:', err);
      return res.status(500).json({ error: 'Error al leer datos' });
    }
    try {
      const data = row ? JSON.parse(row.content) : { cotizaciones: [] };
      res.json(data);
    } catch (e) {
      console.error('Error al parsear datos:', e);
      res.status(500).json({ error: 'Datos corruptos' });
    }
  });
});

// POST /api/data
app.post('/api/data', (req, res) => {
  const key = req.query.key || 'meg';
  
  if (!validateKey(key)) {
    return res.status(400).json({ error: 'Key inválida' });
  }
  
  const { data } = req.body;
  if (!data || typeof data !== 'object') {
    console.error('❌ POST /api/data - Body recibido:', req.body);
    return res.status(400).json({ error: 'Falta el campo "data"' });
  }
  
  try {
    const jsonStr = JSON.stringify(data);
    db.run(
      'INSERT OR REPLACE INTO app_data (id, content, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', 
      [key, jsonStr], 
      function(err) {
        if (err) {
          console.error('Error al guardar:', err);
          return res.status(500).json({ error: 'Error al guardar' });
        }
        console.log(`✅ Guardado en ${key}`);
        res.json({ ok: true });
      }
    );
  } catch (e) {
    console.error('Error al serializar JSON:', e);
    res.status(400).json({ error: 'JSON inválido' });
  }
});

// GET /api/creacion
app.get('/api/creacion', (req, res) => {
  const key = req.query.key || 'meg';
  
  if (!validateKey(key)) {
    return res.status(400).json({ error: 'Key inválida' });
  }
  
  const creacionKey = key + '_creacion';
  
  db.get('SELECT content FROM app_data WHERE id = ?', [creacionKey], (err, row) => {
    if (err) {
      console.error('Error al leer creación:', err);
      return res.status(500).json({ error: 'Error al leer datos de creación' });
    }
    try {
      const data = row ? JSON.parse(row.content) : { clientes: [], cotizaciones: [], ordenesCompra: [] };
      res.json(data);
    } catch (e) {
      console.error('Error al parsear creación:', e);
      res.status(500).json({ error: 'Datos de creación corruptos' });
    }
  });
});

// POST /api/creacion
app.post('/api/creacion', (req, res) => {
  // ✅ LOGS DETALLADOS
  console.log('═══════════════════════════════════════');
  console.log('📥 POST /api/creacion');
  console.log('📥 Content-Type:', req.headers['content-type']);
  console.log('📥 Content-Length:', req.headers['content-length']);
  console.log('📥 req.body:', JSON.stringify(req.body, null, 2));
  console.log('📥 typeof req.body:', typeof req.body);
  console.log('═══════════════════════════════════════');
  
  const key = req.query.key || 'meg';
  
  if (!validateKey(key)) {
    console.error('❌ Key inválida:', key);
    return res.status(400).json({ error: 'Key inválida' });
  }
  
  const creacionKey = key + '_creacion';
  
  // ✅ EXTRAER DATA
  const { data } = req.body;
  
  console.log('📥 data extraída:', data ? 'SÍ' : 'NO');
  console.log('📥 typeof data:', typeof data);
  
  if (!data || typeof data !== 'object') {
    console.error('❌ VALIDACIÓN FALLÓ');
    console.error('   req.body completo:', req.body);
    console.error('   data extraída:', data);
    return res.status(400).json({ error: 'Datos inválidos en creación' });
  }
  
  try {
    const jsonStr = JSON.stringify(data);
    console.log('📥 JSON a guardar (primeros 200 chars):', jsonStr.substring(0, 200));
    
    db.run(
      'INSERT OR REPLACE INTO app_data (id, content, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', 
      [creacionKey, jsonStr], 
      function(err) {
        if (err) {
          console.error('❌ Error al guardar en DB:', err);
          return res.status(500).json({ error: 'Error al guardar datos de creación' });
        }
        console.log('✅ Guardado correctamente en:', creacionKey);
        res.json({ ok: true });
      }
    );
  } catch (e) {
    console.error('❌ Error al serializar:', e);
    res.status(400).json({ error: 'JSON inválido en creación' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido, cerrando...');
  db.close((err) => {
    if (err) console.error('Error al cerrar DB:', err);
    process.exit(err ? 1 : 0);
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend en modo ${NODE_ENV}`);
  console.log(`🚀 Servidor en http://0.0.0.0:${PORT}`);
});