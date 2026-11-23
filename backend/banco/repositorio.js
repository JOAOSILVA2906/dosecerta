// Acesso ao banco. Único lugar com SQL; todas as consultas usam parâmetros (?),
// nunca texto do usuário montado dentro da query, o que impede SQL injection.
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const reais = centavos => centavos / 100;
const centavos = valor => Math.round(valor * 100);

function abrir(arquivo) {
  if (arquivo !== ":memory:") fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const db = new DatabaseSync(arquivo);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;");
  if (arquivo !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  return criarRepositorio(db);
}

function criarRepositorio(db) {
  const q = sql => db.prepare(sql);

  function transacao(fn) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const resultado = fn();
      db.exec("COMMIT");
      return resultado;
    } catch (erro) {
      db.exec("ROLLBACK");
      throw erro;
    }
  }

  /* ---------- catálogo ---------- */

  const farmaciaDaLinha = f => ({
    id: f.id, nome: f.nome, endereco: f.endereco, bairro: f.bairro, lat: f.lat, lng: f.lng,
    horario: f.abre ? { abre: f.abre, fecha: f.fecha } : null,
    telefone: f.telefone, nota: f.nota, avaliacoes: f.avaliacoes, fator: f.fator_preco
  });

  const medicamentoDaLinha = m => ({
    id: m.id, nome: m.nome, apresentacao: m.apresentacao, forma: m.forma, categoria: m.categoria_id,
    preco: reais(m.preco_base_centavos), receita: m.receita, generico: Boolean(m.generico)
  });

  function catalogo() {
    const estoque = {};
    for (const linha of q("SELECT farmacia_id, medicamento_id, quantidade FROM estoque").all()) {
      (estoque[linha.farmacia_id] ??= {})[linha.medicamento_id] = linha.quantidade;
    }
    return {
      categorias: q("SELECT id, nome, cor FROM categorias ORDER BY rowid").all().map(c => ({ ...c })),
      medicamentos: q("SELECT * FROM medicamentos ORDER BY id").all().map(medicamentoDaLinha),
      farmacias: q("SELECT * FROM farmacias ORDER BY id").all().map(farmaciaDaLinha),
      estoque
    };
  }

  const farmacia = id => {
    const linha = q("SELECT * FROM farmacias WHERE id = ?").get(id);
    return linha ? farmaciaDaLinha(linha) : null;
  };
  const medicamento = id => {
    const linha = q("SELECT * FROM medicamentos WHERE id = ?").get(id);
    return linha ? medicamentoDaLinha(linha) : null;
  };
  const estoqueDe = (farmaciaId, medId) =>
    q("SELECT quantidade FROM estoque WHERE farmacia_id = ? AND medicamento_id = ?").get(farmaciaId, medId)?.quantidade ?? 0;

  function definirEstoque(farmaciaId, medId, quantidade) {
    q(`INSERT INTO estoque (farmacia_id, medicamento_id, quantidade) VALUES (?, ?, ?)
       ON CONFLICT (farmacia_id, medicamento_id) DO UPDATE SET quantidade = excluded.quantidade`).run(farmaciaId, medId, quantidade);
  }

  function adicionarMedicamento(dados, farmaciaId) {
    return transacao(() => {
      const r = q(`INSERT INTO medicamentos (nome, apresentacao, forma, categoria_id, preco_base_centavos, receita, generico, cadastrado_por)
                   VALUES (?, ?, 'comprimido', ?, ?, ?, 0, ?)`)
        .run(dados.nome, dados.apresentacao, dados.categoria, centavos(dados.preco), dados.receita, farmaciaId);
      const id = Number(r.lastInsertRowid);
      definirEstoque(farmaciaId, id, dados.quantidade);
      return id;
    });
  }

  const existeMedicamento = (nome, apresentacao) =>
    Boolean(q("SELECT 1 FROM medicamentos WHERE nome = ? COLLATE NOCASE AND apresentacao = ? COLLATE NOCASE").get(nome, apresentacao));

  /* ---------- usuários e sessões ---------- */

  const usuarioDaLinha = u => u && ({
    id: u.id, nome: u.nome, email: u.email, papel: u.papel, farmaciaId: u.farmacia_id,
    telefone: u.telefone, notificacoesLidas: u.notificacoes_lidas
  });

  const usuarioPorEmail = email => q("SELECT * FROM usuarios WHERE email = ?").get(email);
  const usuario = id => usuarioDaLinha(q("SELECT * FROM usuarios WHERE id = ?").get(id));

  function criarUsuario({ nome, email = null, senhaHash = null, papel, farmaciaId = null, telefone = null }) {
    const r = q(`INSERT INTO usuarios (nome, email, senha_hash, papel, farmacia_id, telefone, criado_em)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`).run(nome, email, senhaHash, papel, farmaciaId, telefone, Date.now());
    return Number(r.lastInsertRowid);
  }

  const atualizarContato = (id, nome, telefone) => q("UPDATE usuarios SET nome = ?, telefone = ? WHERE id = ?").run(nome, telefone, id);
  const atualizarNome = (id, nome) => q("UPDATE usuarios SET nome = ? WHERE id = ?").run(nome, id);
  const marcarLidas = (id, quando) => q("UPDATE usuarios SET notificacoes_lidas = ? WHERE id = ?").run(quando, id);

  const criarSessao = (tokenHash, usuarioId, expira) =>
    q("INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES (?, ?, ?)").run(tokenHash, usuarioId, expira);
  function sessao(tokenHash) {
    const linha = q(`SELECT u.* FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
                     WHERE s.token_hash = ? AND s.expira_em > ?`).get(tokenHash, Date.now());
    return usuarioDaLinha(linha);
  }
  const apagarSessao = tokenHash => q("DELETE FROM sessoes WHERE token_hash = ?").run(tokenHash);
  const apagarSessoesDoUsuario = usuarioId => q("DELETE FROM sessoes WHERE usuario_id = ?").run(usuarioId);
  const limparSessoesVencidas = () => q("DELETE FROM sessoes WHERE expira_em <= ?").run(Date.now());

  function endereco(usuarioId) {
    const e = q("SELECT cep, rua, numero, bairro, complemento, lat, lng FROM enderecos WHERE usuario_id = ?").get(usuarioId);
    return e ? { ...e } : null;
  }
  function salvarEndereco(usuarioId, e) {
    q(`INSERT INTO enderecos (usuario_id, cep, rua, numero, bairro, complemento, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (usuario_id) DO UPDATE SET cep = excluded.cep, rua = excluded.rua, numero = excluded.numero,
       bairro = excluded.bairro, complemento = excluded.complemento, lat = excluded.lat, lng = excluded.lng`)
      .run(usuarioId, e.cep || null, e.rua, e.numero, e.bairro, e.complemento || null, e.lat, e.lng);
  }

  /* ---------- pedidos ---------- */

  function montar(linha) {
    if (!linha) return null;
    const itens = q("SELECT medicamento_id, nome, apresentacao, quantidade, preco_centavos FROM pedido_itens WHERE pedido_id = ?")
      .all(linha.id)
      .map(i => ({ medId: i.medicamento_id, nome: i.nome, apresentacao: i.apresentacao, qtd: i.quantidade, preco: reais(i.preco_centavos) }));
    const historico = {};
    for (const h of q("SELECT status, quando FROM pedido_historico WHERE pedido_id = ?").all(linha.id)) historico[h.status] = h.quando;
    return {
      id: linha.id,
      farmaciaId: linha.farmacia_id,
      clienteId: linha.usuario_id,
      clienteNome: linha.cliente_nome,
      telefone: linha.telefone,
      tipo: linha.tipo,
      status: linha.status,
      itens,
      subtotal: reais(linha.subtotal_centavos),
      taxa: reais(linha.taxa_centavos),
      total: reais(linha.total_centavos),
      pagamento: linha.pagamento,
      troco: linha.troco_centavos == null ? null : reais(linha.troco_centavos),
      receita: linha.receita_arquivo,
      endereco: linha.endereco_texto ? { texto: linha.endereco_texto, lat: linha.lat, lng: linha.lng } : null,
      bairro: linha.bairro,
      codigoRetirada: linha.codigo_retirada,
      prazo: linha.prazo_minutos,
      motivo: linha.motivo,
      auto: Boolean(linha.automatico),
      criado: linha.criado_em,
      historico
    };
  }

  const pedido = id => montar(q("SELECT * FROM pedidos WHERE id = ?").get(id));
  const pedidosDoUsuario = usuarioId => q("SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY criado_em DESC").all(usuarioId).map(montar);
  const pedidosDaFarmacia = farmaciaId => q("SELECT * FROM pedidos WHERE farmacia_id = ? ORDER BY criado_em DESC LIMIT 500").all(farmaciaId).map(montar);
  const pedidosAutomaticosAbertos = () =>
    q("SELECT * FROM pedidos WHERE automatico = 1 AND status NOT IN ('concluido', 'cancelado')").all().map(montar);

  function inserirPedido(p, usuarioId, id = null) {
    return transacao(() => {
      const r = q(`INSERT INTO pedidos (id, farmacia_id, usuario_id, cliente_nome, telefone, tipo, status, subtotal_centavos, taxa_centavos,
                   total_centavos, pagamento, troco_centavos, receita_arquivo, endereco_texto, lat, lng, bairro, codigo_retirada,
                   prazo_minutos, motivo, automatico, criado_em)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, p.farmaciaId, usuarioId, p.clienteNome, p.telefone, p.tipo, p.status, centavos(p.subtotal), centavos(p.taxa),
          centavos(p.total), p.pagamento, p.troco == null ? null : centavos(p.troco), p.receita, p.endereco?.texto ?? null,
          p.endereco?.lat ?? null, p.endereco?.lng ?? null, p.bairro, p.codigoRetirada, p.prazo, p.motivo ?? null,
          p.auto ? 1 : 0, p.criado);
      const pedidoId = Number(r.lastInsertRowid);
      const item = q("INSERT INTO pedido_itens (pedido_id, medicamento_id, nome, apresentacao, quantidade, preco_centavos) VALUES (?, ?, ?, ?, ?, ?)");
      for (const i of p.itens) item.run(pedidoId, i.medId, i.nome, i.apresentacao, i.qtd, centavos(i.preco));
      const hist = q("INSERT INTO pedido_historico (pedido_id, status, quando) VALUES (?, ?, ?)");
      for (const [status, quando] of Object.entries(p.historico)) hist.run(pedidoId, status, quando);
      return pedidoId;
    });
  }

  // Muda a etapa do pedido só se ele ainda estiver na etapa esperada (evita duas mudanças ao mesmo tempo)
  function mudarStatus(id, de, para, quando, { motivo = null, baixas = [] } = {}) {
    return transacao(() => {
      const r = q("UPDATE pedidos SET status = ?, motivo = COALESCE(?, motivo) WHERE id = ? AND status = ?").run(para, motivo, id, de);
      if (r.changes !== 1) return false;
      q("INSERT OR REPLACE INTO pedido_historico (pedido_id, status, quando) VALUES (?, ?, ?)").run(id, para, quando);
      const baixa = q(`UPDATE estoque SET quantidade = quantidade - ?
                       WHERE farmacia_id = ? AND medicamento_id = ? AND quantidade >= ?`);
      for (const b of baixas) {
        if (baixa.run(b.qtd, b.farmaciaId, b.medId, b.qtd).changes !== 1) throw new Error("ESTOQUE_INSUFICIENTE");
      }
      return true;
    });
  }

  const totalFarmacias = () => q("SELECT COUNT(*) AS n FROM farmacias").get().n;

  return {
    db, transacao,
    catalogo, farmacia, medicamento, estoqueDe, definirEstoque, adicionarMedicamento, existeMedicamento,
    usuarioPorEmail, usuario, criarUsuario, atualizarContato, atualizarNome, marcarLidas,
    criarSessao, sessao, apagarSessao, apagarSessoesDoUsuario, limparSessoesVencidas,
    endereco, salvarEndereco,
    pedido, pedidosDoUsuario, pedidosDaFarmacia, pedidosAutomaticosAbertos, inserirPedido, mudarStatus,
    totalFarmacias
  };
}

module.exports = { abrir };
