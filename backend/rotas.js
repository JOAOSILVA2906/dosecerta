// Rotas da API. Cada rota declara quem pode acessá-la (papel); o servidor confere antes de chamar.
const { publico } = require("./servicos/contas.js");
const Validacao = require("../compartilhado/validacao.js");
const { falha } = require("./http/erros.js");

const CLIENTES = ["cliente", "visitante"];
const FARMACIA = ["farmacia"];

function criarRotas({ repo, contas, pedidos, estoque, sessoes, limites, avisarMudanca, versaoAtual }) {
  const rotas = [];
  const rota = (metodo, caminho, papeis, acao) => {
    const regex = new RegExp("^" + caminho.replace(/:(\w+)/g, "(?<$1>\\d{1,9})") + "$");
    rotas.push({ metodo, regex, papeis, acao });
  };

  /* ---------- públicas ---------- */

  rota("GET", "/api/saude", null, () => ({ ok: true }));
  rota("GET", "/api/versao", null, () => ({ versao: versaoAtual() }));
  rota("GET", "/api/catalogo", null, () => repo.catalogo());

  /* ---------- contas ---------- */

  rota("GET", "/api/conta", null, ({ usuario }) => ({ usuario: publico(usuario) }));

  rota("POST", "/api/conta/cadastro", null, async ({ corpo, res, ip }) => {
    if (!limites.cadastro.permitir(ip)) falha(429, "Muitos cadastros seguidos. Tente de novo em alguns minutos.");
    const usuario = await contas.cadastrar(corpo);
    sessoes.iniciar(res, usuario.id);
    return { usuario: publico(usuario) };
  });

  // Login separado para clientes e farmácias: conta de farmácia não entra no app do cliente e vice-versa
  const entrar = papeis => async ({ corpo, res, ip }) => {
    const email = String(corpo?.email || "").toLowerCase().slice(0, 150);
    if (limites.loginIp.bloqueado(ip) || limites.loginEmail.bloqueado(email)) {
      falha(429, "Muitas tentativas de login. Aguarde 15 minutos e tente de novo.");
    }
    try {
      const usuario = await contas.autenticar(corpo, papeis);
      limites.loginEmail.zerar(email);
      sessoes.iniciar(res, usuario.id);
      return { usuario: publico(usuario) };
    } catch (erro) {
      limites.loginIp.registrar(ip);
      limites.loginEmail.registrar(email);
      throw erro;
    }
  };
  rota("POST", "/api/conta/entrar", null, entrar(["cliente"]));
  rota("POST", "/api/farmacia/entrar", null, entrar(FARMACIA));

  rota("POST", "/api/conta/visitante", null, ({ res, ip }) => {
    if (!limites.cadastro.permitir(ip)) falha(429, "Muitos acessos seguidos. Tente de novo em alguns minutos.");
    const usuario = contas.criarVisitante();
    sessoes.iniciar(res, usuario.id);
    return { usuario: publico(usuario) };
  });

  rota("POST", "/api/conta/sair", null, ({ req, res }) => {
    sessoes.encerrar(req, res);
    return { ok: true };
  });

  /* ---------- cliente ---------- */

  rota("GET", "/api/conta/endereco", CLIENTES, ({ usuario }) => ({ endereco: repo.endereco(usuario.id) }));

  rota("POST", "/api/conta/notificacoes-lidas", CLIENTES, ({ usuario }) => {
    repo.marcarLidas(usuario.id, Date.now());
    return { ok: true };
  });

  rota("GET", "/api/pedidos", CLIENTES, ({ usuario }) => ({
    pedidos: repo.pedidosDoUsuario(usuario.id),
    notificacoesLidas: repo.usuario(usuario.id).notificacoesLidas
  }));

  rota("POST", "/api/pedidos", CLIENTES, ({ usuario, corpo, ip }) => {
    if (!limites.pedidos.permitir(`${ip}:${usuario.id}`)) falha(429, "Muitos pedidos em pouco tempo. Aguarde um pouco.");
    const pedido = pedidos.criar(usuario, corpo);
    avisarMudanca();
    return { pedido, usuario: publico(repo.usuario(usuario.id)) };
  });

  rota("POST", "/api/pedidos/:id/cancelar", CLIENTES, ({ usuario, params }) => {
    const pedido = pedidos.cancelarPeloCliente(usuario, Number(params.id));
    avisarMudanca();
    return { pedido };
  });

  /* ---------- portal da farmácia ---------- */

  rota("GET", "/api/farmacia/pedidos", FARMACIA, ({ usuario }) => ({ pedidos: repo.pedidosDaFarmacia(usuario.farmaciaId) }));

  rota("POST", "/api/farmacia/pedidos/:id/avancar", FARMACIA, ({ usuario, params }) => {
    const pedido = pedidos.avancarPelaFarmacia(usuario.farmaciaId, Number(params.id));
    avisarMudanca();
    return { pedido };
  });

  rota("POST", "/api/farmacia/pedidos/:id/recusar", FARMACIA, ({ usuario, params }) => {
    const pedido = pedidos.recusarPelaFarmacia(usuario.farmaciaId, Number(params.id));
    avisarMudanca();
    return { pedido };
  });

  rota("PUT", "/api/farmacia/estoque/:id", FARMACIA, ({ usuario, params, corpo }) => {
    const resultado = estoque.definir(usuario.farmaciaId, Number(params.id), corpo.quantidade);
    avisarMudanca();
    return resultado;
  });

  rota("POST", "/api/farmacia/medicamentos", FARMACIA, ({ usuario, corpo }) => {
    const medicamento = estoque.adicionar(repo.farmacia(usuario.farmaciaId), corpo);
    avisarMudanca();
    return { medicamento };
  });

  rota("PUT", "/api/farmacia/responsavel", FARMACIA, ({ usuario, corpo }) => {
    const v = Validacao.responsavel(corpo.nome);
    if (!v.ok) falha(400, v.erro);
    repo.atualizarNome(usuario.id, v.dados);
    return { usuario: publico(repo.usuario(usuario.id)) };
  });

  function encontrar(metodo, caminho) {
    let existeCaminho = false;
    for (const r of rotas) {
      const achou = r.regex.exec(caminho);
      if (!achou) continue;
      existeCaminho = true;
      if (r.metodo === metodo) return { rota: r, params: achou.groups || {} };
    }
    return existeCaminho ? { metodoErrado: true } : null;
  }

  return { encontrar };
}

module.exports = { criarRotas };
