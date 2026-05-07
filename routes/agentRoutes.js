const express = require('express');
const router = express.Router();

const controller = require('../controllers/agentController');
const config = require('../config');
const db = require('../database/db');

// 🔐 middleware: Verifica se o usuário está logado
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }
  next();
}

// 🔐 middleware: Verifica se o usuário é administrador
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.tipo !== 'admin') {
    return res.status(403).json({ erro: 'Acesso negado' });
  }
  next();
}

// 🔑 LOGIN (Atualizado para direcionar automaticamente)
router.post('/login', (req, res) => {
  const { token } = req.body;

  // 🧑‍💼 admin: Direciona para o painel administrativo
  if (token === config.supervisorToken) {
    req.session.user = { tipo: 'admin' };
    return res.json({ tipo: 'admin', redirect: '/admin' }); //
  }

  // 👤 agente: Direciona para o painel do agente
  db.get(
    "SELECT * FROM agentes WHERE token = ?",
    [token],
    (err, row) => {
      if (row) {
        // Salvando dados na sessão para a API do Chatwoot
        req.session.user = { 
          tipo: 'agente', 
          id: row.id, 
          token: row.token, 
          nome: row.nome 
        };
        // Retorna o caminho do painel do agente para o frontend[cite: 6]
        return res.json({ tipo: 'agente', redirect: '/agente' }); 
      } else {
        return res.status(401).json({ erro: 'Token inválido' });
      }
    }
  );
});

// 👤 QUEM ESTÁ LOGADO
router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.json({ logado: false });
  }

  res.json({
    logado: true,
    tipo: req.session.user.tipo,
    nome: req.session.user.nome
  });
});

// Atualização de status no Chatwoot
router.post('/update-status', requireAuth, controller.updateStatus);

// 🌐 público
router.get('/fila', controller.listarFila);

// 🔐 autenticado
router.get('/proximo', requireAuth, controller.proximoAgente);

// 🔒 admin
router.get('/admin/list', requireAdmin, controller.listar);
router.post('/admin/add', requireAdmin, controller.add);
router.post('/admin/toggle', requireAdmin, controller.toggle);
router.post('/admin/reorder', requireAdmin, controller.reorder);

module.exports = router;