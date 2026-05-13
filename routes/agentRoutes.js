const express = require('express');
const router = express.Router();
const statusMap = require('../config/statusMap');
const controller = require('../controllers/agentController');
const service = require('../services/agentService');
const config = require('../config');
const db = require('../database/db');
// 🔐 middleware: Verifica se o usuário está logado
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      erro: 'Não autenticado'
    });
  }
  next();
}
// 🔐 middleware: Verifica se o usuário é administrador
function requireAdmin(req, res, next) {
  if (
    !req.session.user ||
    req.session.user.tipo !== 'admin'
  ) {
    return res.status(403).json({
      erro: 'Acesso negado'
    });
  }
  next();
}
// 🔑 LOGIN
router.post('/login', (req, res) => {
  const { token } = req.body;
  // 🧑‍💼 ADMIN
  if (token === config.supervisorToken) {
    req.session.user = {
      tipo: 'admin'
    };
    return res.json({
      tipo: 'admin',
      redirect: '/admin'
    });
  }
  // 👤 AGENTE
  db.get(
    "SELECT * FROM agentes WHERE token = ?",
    [token],
    async (err, row) => {
      if (!row) {
        return res.status(401).json({
          erro: 'Token inválido'
        });
      }
      // sessão
      req.session.user = {
        tipo: 'agente',
        id: row.id,
        token: row.token,
        nome: row.nome
      };
      try {
        // ONLINE CHATWOOT
        await service.alterarStatusChatwoot(
          row.token,
          'online'
        );
        // REGISTRO BANCO
        await service.registrarPausa(
          row.id,
          row.nome,
          'Online'
        );
        console.log(
          `[LOGIN] ${row.nome}`
        );
      } catch (e) {
        console.error(
          '[LOGIN]',
          e
        );
      }
      return res.json({
        tipo: 'agente',
        redirect: '/agente'
      });
    }
  );
});
// 👤 QUEM ESTÁ LOGADO
router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.json({
      logado: false
    });
  }
  const user = req.session.user;
  db.get(`
    SELECT
      status,
      data_hora
    FROM controle_status
    WHERE agente_id = ?
    ORDER BY id DESC
    LIMIT 1
  `,
  [user.id],
  (err, row) => {
    if (err) {
      console.error('[ME]', err);
      return res.status(500).json({
        erro: 'Erro ao buscar status'
      });
    }
    const status =
      row?.status || 'Offline';
    const statusData =
      statusMap[status] || {
        classe: 'offline'
      };
    res.json({
      logado: true,
      tipo: user.tipo,
      nome: user.nome,
      status,
      data_hora:
        row?.data_hora || null,
      status_class:
        statusData.classe,
      timer:
        statusData.timer || null
    });
  });
});
// 🔄 Atualização de status
router.post(
  '/update-status',
  requireAuth,
  controller.updateStatus
);
// 🌐 público
router.get('/fila', controller.listarFila);
// 🔐 autenticado
router.get(
  '/proximo',
  requireAuth,
  controller.proximoAgente
);
// 🔒 admin
router.get(
  '/admin/list',
  requireAdmin,
  controller.listar
);
router.post(
  '/admin/add',
  requireAdmin,
  controller.add
);
router.post(
  '/admin/toggle',
  requireAdmin,
  controller.toggle
);
router.post(
  '/admin/reorder',
  requireAdmin,
  controller.reorder
);
module.exports = router;