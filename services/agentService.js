const fetch =
    require('node-fetch');
const db =
    require('../database/db');
const config =
    require('../config');
const statusMap =
    require('../config/statusMap');
// ========================================
// URLS
// ========================================
const STATUS_URL =
    `${config.chatUrl}/api/v1/accounts/${config.accountId}/agents`;
const CONVERSAS_URL =
    `${config.chatUrl}/api/v1/accounts/${config.accountId}/conversations/meta?status=open`;
// ========================================
// CACHE
// ========================================
let cacheFila = [];
let ultimaAtualizacao = 0;
const CACHE_TTL = 5000;
// ========================================
// DESTAQUE VISUAL
// ========================================
let ultimoIdChamado = null;
// ========================================
// STATUS CHATWOOT
// ========================================
async function getStatusAgentes() {
    try {
        const response =
            await fetch(STATUS_URL, {
                headers: {
                    'api_access_token':
                        config.supervisorToken
                }
            });
        return await response.json();
    } catch {
        return null;
    }
}
// ========================================
// CONVERSAS AGENTE
// ========================================
async function getConversasAgente(
    token
) {
    try {
        const response =
            await fetch(CONVERSAS_URL, {
                headers: {
                    'api_access_token':
                        token
                }
            });
        const data =
            await response.json();
        return data?.meta?.mine_count ?? 0;
    } catch {
        return 0;
    }
}
// ========================================
// AGENTES DB
// ========================================
function getAgentesDB() {
    return db.prepare(`
        SELECT *
        FROM agentes
        WHERE ativo = 1
        ORDER BY ordem ASC
    `).all();
}
// ========================================
// MONTAR FILA
// ========================================
async function montarFila() {
    const agora =
        Date.now();
    // ========================================
    // CACHE
    // ========================================
    if (
        agora - ultimaAtualizacao < CACHE_TTL &&
        cacheFila.length > 0
    ) {
        return cacheFila.map(agente => ({
            ...agente,
            ultimoChamado:
                agente.id === ultimoIdChamado
        }));
    }
    const agentes =
        getAgentesDB();
    const statusApi =
        await getStatusAgentes();
    // ========================================
    // FALLBACK CACHE
    // ========================================
    if (!statusApi) {
        return cacheFila.map(agente => ({
            ...agente,
            ultimoChamado:
                agente.id === ultimoIdChamado
        }));
    }
    // ========================================
    // FILA
    // ========================================
    const resultado =
        await Promise.all(
            agentes.map(async (agente) => {
                // CHATWOOT
                const statusChatwoot =
                    statusApi.find(
                        s => s.id === agente.id
                    );
                // STATUS INTERNO
                const controleStatus =
                    db.prepare(`
                        SELECT
                            status,
                            data_hora
                        FROM controle_status
                        WHERE agente_id = ?
                        ORDER BY id DESC
                        LIMIT 1
                    `).get(agente.id);
                // CONVERSAS
                const conversas =
                    await getConversasAgente(
                        agente.token
                    );
                // STATUS SISTEMA
                const statusSistema =
                    controleStatus?.status ||
                    'Offline';
                const statusData =
                    statusMap[statusSistema] || {
                        classe: 'offline'
                    };
                return {
                    id: agente.id,
                    nome: agente.nome,
                    // CHATWOOT
                    availability:
                        statusChatwoot?.availability_status ||
                        'offline',
                    // SISTEMA
                    status:
                        statusSistema,
                    status_class:
                        statusData.classe,
                    timer:
                        statusData.timer || null,
                    data_hora:
                        controleStatus?.data_hora || null,
                    // CHATWOOT
                    conversas,
                    // VISUAL
                    ultimoChamado:
                        agente.id === ultimoIdChamado
                };
            })
        );
    cacheFila =
        resultado;
    ultimaAtualizacao =
        agora;
    return resultado;
}
// ========================================
// ÚLTIMO INDEX
// ========================================
function getUltimoIndex() {
    const row =
        db.prepare(`
            SELECT ultimo_index
            FROM fila_ctrl
            WHERE id = 1
        `).get();
    return row?.ultimo_index ?? -1;
}
// ========================================
// SET INDEX
// ========================================
function setUltimoIndex(index) {
    db.prepare(`
        UPDATE fila_ctrl
        SET ultimo_index = ?
        WHERE id = 1
    `).run(index);
}
// ========================================
// ESCOLHER PRÓXIMO
// ========================================
async function escolherProximo() {
    const fila =
        await montarFila();
    if (!fila || fila.length === 0) {
        return null;
    }
    const transaction =
        db.transaction(() => {
            let ultimoIndex =
                getUltimoIndex();
            const tamanho =
                fila.length;
            // ====================================
            // PRIORIDADE
            // ====================================
            for (let i = 1; i <= tamanho; i++) {
                const index =
                    (ultimoIndex + i) % tamanho;
                const agente =
                    fila[index];
                const statusData =
                    statusMap[agente.status];
                const online =
                    statusData?.chatwoot === 'online';
                if (
                    online &&
                    agente.conversas < 5
                ) {
                    setUltimoIndex(index);
                    ultimoIdChamado =
                        agente.id;
                    return agente;
                }
            }
            // ====================================
            // FALLBACK
            // ====================================
            for (let i = 1; i <= tamanho; i++) {
                const index =
                    (ultimoIndex + i) % tamanho;
                const agente =
                    fila[index];
                const statusData =
                    statusMap[agente.status];
                const online =
                    statusData?.chatwoot === 'online';
                if (online) {
                    setUltimoIndex(index);
                    ultimoIdChamado =
                        agente.id;
                    return agente;
                }
            }
            return null;
        });
    return transaction();
}
// ========================================
// ALTERAR STATUS CHATWOOT
// ========================================
async function alterarStatusChatwoot(
    token,
    availability
) {
    const url =
        `${config.chatUrl}/api/v1/profile/availability`;
    try {
        const response =
            await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type':
                        'application/json',
                    'api_access_token':
                        token
                },
                body: JSON.stringify({
                    profile: {
                        availability,
                        account_id:
                            config.accountId
                    }
                })
            });
        return response.ok;
    } catch (err) {
        console.error(
            '[alterarStatusChatwoot]',
            err
        );
        return false;
    }
}
// ========================================
// REGISTRAR PAUSA
// ========================================
async function registrarPausa(
    agente_id,
    agente_nome,
    status
) {
    try {
        db.prepare(`
            INSERT INTO controle_status (
                agente_id,
                agente_nome,
                status,
                data_hora
            ) VALUES (?, ?, ?, ?)
        `).run(
            agente_id,
            agente_nome,
            status,
            Date.now()
        );
        return true;
    } catch (err) {
        console.error(
            '[registrarPausa]',
            err
        );
        return false;
    }
}
// ========================================
// EXPORT
// ========================================
module.exports = {
    montarFila,
    escolherProximo,
    alterarStatusChatwoot,
    registrarPausa
};