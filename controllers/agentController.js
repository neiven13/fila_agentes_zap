const db =
    require('../database/db');
const service =
    require('../services/agentService');
const statusMap =
    require('../config/statusMap');
// ========================================
// FILA
// ========================================
async function listarFila(
    req,
    res
) {
    try {
        const fila =
            await service.montarFila();
        return res.json(fila);
    } catch (err) {
        console.error(
            '[listarFila]',
            err
        );
        return res.status(500).json({
            erro:
                'Erro ao montar fila'
        });
    }
}
// ========================================
// PRÓXIMO AGENTE
// ========================================
async function proximoAgente(
    req,
    res
) {
    try {
        const agente =
            await service.escolherProximo();
        if (!agente) {
            return res.json({
                mensagem:
                    'Nenhum agente disponível'
            });
        }
        return res.json(agente);
    } catch (err) {
        console.error(
            '[proximoAgente]',
            err
        );
        return res.status(500).json({
            erro:
                'Erro ao buscar próximo agente'
        });
    }
}
// ========================================
// UPDATE STATUS
// ========================================
async function updateStatus(
    req,
    res
) {
    try {
        // ========================================
        // VALIDA SESSÃO
        // ========================================
        if (!req.session.user) {
            return res.status(401).json({
                erro: 'Usuário não autenticado'
            });
        }
        const {
            token,
            nome,
            id
        } = req.session.user;
        // ========================================
        // BODY
        // ========================================
        const {
            statusPainel
        } = req.body;
        if (!statusPainel) {
            return res.status(400).json({
                erro: 'Status não informado'
            });
        }
        // ========================================
        // STATUS MAP
        // ========================================
        const statusData =
            statusMap[statusPainel];
        if (!statusData) {
            return res.status(400).json({
                erro: `Status inválido: ${statusPainel}`
            });
        }
        const availability =
            statusData.chatwoot || 'offline';
        // ========================================
        // CHATWOOT
        // ========================================
        const sucesso =
            await service.alterarStatusChatwoot(
                token,
                availability
            );
        if (!sucesso) {
            return res.status(500).json({
                erro: 'Falha na API Chatwoot'
            });
        }
        // ========================================
        // REGISTRO
        // ========================================
        await service.registrarPausa(
            id,
            nome,
            statusPainel
        );
        console.log(
            `[CHATWOOT] ${nome} -> ${statusPainel} (${availability})`
        );
        // ========================================
        // RESPONSE
        // ========================================
        return res.json({
            ok: true,
            status: statusPainel,
            classe: statusData.classe || 'offline'
        });
    } catch (err) {
        console.error(
            '[updateStatus]',
            err
        );
        return res.status(500).json({
            erro: err.message || 'Erro interno'
        });
    }
}
// ========================================
// OFFLINE SILENCIOSO
// ========================================
async function setOfflineSilent(
    userData
) {
    try {
        await service.alterarStatusChatwoot(
            userData.token,
            'offline'
        );
        await service.registrarPausa(
            userData.id,
            userData.nome,
            'Logout'
        );
        console.log(
            `[LOGOUT] ${userData.nome} definido como offline`
        );
    } catch (err) {
        console.error(
            '[setOfflineSilent]',
            err
        );
    }
}
// ========================================
// LISTAR AGENTES
// ========================================
function listar(
    req,
    res
) {
    try {
        const rows =
            db.prepare(`
                SELECT *
                FROM agentes
                ORDER BY ordem ASC
            `).all();
        return res.json(rows);
    } catch (err) {
        console.error(
            '[listar]',
            err
        );
        return res.status(500).json({
            erro:
                'Erro ao listar agentes'
        });
    }
}
// ========================================
// ADICIONAR AGENTE
// ========================================
function add(
    req,
    res
) {
    try {
        const {
            id,
            nome,
            token
        } = req.body;
        const row =
            db.prepare(`
                SELECT MAX(ordem) as max
                FROM agentes
            `).get();
        const ordem =
            (row?.max || 0) + 1;
        db.prepare(`
            INSERT INTO agentes (
                id,
                nome,
                token,
                ordem,
                ativo
            ) VALUES (?, ?, ?, ?, 1)
        `).run(
            id,
            nome,
            token,
            ordem
        );
        return res.json({
            ok: true
        });
    } catch (err) {
        console.error(
            '[add]',
            err
        );
        return res.status(500).json({
            erro:
                'Erro ao adicionar agente'
        });
    }
}
// ========================================
// TOGGLE AGENTE
// ========================================
function toggle(
    req,
    res
) {
    try {
        const { id } =
            req.body;
        db.prepare(`
            UPDATE agentes
            SET ativo =
                CASE
                    WHEN ativo = 1 THEN 0
                    ELSE 1
                END
            WHERE id = ?
        `).run(id);
        return res.json({
            ok: true
        });
    } catch (err) {
        console.error(
            '[toggle]',
            err
        );
        return res.status(500).json({
            erro:
                'Erro ao alterar status'
        });
    }
}
// ========================================
// MOVER PARA CIMA
// ========================================
function up(
    req,
    res
) {
    try {
        const { id } =
            req.body;
        const atual =
            db.prepare(`
                SELECT *
                FROM agentes
                WHERE id = ?
            `).get(id);
        if (!atual) {
            return res.status(404).json({
                erro:
                    'Não encontrado'
            });
        }
        const anterior =
            db.prepare(`
                SELECT *
                FROM agentes
                WHERE ordem < ?
                ORDER BY ordem DESC
                LIMIT 1
            `).get(atual.ordem);
        if (!anterior) {
            return res.json({
                ok: true
            });
        }
        db.prepare(`
            UPDATE agentes
            SET ordem = ?
            WHERE id = ?
        `).run(
            anterior.ordem,
            atual.id
        );
        db.prepare(`
            UPDATE agentes
            SET ordem = ?
            WHERE id = ?
        `).run(
            atual.ordem,
            anterior.id
        );
        return res.json({
            ok: true
        });
    } catch (err) {
        console.error(
            '[up]',
            err
        );
        return res.status(500).json({
            erro:
                'Erro ao mover agente'
        });
    }
}
// ========================================
// MOVER PARA BAIXO
// ========================================
function down(
    req,
    res
) {
    try {
        const { id } =
            req.body;
        const atual =
            db.prepare(`
                SELECT *
                FROM agentes
                WHERE id = ?
            `).get(id);
        if (!atual) {
            return res.status(404).json({
                erro:
                    'Não encontrado'
            });
        }
        const proximo =
            db.prepare(`
                SELECT *
                FROM agentes
                WHERE ordem > ?
                ORDER BY ordem ASC
                LIMIT 1
            `).get(atual.ordem);
        if (!proximo) {
            return res.json({
                ok: true
            });
        }
        db.prepare(`
            UPDATE agentes
            SET ordem = ?
            WHERE id = ?
        `).run(
            proximo.ordem,
            atual.id
        );
        db.prepare(`
            UPDATE agentes
            SET ordem = ?
            WHERE id = ?
        `).run(
            atual.ordem,
            proximo.id
        );
        return res.json({
            ok: true
        });
    } catch (err) {
        console.error(
            '[down]',
            err
        );
        return res.status(500).json({
            erro:
                'Erro ao mover agente'
        });
    }
}
// ========================================
// REORDER DRAG DROP
// ========================================
function reorder(
    req,
    res
) {
    try {
        const {
            dragId,
            targetId
        } = req.body;
        const drag =
            db.prepare(`
                SELECT *
                FROM agentes
                WHERE id = ?
            `).get(dragId);
        const target =
            db.prepare(`
                SELECT *
                FROM agentes
                WHERE id = ?
            `).get(targetId);
        if (!drag || !target) {
            return res.json({
                ok: false
            });
        }
        db.prepare(`
            UPDATE agentes
            SET ordem = ?
            WHERE id = ?
        `).run(
            target.ordem,
            drag.id
        );
        db.prepare(`
            UPDATE agentes
            SET ordem = ?
            WHERE id = ?
        `).run(
            drag.ordem,
            target.id
        );
        return res.json({
            ok: true
        });
    } catch (err) {
        console.error(
            '[reorder]',
            err
        );
        return res.status(500).json({
            erro:
                'Erro ao reordenar agentes'
        });
    }
}
// ========================================
// EXPORT
// ========================================
module.exports = {
    listarFila,
    proximoAgente,
    updateStatus,
    setOfflineSilent,
    listar,
    add,
    toggle,
    up,
    down,
    reorder
};