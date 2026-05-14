const Database =
  require('better-sqlite3');
const path =
  require('path');
const fs =
  require('fs');
const os =
  require('os');
// ========================================
// Diretório do banco
// ========================================
// Pasta do app no AppData
const appDataPath =
  path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    'FilaAgentes'
  );
// Cria pasta se não existir
if (
  !fs.existsSync(appDataPath)
) {
  fs.mkdirSync(
    appDataPath,
    { recursive: true }
  );
}
// Caminho banco
const dbPath =
  path.join(
    appDataPath,
    'database.sqlite'
  );
// ========================================
// Conexão
// ========================================
const db =
  new Database(dbPath);
db.pragma('journal_mode = WAL');
// ========================================
// Logs
// ========================================
console.log(
  'Banco conectado em:',
  dbPath
);
// ========================================
// Performance
// ========================================
db.pragma('journal_mode = WAL');
// ========================================
// Tabela agentes
// ========================================
db.prepare(`
    CREATE TABLE IF NOT EXISTS agentes (
        id INTEGER PRIMARY KEY,
        nome TEXT,
        token TEXT,
        ativo INTEGER DEFAULT 1,
        ordem INTEGER
    )
`).run();
// ========================================
// Controle fila
// ========================================
db.prepare(`
    CREATE TABLE IF NOT EXISTS fila_ctrl (
        id INTEGER PRIMARY KEY,
        ultimo_index INTEGER
    )
`).run();
// ========================================
// Registro inicial fila
// ========================================
const filaExiste =
  db.prepare(`
        SELECT *
        FROM fila_ctrl
        WHERE id = 1
    `).get();
if (!filaExiste) {
  db.prepare(`
        INSERT INTO fila_ctrl (
            id,
            ultimo_index
        )
        VALUES (
            1,
            -1
        )
    `).run();
}
// ========================================
// Controle status
// ========================================
db.prepare(`
    CREATE TABLE IF NOT EXISTS controle_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agente_id INTEGER NOT NULL,
        agente_nome TEXT,
        status TEXT NOT NULL,
        data_hora INTEGER NOT NULL
    )
`).run();
// ========================================
// Export
// ========================================
module.exports = db;