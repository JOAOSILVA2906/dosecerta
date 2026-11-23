// Preenche o banco vazio com o catálogo, as farmácias, o estoque inicial e pedidos de exemplo.
const Dados = require("../../compartilhado/dados-iniciais.js");
const Regras = require("../../compartilhado/regras.js");
const senhas = require("../seguranca/senhas.js");

async function popular(repo, { contasTeste = true } = {}) {
  if (repo.totalFarmacias() > 0) return false;

  // hashes calculados antes da transação (scrypt é assíncrono)
  const hashes = new Map();
  if (contasTeste) {
    for (const conta of Dados.contasTeste) hashes.set(conta.email, await senhas.gerarHash(conta.senha));
  }

  repo.transacao(() => {
    const { db } = repo;
    const cat = db.prepare("INSERT INTO categorias (id, nome, cor) VALUES (?, ?, ?)");
    Dados.categorias.forEach(c => cat.run(c.id, c.nome, c.cor));

    const farm = db.prepare(`INSERT INTO farmacias (id, nome, endereco, bairro, lat, lng, abre, fecha, telefone, nota, avaliacoes, fator_preco)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    Dados.farmacias.forEach(f => farm.run(f.id, f.nome, f.endereco, f.bairro, f.lat, f.lng,
      f.horario?.abre ?? null, f.horario?.fecha ?? null, f.telefone, f.nota, f.avaliacoes, f.fator));

    const med = db.prepare(`INSERT INTO medicamentos (id, nome, apresentacao, forma, categoria_id, preco_base_centavos, receita, generico)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    Dados.medicamentos.forEach(m => med.run(m.id, m.nome, m.apresentacao, m.forma, m.categoria, Math.round(m.preco * 100), m.receita, m.generico ? 1 : 0));

    const est = db.prepare("INSERT INTO estoque (farmacia_id, medicamento_id, quantidade) VALUES (?, ?, ?)");
    Dados.farmacias.forEach(f => Dados.medicamentos.forEach(m => est.run(f.id, m.id, Dados.estoqueInicial(f.id, m.id))));

    for (const conta of Dados.contasTeste) {
      if (!contasTeste) break;
      repo.criarUsuario({
        nome: conta.nome, email: conta.email, senhaHash: hashes.get(conta.email),
        papel: conta.papel, farmaciaId: conta.farmaciaId ?? null, telefone: conta.telefone ?? null
      });
    }
  });

  // pedidos de exemplo (clientes sem conta, exceto o da conta de teste)
  const ctx = { farmacia: id => repo.farmacia(id), medicamento: id => repo.medicamento(id) };
  for (const exemplo of Dados.pedidosIniciais()) {
    const p = Regras.montarPedidoInicial(exemplo, ctx);
    const dono = p.clienteEmail ? repo.usuarioPorEmail(p.clienteEmail) : null;
    if (p.clienteEmail && !dono) continue;
    repo.inserirPedido(p, dono ? dono.id : null, p.id);
  }
  return true;
}

module.exports = { popular };
