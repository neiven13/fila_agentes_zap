const fetch = require('node-fetch');
const db = require('../database/db');
const config = require('../config');
const statusMap = require('../config/statusMap');
const STATUS_URL = `${config.chatUrl}/api/v1/accounts/${config.accountId}/agents`;
const CONVERSAS_URL = `${config.chatUrl}/api/v1/accounts/${config.accountId}/conversations/meta?status=open`;
let cacheFila = [];
let ultimaAtualizacao = 0;
const CACHE_TTL = 5000; 
// 🚩 Variável em memória para rastrear o destaque visual
let ultimoIdChamado = null;
async function getStatusAgentes() {
  try {
    const response = await fetch(STATUS_URL, {
      headers: { 'api_access_token': config.supervisorToken }
    });
    return await response.json();
  } catch {
    return null;
  }
}
async function getConversasAgente(token) {
  try {
    const response = await fetch(CONVERSAS_URL, {
      headers: { 'api_access_token': token }
    });
    const data = await response.json();
    return data?.meta?.mine_count ?? 0;
  } catch {
    return 0;
  }
}
function getAgentesDB() {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM agentes WHERE ativo = 1 ORDER BY ordem ASC",
      [],
      (err, rows) => err ? reject(err) : resolve(rows)
    );
  });
}
async function montarFila() {
  const agora = Date.now();
  // CACHE
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
  const agentes = await getAgentesDB();
  const statusApi = await getStatusAgentes();
  if (!statusApi) {
    return cacheFila.map(agente => ({
      ...agente,
      ultimoChamado:
        agente.id === ultimoIdChamado
    }));
  }
  const resultado = await Promise.all(
    agentes.map(async (agente) => {
      // STATUS CHATWOOT
      const statusChatwoot =
        statusApi.find(s => s.id === agente.id);
      // ÚLTIMO STATUS INTERNO
      const controleStatus =
        await new Promise((resolve, reject) => {
          db.get(`
            SELECT
              status,
              data_hora
            FROM controle_status
            WHERE agente_id = ?
            ORDER BY id DESC
            LIMIT 1
          `,
          [agente.id],
          (err, row) => {
            if (err) {
              return reject(err);
            }
            resolve(row);
          });
        });
      const conversas =
        await getConversasAgente(
          agente.token
        );
      const statusSistema =
        controleStatus?.status || 'Offline';
      const statusData =
        statusMap[statusSistema] || {
          classe: 'offline'
        };
      return {
        id: agente.id,
        nome: agente.nome,
        // CHATWOOT
        availability:
          statusChatwoot?.availability_status || 'offline',
        // STATUS SISTEMA
        status: statusSistema,
        status_class:
          statusData.classe,
        timer:
          statusData.timer || null,
        data_hora:
          controleStatus?.data_hora || null,
        conversas,
        ultimoChamado:
          agente.id === ultimoIdChamado
      };
    })
  );
  cacheFila = resultado;
  ultimaAtualizacao = agora;
  return resultado;
}
function getUltimoIndex() {
  return new Promise((resolve) => {
    db.get("SELECT ultimo_index FROM fila_ctrl WHERE id = 1", (err, row) => {
      resolve(row?.ultimo_index ?? -1);
    });
  });
}
function setUltimoIndex(index) {
  db.run("UPDATE fila_ctrl SET ultimo_index = ? WHERE id = 1", [index]);
}
async function escolherProximo() {
  const fila = await montarFila();
  if (!fila || fila.length === 0) return null;
  let ultimoIndex = await getUltimoIndex();
  const tamanho = fila.length;
  for (let i = 1; i <= tamanho; i++) {
    const index = (ultimoIndex + i) % tamanho;
    const agente = fila[index];
    if (agente.status === 'online' && agente.conversas < 5) {
      setUltimoIndex(index);
      ultimoIdChamado = agente.id; // ✅ Define o destaque
      return agente;
    }
  }
  for (let i = 1; i <= tamanho; i++) {
    const index = (ultimoIndex + i) % tamanho;
    const agente = fila[index];
    if (agente.status === 'online') {
      setUltimoIndex(index);
      ultimoIdChamado = agente.id; // ✅ Define o destaque
      return agente;
    }
  }
  return null;
}
async function alterarStatusChatwoot(token, availability) {
  const url = `${config.chatUrl}/api/v1/profile/availability`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': token
      },
      body: JSON.stringify({
        profile: {
          availability: availability,
          account_id: config.accountId
        }
      })
    });
    return response.ok;
  } catch (err) {
    console.error("Erro no Service ao mudar status:", err);
    return false;
  }
}
async function registrarPausa(
  agente_id,
  agente_nome,
  status
) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO controle_status (
        agente_id,
        agente_nome,
        status
      )
      VALUES (?, ?, ?)
    `,
    [
      agente_id,
      agente_nome,
      status
    ],
    (err) => {
      if (err) {
        console.error(
          '[registrarPausa]',
          err
        );
        reject(err);
      } else {
        resolve(true);
      }
    });
  });
}
module.exports = {
  montarFila,
  escolherProximo,
  alterarStatusChatwoot,registrarPausa
};
