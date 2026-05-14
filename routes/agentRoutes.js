const express = require('express');
const router = express.Router();
const statusMap =
    require('../config/statusMap');
const controller =
    require('../controllers/agentController');
const service =
    require('../services/agentService');
const config =
    require('../config');
const db =
    require('../database/db');
// ========================================
// AUTH MIDDLEWARES
// ========================================
function requireAuth(
    req,
    res,
    next
) {
    if (!req.session.user) {
        return res.status(401).json({
            erro: 'Não autenticado'
        });
    }
    next();
}
function requireAdmin(
    req,
    res,
    next
) {
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
// ========================================
// SERVER TIME
// ========================================
router.get(
    '/server-time',
    (req, res) => {
        res.json({
            serverTime: Date.now()
        });
    }
);
// ========================================
// LOGIN
// ========================================
router.post(
    '/login',
    async (req, res) => {
        const { token } = req.body;
        // ========================================
        // ADMIN
        // ========================================
        if (
            token === config.supervisorToken
        ) {
            req.session.user = {
                tipo: 'admin'
            };
            return res.json({
                tipo: 'admin',
                redirect: '/admin'
            });
        }
        // ========================================
        // AGENTE
        // ========================================
        try {
            const row =
                db.prepare(`
                    SELECT *
                    FROM agentes
                    WHERE token = ?
                `).get(token);
            if (!row) {
                return res.status(401).json({
                    erro: 'Token inválido'
                });
            }
            // ========================================
            // SESSÃO
            // ========================================
            req.session.user = {
                tipo: 'agente',
                id: row.id,
                token: row.token,
                nome: row.nome
            };
            // ========================================
            // CHATWOOT
            // ========================================
            await service.alterarStatusChatwoot(
                row.token,
                'online'
            );
            // ========================================
            // REGISTRO STATUS
            // ========================================
            await service.registrarPausa(
                row.id,
                row.nome,
                'Online'
            );
            console.log(
                `[LOGIN] ${row.nome}`
            );
            return res.json({
                tipo: 'agente',
                redirect: '/agente'
            });
        } catch (err) {
            console.error(
                '[LOGIN]',
                err
            );
            return res.status(500).json({
                erro: 'Erro interno no login'
            });
        }
    }
);
// ========================================
// USUÁRIO LOGADO
// ========================================
router.get(
    '/me',
    (req, res) => {
        if (!req.session.user) {
            return res.json({
                logado: false
            });
        }
        const user =
            req.session.user;
        try {
            let row = null;
            // ADMIN não possui status
            if (user.tipo === 'agente') {
                row =
                    db.prepare(`
                        SELECT
                            status,
                            data_hora
                        FROM controle_status
                        WHERE agente_id = ?
                        ORDER BY id DESC
                        LIMIT 1
                    `).get(user.id);
            }
            const status =
                row?.status || 'Offline';
            const statusData =
                statusMap[status] || {
                    classe: 'offline'
                };
            return res.json({
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
        } catch (err) {
            console.error(
                '[ME]',
                err
            );
            return res.status(500).json({
                erro:
                    'Erro ao buscar status'
            });
        }
    }
);
// ========================================
// UPDATE STATUS
// ========================================
router.post(
    '/update-status',
    requireAuth,
    controller.updateStatus
);
// ========================================
// FILA PÚBLICA
// ========================================
router.get(
    '/fila',
    controller.listarFila
);
// ========================================
// PRÓXIMO AGENTE
// ========================================
router.get(
    '/proximo',
    requireAuth,
    controller.proximoAgente
);
// ========================================
// ADMIN
// ========================================
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
// ========================================
// EXPORT
// ========================================
module.exports = router;