// Cadastro, login e visitantes.
const Validacao = require("../../compartilhado/validacao.js");
const senhas = require("../seguranca/senhas.js");
const { falha } = require("../http/erros.js");

// Só o que pode ir para o navegador (sem hash de senha etc.)
const publico = u => u && ({
  id: u.id, nome: u.nome, email: u.email || "", papel: u.papel,
  farmaciaId: u.farmaciaId ?? null, telefone: u.telefone || ""
});

function criarContas(repo) {
  async function cadastrar(corpo) {
    const v = Validacao.cadastro(corpo);
    if (!v.ok) falha(400, v.erro);
    if (repo.usuarioPorEmail(v.dados.email)) falha(409, "Já existe uma conta com este e-mail. Use a aba Entrar.");
    const senhaHash = await senhas.gerarHash(v.dados.senha);
    const id = repo.criarUsuario({ nome: v.dados.nome, email: v.dados.email, senhaHash, papel: "cliente" });
    return repo.usuario(id);
  }

  // Mesma mensagem para e-mail inexistente e senha errada, para não revelar quem tem conta
  async function autenticar(corpo, papeisPermitidos) {
    const v = Validacao.login(corpo);
    if (!v.ok) falha(401, "E-mail ou senha incorretos.");
    const linha = repo.usuarioPorEmail(v.dados.email);
    const confere = await senhas.conferir(v.dados.senha, linha?.senha_hash || await senhas.hashParaComparacaoFalsa());
    if (!linha || !confere || !papeisPermitidos.includes(linha.papel)) falha(401, "E-mail ou senha incorretos.");
    return repo.usuario(linha.id);
  }

  function criarVisitante() {
    return repo.usuario(repo.criarUsuario({ nome: "Visitante", papel: "visitante" }));
  }

  return { cadastrar, autenticar, criarVisitante };
}

module.exports = { criarContas, publico };
