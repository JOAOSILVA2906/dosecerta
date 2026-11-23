// Estoque e catálogo do ponto de vista da farmácia logada.
const Validacao = require("../../compartilhado/validacao.js");
const { falha } = require("../http/erros.js");

function criarEstoque(repo) {
  function definir(farmaciaId, medId, quantidade) {
    if (!repo.medicamento(medId)) falha(404, "Medicamento não encontrado.");
    const v = Validacao.quantidadeEstoque(quantidade);
    if (!v.ok) falha(400, v.erro);
    repo.definirEstoque(farmaciaId, medId, v.dados);
    return { medId, quantidade: v.dados };
  }

  function adicionar(farmacia, corpo) {
    const categorias = repo.catalogo().categorias.map(c => c.id);
    const v = Validacao.novoMedicamento(corpo, categorias);
    if (!v.ok) falha(400, v.erro);
    if (repo.existeMedicamento(v.dados.nome, v.dados.apresentacao)) falha(409, "Este medicamento já está no catálogo. Atualize a quantidade na lista.");
    // o preço informado vale para esta unidade; o preço base é ajustado pelo fator dela
    const id = repo.adicionarMedicamento({ ...v.dados, preco: v.dados.preco / farmacia.fator }, farmacia.id);
    return repo.medicamento(id);
  }

  return { definir, adicionar };
}

module.exports = { criarEstoque };
