// Servidor do Dose Certa: API em /api e arquivos do front-end.
// Sem dependências externas: usa só módulos nativos do Node (http, sqlite, crypto).
const http = require("node:http");
const config = require("./config.js");
const repositorio = require("./banco/repositorio.js");
const { popular } = require("./banco/popular.js");
const cabecalhos = require("./seguranca/cabecalhos.js");
const { criarGerenciador } = require("./seguranca/sessoes.js");
const { criarLimitador } = require("./seguranca/limitador.js");
const { criarContas } = require("./servicos/contas.js");
const { criarPedidos } = require("./servicos/pedidos.js");
const { criarEstoque } = require("./servicos/estoque.js");
const { criarRotas } = require("./rotas.js");
const { criarEstaticos } = require("./http/estaticos.js");
const { lerJson, enviarJson, ipDe } = require("./http/utils.js");
const { ErroHttp } = require("./http/erros.js");

async function criarApp(opcoes = {}) {
  const cfg = { ...config, ...opcoes };
  const repo = repositorio.abrir(cfg.arquivoBanco);
  await popular(repo, { contasTeste: cfg.contasTeste });

  const sessoes = criarGerenciador(repo, { duracao: cfg.duracaoSessao, cookieSeguro: cfg.cookieSeguro });
  const limites = {
    api: criarLimitador({ maximo: 600, janelaMs: 60000 }),
    loginIp: criarLimitador({ maximo: 20, janelaMs: 15 * 60000 }),
    loginEmail: criarLimitador({ maximo: 5, janelaMs: 15 * 60000 }),
    cadastro: criarLimitador({ maximo: 10, janelaMs: 15 * 60000 }),
    pedidos: criarLimitador({ maximo: 15, janelaMs: 10 * 60000 })
  };
  const contas = criarContas(repo);
  const pedidos = criarPedidos(repo);
  const estoque = criarEstoque(repo);

  // "versão" dos dados: muda a cada alteração; as telas consultam para saber se precisam recarregar
  let versao = Date.now();
  const avisarMudanca = () => { versao++; };

  const rotas = criarRotas({ repo, contas, pedidos, estoque, sessoes, limites, avisarMudanca, versaoAtual: () => versao });
  const estaticos = criarEstaticos(cfg.raiz);

  // Pedido que altera dados precisa vir do próprio site (proteção contra CSRF)
  function origemConfiavel(req) {
    const site = req.headers["sec-fetch-site"];
    if (site && !["same-origin", "none"].includes(site)) return false;
    const origem = req.headers.origin;
    if (!origem) return true;
    try {
      return new URL(origem).host === req.headers.host;
    } catch {
      return false;
    }
  }

  async function tratarApi(req, res, caminho) {
    const ip = ipDe(req);
    if (!limites.api.permitir(ip)) throw new ErroHttp(429, "Muitas requisições. Aguarde um minuto.");

    const achou = rotas.encontrar(req.method, caminho);
    if (!achou) throw new ErroHttp(404, "Endereço da API não encontrado.");
    if (achou.metodoErrado) throw new ErroHttp(405, "Método não permitido.");

    const alterando = !["GET", "HEAD"].includes(req.method);
    if (alterando && !origemConfiavel(req)) throw new ErroHttp(403, "Requisição de origem não permitida.");

    const usuario = sessoes.usuarioDaRequisicao(req);
    const { papeis, acao } = achou.rota;
    if (papeis && !usuario) throw new ErroHttp(401, "Entre na sua conta para continuar.");
    if (papeis && !papeis.includes(usuario.papel)) throw new ErroHttp(403, "Você não tem permissão para isso.");

    const corpo = alterando ? await lerJson(req) : {};
    const resposta = await acao({ req, res, ip, usuario, corpo, params: achou.params });
    enviarJson(res, 200, resposta);
  }

  const servidor = http.createServer(async (req, res) => {
    cabecalhos.aplicar(res);
    let caminho;
    try {
      caminho = new URL(req.url, "http://localhost").pathname;
    } catch {
      res.writeHead(400).end();
      return;
    }

    if (!caminho.startsWith("/api/")) return estaticos(req, res, caminho);

    try {
      await tratarApi(req, res, caminho);
    } catch (erro) {
      if (erro instanceof ErroHttp) {
        enviarJson(res, erro.status, { erro: erro.message });
      } else {
        // detalhe técnico só no terminal do servidor, nunca na resposta
        console.error(`[erro] ${req.method} ${caminho}:`, erro);
        if (!res.headersSent) enviarJson(res, 500, { erro: "Erro interno. Tente novamente." });
      }
    }
  });

  servidor.headersTimeout = 15000;
  servidor.requestTimeout = 20000;

  const timers = [
    setInterval(() => { repo.limparSessoesVencidas(); }, 60 * 60000),
    setInterval(() => Object.values(limites).forEach(l => l.faxina()), 10 * 60000)
  ];
  if (cfg.processarFila) {
    timers.push(setInterval(() => {
      try {
        if (pedidos.processarFila()) avisarMudanca();
      } catch (erro) {
        console.error("[erro] fila de pedidos:", erro);
      }
    }, 3000));
  }

  function parar() {
    timers.forEach(clearInterval);
    servidor.close();
    repo.db.close();
  }

  return { servidor, repo, pedidos, parar };
}

if (require.main === module) {
  criarApp().then(({ servidor }) => {
    servidor.listen(config.porta, config.host, () => {
      console.log(`Dose Certa rodando em http://${config.host === "0.0.0.0" ? "localhost" : config.host}:${config.porta}`);
      console.log(`Banco de dados: ${config.arquivoBanco}`);
    });
  }).catch(erro => {
    console.error("Não foi possível iniciar o servidor:", erro);
    process.exit(1);
  });
}

module.exports = { criarApp };
