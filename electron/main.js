const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');

// Puerto para el servidor Express local
const EXPRESS_PORT = 3001;

// Configuración del VPS para sincronización
const VPS_CONFIG = {
  baseUrl: 'https://mayorganic.cl',
  timeout: 10000, // 10 segundos
  enabled: true
};

let mainWindow;
let expressServer;
let db;

// Ruta de la base de datos local (en la carpeta de datos del usuario)
const userDataPath = app.getPath('userData');
const localDbPath = path.join(userDataPath, 'data.db');

console.log('User data path:', userDataPath);
console.log('Local DB path:', localDbPath);

// Función helper para hacer requests HTTP al VPS
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: VPS_CONFIG.timeout
    };

    const req = protocol.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsedData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// Función para inicializar la base de datos local
function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(localDbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }

      console.log('Local database connected');

      // Crear tabla si no existe
      db.run(`
        CREATE TABLE IF NOT EXISTS app_data (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating table:', err);
          reject(err);
          return;
        }

        // Insertar datos iniciales si la tabla está vacía
        const initialData = {
          'meg': { cotizaciones: [] },
          'myorganic': { cotizaciones: [] },
          'meg_creacion': { clientes: [], cotizaciones: [], ordenesCompra: [], ordenesTrabajo: [] },
          'myorganic_creacion': { clientes: [], cotizaciones: [], ordenesCompra: [], ordenesTrabajo: [] }
        };

        db.get('SELECT COUNT(*) as count FROM app_data', (err, row) => {
          if (err) {
            console.error('Error checking data:', err);
            reject(err);
            return;
          }

          if (row.count === 0) {
            console.log('Initializing database with default data...');
            const stmt = db.prepare('INSERT OR IGNORE INTO app_data (id, content) VALUES (?, ?)');

            Object.entries(initialData).forEach(([key, value]) => {
              stmt.run(key, JSON.stringify(value));
            });

            stmt.finalize(() => {
              console.log('Database initialized');
              resolve();
            });
          } else {
            console.log('Database already has data');
            resolve();
          }
        });
      });
    });
  });
}

// Función para iniciar el servidor Express local
function startExpressServer() {
  return new Promise((resolve, reject) => {
    const expressApp = express();

    expressApp.use(cors());
    expressApp.use(express.json({ limit: '50mb' }));

    // Endpoint de health check
    expressApp.get('/api/health', (req, res) => {
      res.json({ status: 'ok', mode: 'local' });
    });

    // Endpoint de login (credenciales hardcodeadas, igual que antes)
    expressApp.post('/api/login', (req, res) => {
      const { username, password } = req.body;

      const credentials = {
        'meg_2025': 'meg4731$',
        'myorganic_2025': 'myorganic4731$'
      };

      // Mapeo de username a userKey
      const usernameToKey = {
        'meg_2025': 'meg',
        'myorganic_2025': 'myorganic'
      };

      if (credentials[username] === password) {
        const userKey = usernameToKey[username];
        res.json({
          success: true,
          username,
          userKey,
          company: userKey === 'meg' ? 'MEG Industrial' : 'MyOrganic'
        });
      } else {
        res.status(401).json({ success: false, message: 'Credenciales inválidas' });
      }
    });

    // Endpoint para obtener datos
    expressApp.get('/api/data', (req, res) => {
      const userKey = req.query.key;

      if (!userKey) {
        return res.status(400).json({ error: 'Missing key parameter' });
      }

      db.get('SELECT content, updated_at FROM app_data WHERE id = ?', [userKey], (err, row) => {
        if (err) {
          console.error('Error fetching data:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        if (!row) {
          // Si no existe, retornar estructura vacía
          return res.json({ cotizaciones: [] });
        }

        try {
          const data = JSON.parse(row.content);
          res.json(data);
        } catch (e) {
          console.error('Error parsing data:', e);
          res.status(500).json({ error: 'Data parsing error' });
        }
      });
    });

    // Endpoint para guardar datos
    expressApp.post('/api/data', (req, res) => {
      const userKey = req.query.key;
      const data = req.body;

      if (!userKey) {
        return res.status(400).json({ error: 'Missing key parameter' });
      }

      const content = JSON.stringify(data);

      db.run(
        'INSERT OR REPLACE INTO app_data (id, content, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [userKey, content],
        function(err) {
          if (err) {
            console.error('Error saving data:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          res.json({ success: true, changes: this.changes });
        }
      );
    });

    // Endpoints para el sistema de creación
    expressApp.get('/api/creacion', (req, res) => {
      const userKey = req.query.key;

      if (!userKey) {
        return res.status(400).json({ error: 'Missing key parameter' });
      }

      db.get('SELECT content FROM app_data WHERE id = ?', [userKey], (err, row) => {
        if (err) {
          console.error('Error fetching creacion data:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        if (!row) {
          return res.json({ clientes: [], cotizaciones: [], ordenesCompra: [], ordenesTrabajo: [] });
        }

        try {
          const data = JSON.parse(row.content);
          res.json(data);
        } catch (e) {
          console.error('Error parsing creacion data:', e);
          res.status(500).json({ error: 'Data parsing error' });
        }
      });
    });

    expressApp.post('/api/creacion', (req, res) => {
      const userKey = req.query.key;
      const data = req.body;

      if (!userKey) {
        return res.status(400).json({ error: 'Missing key parameter' });
      }

      const content = JSON.stringify(data);

      // Guardar en SQLite local (SyncManager se encargará del PUSH automáticamente)
      db.run(
        'INSERT OR REPLACE INTO app_data (id, content, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [userKey, content],
        function(err) {
          if (err) {
            console.error('Error saving creacion data:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          console.log(`[SAVE] ✓ Datos guardados localmente para ${userKey}`);
          res.json({ success: true, changes: this.changes });
        }
      );
    });

    // Endpoints de sincronización con VPS
    // GET /api/sync/pull - Descargar datos del VPS y actualizar SQLite local
    expressApp.get('/api/sync/pull', async (req, res) => {
      const userKey = req.query.userKey;

      if (!userKey) {
        return res.status(400).json({ error: 'Missing userKey parameter' });
      }

      if (!VPS_CONFIG.enabled) {
        return res.json({ success: false, message: 'Sync disabled' });
      }

      try {
        console.log(`[SYNC] Pulling data from VPS for ${userKey}...`);

        // 1. Hacer request al VPS
        const vpsUrl = `${VPS_CONFIG.baseUrl}/api/sync/pull?userKey=${encodeURIComponent(userKey)}`;
        const response = await httpRequest(vpsUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.status !== 200) {
          console.error(`[SYNC] VPS returned status ${response.status}`);
          return res.status(response.status).json({
            success: false,
            error: 'VPS sync failed',
            vpsStatus: response.status
          });
        }

        const vpsData = response.data;

        // 2. Guardar datos en SQLite local
        const content = JSON.stringify(vpsData);
        db.run(
          'INSERT OR REPLACE INTO app_data (id, content, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
          [userKey, content],
          function(err) {
            if (err) {
              console.error('[SYNC] Error saving to local DB:', err);
              return res.status(500).json({ success: false, error: 'Local DB error' });
            }

            console.log(`[SYNC] ✓ Data pulled and saved locally for ${userKey}`);
            res.json({
              success: true,
              data: vpsData,
              timestamp: new Date().toISOString()
            });
          }
        );

      } catch (error) {
        console.error('[SYNC] Pull error:', error.message);
        res.status(500).json({
          success: false,
          error: error.message,
          offline: true
        });
      }
    });

    // POST /api/sync/push - Subir datos locales al VPS
    expressApp.post('/api/sync/push', async (req, res) => {
      const userKey = req.query.userKey;
      const data = req.body;

      if (!userKey) {
        return res.status(400).json({ error: 'Missing userKey parameter' });
      }

      if (!VPS_CONFIG.enabled) {
        return res.json({ success: false, message: 'Sync disabled' });
      }

      try {
        console.log(`[SYNC] Pushing data to VPS for ${userKey}...`);

        // 1. Subir al VPS
        const vpsUrl = `${VPS_CONFIG.baseUrl}/api/sync/push?userKey=${encodeURIComponent(userKey)}`;
        const response = await httpRequest(vpsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: data
        });

        if (response.status !== 200) {
          console.error(`[SYNC] VPS push returned status ${response.status}`);
          return res.status(response.status).json({
            success: false,
            error: 'VPS push failed',
            vpsStatus: response.status
          });
        }

        // 2. También guardar en SQLite local
        const content = JSON.stringify(data);
        db.run(
          'INSERT OR REPLACE INTO app_data (id, content, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
          [userKey, content],
          function(err) {
            if (err) {
              console.error('[SYNC] Error saving to local DB after push:', err);
              // No fallar aquí, ya se guardó en VPS
            }

            console.log(`[SYNC] ✓ Data pushed to VPS and saved locally for ${userKey}`);
            res.json({
              success: true,
              timestamp: new Date().toISOString()
            });
          }
        );

      } catch (error) {
        console.error('[SYNC] Push error:', error.message);
        res.status(500).json({
          success: false,
          error: error.message,
          offline: true
        });
      }
    });

    // Iniciar servidor
    expressServer = expressApp.listen(EXPRESS_PORT, () => {
      console.log(`Express server running on port ${EXPRESS_PORT}`);
      resolve();
    });
  });
}

// Crear ventana principal
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../public/logo-meg.png'),
    title: 'MEG Industrial & MyOrganic Sistema',
    backgroundColor: '#ffffff',
    show: false // No mostrar hasta que esté lista
  });

  // Mostrar cuando esté lista para evitar flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // En desarrollo, cargar desde Vite dev server
  // En producción, cargar los archivos estáticos
  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // En producción, cargar desde dist empaquetado
    const appPath = app.getAppPath();
    const indexPath = path.join(appPath, 'dist', 'index.html');
    console.log('Loading from:', indexPath);
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Error loading file:', err);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers para comunicación con el renderer
ipcMain.handle('get-user-data-path', () => {
  return userDataPath;
});

ipcMain.handle('get-local-db-path', () => {
  return localDbPath;
});

ipcMain.handle('sync-with-remote', async (event, remoteUrl) => {
  // TODO: Implementar lógica de sincronización con VPS
  // Por ahora, retornar éxito simulado
  return { success: true, message: 'Sincronización pendiente de implementar' };
});

ipcMain.handle('export-database', async () => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar Base de Datos',
      defaultPath: path.join(app.getPath('downloads'), 'meg-backup.db'),
      filters: [
        { name: 'Database', extensions: ['db'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      fs.copyFileSync(localDbPath, result.filePath);
      return { success: true, path: result.filePath };
    }

    return { success: false, message: 'Exportación cancelada' };
  } catch (error) {
    console.error('Error exporting database:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('import-database', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar Base de Datos',
      filters: [
        { name: 'Database', extensions: ['db'] }
      ],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      // Crear backup antes de importar
      const backupPath = localDbPath + '.backup';
      fs.copyFileSync(localDbPath, backupPath);

      // Cerrar la base de datos actual
      await new Promise((resolve, reject) => {
        db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Copiar la nueva base de datos
      fs.copyFileSync(result.filePaths[0], localDbPath);

      // Reiniciar la base de datos
      await initDatabase();

      return { success: true, message: 'Base de datos importada correctamente' };
    }

    return { success: false, message: 'Importación cancelada' };
  } catch (error) {
    console.error('Error importing database:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('open-pdf', async (event, { name, dataUrl }) => {
  try {
    // Extraer el base64 del data URL
    const base64Data = dataUrl.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Crear archivo temporal con un nombre único
    const tempFileName = `${Date.now()}_${name}`;
    const tempPath = path.join(os.tmpdir(), tempFileName);

    // Escribir el PDF temporalmente
    fs.writeFileSync(tempPath, buffer);

    // Abrir con el visor predeterminado del sistema
    const result = await shell.openPath(tempPath);

    // Si result es un string vacío, significa que se abrió correctamente
    if (result === '') {
      console.log('PDF opened successfully:', tempFileName);

      // Eliminar el archivo temporal después de 30 segundos
      setTimeout(() => {
        try {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
            console.log('Temp PDF cleaned up:', tempFileName);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up temp PDF:', cleanupError);
        }
      }, 30000);

      return { success: true };
    } else {
      console.error('Error opening PDF:', result);
      return { success: false, message: result };
    }
  } catch (error) {
    console.error('Error in open-pdf handler:', error);
    return { success: false, message: error.message };
  }
});

// Inicialización de la aplicación
app.whenReady().then(async () => {
  try {
    console.log('Initializing MEG Sistema...');

    // Inicializar base de datos local
    await initDatabase();

    // Iniciar servidor Express local
    await startExpressServer();

    // Crear ventana principal
    createWindow();

    console.log('Application ready!');
  } catch (error) {
    console.error('Error during initialization:', error);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Cerrar la aplicación cuando todas las ventanas estén cerradas
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Cerrar servidor Express
    if (expressServer) {
      expressServer.close();
    }

    // Cerrar base de datos
    if (db) {
      db.close();
    }

    app.quit();
  }
});

// Cleanup antes de salir
app.on('before-quit', () => {
  if (expressServer) {
    expressServer.close();
  }

  if (db) {
    db.close();
  }
});
