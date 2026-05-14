const chalk = require('chalk');
const packageJson = require('./package.json');
const express = require('express');
const path = require('path');
const os = require('os');
const session = require('express-session');
const { getConfig } = require('./config');
const config = getConfig();
const agentRoutes = require('./routes/agentRoutes');
const app = express();
app.use(express.json());
/* =========================
   SESSÃO
========================= */
app.use(session({
  name: 'fila.sid',
  secret: config.supervisorToken || 'fila-agentes-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax'
  }
}));
/* =========================
   API
========================= */
app.use('/agents', agentRoutes);
/* =========================
   AUTH MIDDLEWARE
========================= */
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
/* =========================
   ROTAS
========================= */
// HOME
app.get('/', (req, res) => {
  if (req.session.user) {
    if (req.session.user.tipo === 'admin') {
      return res.redirect('/admin');
    }
    if (req.session.user.tipo === 'agente') {
      return res.redirect('/agente');
    }
  }
  res.sendFile(path.join(__dirname, 'public/index.html'));
});
// LOGIN
app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect(
      req.session.user.tipo === 'admin' ? '/admin' : '/agente'
    );
  }
  res.sendFile(path.join(__dirname, 'public/login.html'));
});
// ADMIN
app.get('/admin', requireAuth('admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});
// AGENTE
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
      const agentController = require('./controllers/agentController');
      await agentController.setOfflineSilent(req.session.user);
    } catch (e) {
      console.error('Erro ao deslogar status:', e);
    }
  }
  req.session.destroy(() => {
    res.clearCookie('fila.sid');
    res.redirect('/');
  });
});
/* =========================
   STATIC
========================= */
app.use(express.static(path.join(__dirname, 'public')));
/* =========================
   IP LOCAL
========================= */
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
/* =========================
   START SERVER
========================= */
const PORT = config.porta || 3000;
app.listen(PORT, () => {
  const ip = getLocalIpAddress();
  console.log('-----------------------------------------');
  console.log(
    chalk.green(
      `Fila de Agentes v${packageJson.version}`
    )
  );
  console.log('-----------------------------------------');
  console.log('Servidor rodando!');
  console.log(`Acesso local:   http://localhost:${PORT}`);
  console.log(`Acesso rede:    http://${ip}:${PORT}`);
  console.log('-----------------------------------------');
});