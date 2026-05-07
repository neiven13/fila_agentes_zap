const db = require('../database/db');
const service = require('../services/agentService');

const statusMapping = {
  'Online': 'online',
  'Banheiro': 'offline',
  'Almoço': 'offline',
  'Treinamento': 'busy',
  'Prova': 'busy',
  'Pausa - Suporte': 'busy'
};

async function listarFila(req, res) {
  try {
    const fila = await service.montarFila();
    res.json(fila);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao montar fila' });
  }
}

async function proximoAgente(req, res) {
  try {
    const agente = await service.escolherProximo();
    if (!agente) return res.json({ mensagem: 'Nenhum agente disponível' });
    res.json(agente);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar próximo agente' });
  }
}

async function updateStatus(req, res) {
  const { statusPainel } = req.body;
  const { token, nome } = req.session.user;
  const availability = statusMapping[statusPainel] || 'offline';

  try {
    const sucesso = await service.alterarStatusChatwoot(token, availability);
    if (sucesso) {
      console.log(`\n[CHATWOOT] ${nome} -> ${statusPainel} (${availability})`);
      return res.json({ ok: true });
    }
    res.status(500).json({ erro: 'Falha na API Chatwoot' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
}

async function setOfflineSilent(userData) {
  try {
    await service.alterarStatusChatwoot(userData.token, 'offline');
    console.log(`[LOGOUT] ${userData.nome} definido como offline`);
  } catch (err) {
    console.error('Erro logout:', err);
  }
}

function listar(req, res) {
  db.all("SELECT * FROM agentes ORDER BY ordem ASC", [], (err, rows) => {
    res.json(rows);
  });
}

function add(req, res) {
  const { id, nome, token } = req.body;
  db.get("SELECT MAX(ordem) as max FROM agentes", [], (err, row) => {
    const ordem = (row?.max || 0) + 1;
    db.run(
      "INSERT INTO agentes (id, nome, token, ordem, ativo) VALUES (?, ?, ?, ?, 1)",
      [id, nome, token, ordem],
      () => res.json({ ok: true })
    );
  });
}

function toggle(req, res) {
  const { id } = req.body;
  db.run(
    "UPDATE agentes SET ativo = CASE WHEN ativo = 1 THEN 0 ELSE 1 END WHERE id = ?",
    [id],
    () => res.json({ ok: true })
  );
}

function up(req, res) {
  const { id } = req.body;
  db.get("SELECT * FROM agentes WHERE id = ?", [id], (err, atual) => {
    if (!atual) return res.status(404).json({ erro: 'Não encontrado' });
    db.get(
      "SELECT * FROM agentes WHERE ordem < ? ORDER BY ordem DESC LIMIT 1",
      [atual.ordem],
      (err, anterior) => {
        if (!anterior) return res.json({ ok: true });
        db.run("UPDATE agentes SET ordem = ? WHERE id = ?", [anterior.ordem, atual.id]);
        db.run("UPDATE agentes SET ordem = ? WHERE id = ?", [atual.ordem, anterior.id]);
        res.json({ ok: true });
      }
    );
  });
}

function down(req, res) {
  const { id } = req.body;
  db.get("SELECT * FROM agentes WHERE id = ?", [id], (err, atual) => {
    if (!atual) return res.status(404).json({ erro: 'Não encontrado' });
    db.get(
      "SELECT * FROM agentes WHERE ordem > ? ORDER BY ordem ASC LIMIT 1",
      [atual.ordem],
      (err, proximo) => {
        if (!proximo) return res.json({ ok: true });
        db.run("UPDATE agentes SET ordem = ? WHERE id = ?", [proximo.ordem, atual.id]);
        db.run("UPDATE agentes SET ordem = ? WHERE id = ?", [atual.ordem, proximo.id]);
        res.json({ ok: true });
      }
    );
  });
}

function reorder(req, res) {
  const { dragId, targetId } = req.body;
  db.get("SELECT * FROM agentes WHERE id = ?", [dragId], (err, drag) => {
    db.get("SELECT * FROM agentes WHERE id = ?", [targetId], (err, target) => {
      if (!drag || !target) return res.json({ ok: false });
      db.run("UPDATE agentes SET ordem = ? WHERE id = ?", [target.ordem, drag.id]);
      db.run("UPDATE agentes SET ordem = ? WHERE id = ?", [drag.ordem, target.id]);
      res.json({ ok: true });
    });
  });
}

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