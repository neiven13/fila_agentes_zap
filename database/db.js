const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 📂 Define o diretório base (onde o .exe está localizado)
const baseDir = process.pkg ? path.dirname(process.execPath) : path.join(__dirname, '..');

// 🗄️ Define o caminho do banco de dados na pasta 'database' fora do .exe
const dbFolder = path.join(baseDir, 'database');
const dbPath = path.join(dbFolder, 'database.sqlite');

// Garante que a pasta 'database' exista antes de tentar criar o arquivo .sqlite
if (!fs.existsSync(dbFolder)) {
  fs.mkdirSync(dbFolder, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao abrir o banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco de dados em: ' + dbPath);
  }
});

db.serialize(() => {
  // tabela agentes
  db.run(`
    CREATE TABLE IF NOT EXISTS agentes (
      id INTEGER PRIMARY KEY,
      nome TEXT,
      token TEXT,
      ativo INTEGER DEFAULT 1,
      ordem INTEGER
    )
  `);

  // tabela controle fila
  db.run(`
    CREATE TABLE IF NOT EXISTS fila_ctrl (
      id INTEGER PRIMARY KEY,
      ultimo_index INTEGER
    )
  `);

  // garante registro único
  db.get("SELECT * FROM fila_ctrl WHERE id = 1", (err, row) => {
    if (!row) {
      db.run("INSERT INTO fila_ctrl (id, ultimo_index) VALUES (1, -1)");
    }
  });
});

module.exports = db;