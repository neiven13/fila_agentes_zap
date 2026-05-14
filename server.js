const chalk = require('chalk');
const packageJson = require('./package.json');
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os'); 
const session = require('express-session');
const baseDir = __dirname;
const agentRoutes = require('./routes/agentRoutes');
const app = express();
const configPath = path.join(baseDir, 'config.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  console.error('ERRO: Não foi possível encontrar o arquivo config.json em: ' + configPath);
  config = { porta: 3000 };
}
app.use(express.json());
// 🔐 Configuração de sessão
app.use(session({
  name: 'fila.sid',
  secret: 'fila-agentes-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax'
  }
}));
// 🔌 API
app.use('/agents', agentRoutes);
// 🔐 Middleware de proteção
function requireAuth(tipo) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    if (tipo && req.session.user.tipo !== tipo) {
      return res.redirect('/');
    }
    next();
  };
}
// --- ROTAS DE PÁGINAS ---
// HOME (🏠 Agora com redirecionamento automático por tipo)
app.get('/', (req, res) => {
  if (req.session.user) {
    // Se já estiver logado, identifica o tipo e joga para o painel correto
    if (req.session.user.tipo === 'admin') {
      return res.redirect('/admin');
    } else if (req.session.user.tipo === 'agente') {
      return res.redirect('/agente');
    }
  }
  // Se não estiver logado, mostra a fila pública normal
  res.sendFile(path.join(__dirname, 'public/index.html'));
});
// LOGIN
app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.tipo === 'admin' ? '/admin' : '/agente');
  }
  res.sendFile(path.join(__dirname, 'public/login.html'));
});
// ADMIN
app.get('/admin', requireAuth('admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});
// PAINEL DO AGENTE (🚀 Nova rota para o painel específico)
app.get('/agente', requireAuth('agente'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public/agente.html'));
});
// FILA
app.get('/fila', requireAuth(), (req, res) => {
  res.sendFile(path.join(__dirname, 'public/fila.html'));
});
// NOVO AGENTE
app.get('/novo', requireAuth('admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public/novo.html'));
});
// LOGOUT
app.get('/logout', async (req, res) => {
  if (req.session.user && req.session.user.tipo === 'agente') {
    try {
      // Força o status offline antes de sair
      const agentController = require('./controllers/agentController');
      await agentController.setOfflineSilent(req.session.user);
    } catch (e) {
      console.error("Erro ao deslogar status:", e);
    }
  }
  req.session.destroy(() => {
    res.clearCookie('fila.sid');
    res.redirect('/');
  });
});
app.use(express.static(path.join(__dirname, 'public')));
// 🌐 Função para pegar o IP local
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}
console.log('Iniciando servidor...');
console.log(chalk.green(`\nBem vindo ao controle de fila de agentes!       v${packageJson.version}`));
    console.log("::::::::::::::::::::::::::::::::::::::::::::::::::::::");
    console.log("                      *                               ");
    console.log('       *                                    *         ');
    console.log("                 ░░░░░                             *  ");
    console.log("         ░░░░   ░░░░░░░░░                             ");
    console.log("        ░░░░░░░░░░░░░░░░░░░░░░          *             ");
    console.log("   *                                                  ");
    console.log("                                                      ");
    console.log("    █████ ██  ██ █████   ████  █████  ██████ ██████   ");
    console.log("   ██     ██  ██ ██  ██ ██  ██ ██  ██   ██   ██       ");
    console.log("   ██████ ██  ██ █████  ██  ██ █████    ██   █████    ");
    console.log("       ██ ██  ██ ██     ██  ██ ██  ██   ██   ██       ");
    console.log("   █████   ████  ██      ████  ██   ██  ██   ██████   ");
    console.log("                                                      ");
    console.log("                 ██████  ████  █████        *         ");
    console.log("      *              █  ██  ██ ██  ██                 ");
    console.log("                   ██   ██████ █████                  ");
    console.log("   *       *      █     ██  ██ ██       *        ░░░  ");
    console.log("                 ██████ ██  ██ ██           ░░░░░░░░  ");
    console.log("                                      ░░░░░░░░░░░░░░░░");
    console.log("         *                                            ");
    console.log(":::::::::::::::::::::::::::::::::::::::::::::::::::::\n");
app.listen(config.porta, () => {
  const ip = getLocalIpAddress();
  console.log('-----------------------------------------');
  console.log('Servidor rodando!');
  console.log(`Acesso na rede: http://${ip}:${config.porta}`);
  console.log(`Acesso local:   http://localhost:${config.porta}`);
  console.log('-----------------------------------------');
});