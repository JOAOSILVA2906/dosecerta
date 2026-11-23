// Pedidos: criação, cancelamento, avanço de etapas e a fila automática.
// Toda checagem de "quem pode mexer em qual pedido" acontece aqui, no servidor.
const crypto = require("node:crypto");
const Regras = require("../../compartilhado/regras.js");
const Validacao = require("../../compartilhado/validacao.js");
const { falha } = require("../http/erros.js");

function criarPedidos(repo) {
  function criar(usuario, corpo, agora = Date.now()) {
    const v = Validacao.pedido(corpo);
    if (!v.ok) falha(400, v.erro);
    const entrada = v.dados;

    const montado = Regras.montarPedido(entrada, {
      farmacia: repo.farmacia(entrada.farmaciaId),
      medicamento: id => repo.medicamento(id),
      estoqueDe: (fid, mid) => repo.estoqueDe(fid, mid),
      agora
    });
    if (!montado.ok) falha(422, montado.erro);

    const pedido = { ...montado.pedido, codigoRetirada: String(crypto.randomInt(1000, 10000)) };
    const id = repo.inserirPedido(pedido, usuario.id);

    repo.atualizarContato(usuario.id, usuario.papel === "visitante" ? entrada.nome : usuario.nome, entrada.telefone);
    if (entrada.endereco) repo.salvarEndereco(usuario.id, entrada.endereco);
    return repo.pedido(id);
  }

  // Responde 404 também para pedido de outra pessoa: não revela que o número existe
  function doCliente(usuario, id) {
    const p = repo.pedido(id);
    if (!p || p.clienteId !== usuario.id) falha(404, "Pedido não encontrado.");
    return p;
  }

  function cancelarPeloCliente(usuario, id) {
    const p = doCliente(usuario, id);
    if (p.status !== "pendente") falha(409, "A farmácia já confirmou este pedido. Para cancelar, ligue para a loja.");
    if (!repo.mudarStatus(p.id, "pendente", "cancelado", Date.now(), { motivo: "Cancelado por você." })) {
      falha(409, "O pedido acabou de mudar. Atualize a tela.");
    }
    return repo.pedido(p.id);
  }

  function daFarmacia(farmaciaId, id) {
    const p = repo.pedido(id);
    if (!p || p.farmaciaId !== farmaciaId) falha(404, "Pedido não encontrado.");
    return p;
  }

  // Avança uma etapa. Ao confirmar (pendente → separação), baixa o estoque na mesma transação.
  function aplicarAvanco(p, quando) {
    const proximo = Regras.proximoStatus(p);
    if (!proximo) return { ok: false, erro: "Este pedido já foi finalizado." };
    const baixas = p.status === "pendente" ? p.itens.map(i => ({ farmaciaId: p.farmaciaId, medId: i.medId, qtd: i.qtd })) : [];
    try {
      if (!repo.mudarStatus(p.id, p.status, proximo, quando, { baixas })) return { ok: false, erro: "O pedido acabou de mudar. Atualize a tela." };
    } catch (erro) {
      if (erro.message === "ESTOQUE_INSUFICIENTE") return { ok: false, semEstoque: true, erro: "Sem estoque suficiente para confirmar. Atualize o estoque antes." };
      throw erro;
    }
    return { ok: true };
  }

  function avancarPelaFarmacia(farmaciaId, id) {
    const p = daFarmacia(farmaciaId, id);
    const r = aplicarAvanco(p, Date.now());
    if (!r.ok) falha(409, r.erro);
    return repo.pedido(p.id);
  }

  function recusarPelaFarmacia(farmaciaId, id) {
    const p = daFarmacia(farmaciaId, id);
    if (p.status !== "pendente") falha(409, "Só dá para recusar pedidos aguardando confirmação.");
    if (!repo.mudarStatus(p.id, "pendente", "cancelado", Date.now(), { motivo: "A farmácia não pôde atender este pedido." })) {
      falha(409, "O pedido acabou de mudar. Atualize a tela.");
    }
    return repo.pedido(p.id);
  }

  // Pedidos feitos pelo app andam sozinhos se a farmácia não agir a tempo
  function processarFila(agora = Date.now()) {
    let mudou = false;
    for (let p of repo.pedidosAutomaticosAbertos()) {
      while (p && Regras.DURACAO[p.status]) {
        const prazo = p.historico[p.status] + Regras.DURACAO[p.status];
        if (prazo > agora) break;
        const r = aplicarAvanco(p, prazo);
        if (!r.ok && r.semEstoque) repo.mudarStatus(p.id, "pendente", "cancelado", prazo, { motivo: "Medicamento sem estoque suficiente na farmácia." });
        mudou = true;
        if (!r.ok && !r.semEstoque) break;
        p = repo.pedido(p.id);
      }
    }
    return mudou;
  }

  return { criar, doCliente, cancelarPeloCliente, avancarPelaFarmacia, recusarPelaFarmacia, processarFila };
}

module.exports = { criarPedidos };
