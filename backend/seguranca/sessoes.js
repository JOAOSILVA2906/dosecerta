// Sessão por cookie: token aleatório de 256 bits, guardado no banco só como hash SHA-256.
// O cookie é HttpOnly (JavaScript da página não lê) e SameSite=Strict (outro site não usa).
const crypto = require("node:crypto");

const NOME_COOKIE = "dc_sessao";
const hashToken = token => crypto.createHash("sha256").update(token).digest("hex");

function lerCookies(cabecalho = "") {
  const cookies = {};
  for (const parte of cabecalho.split(";")) {
    const i = parte.indexOf("=");
    if (i > 0) cookies[parte.slice(0, i).trim()] = parte.slice(i + 1).trim();
  }
  return cookies;
}

function criarGerenciador(repo, { duracao, cookieSeguro }) {
  function cookie(valor, maxAgeSegundos) {
    return [
      `${NOME_COOKIE}=${valor}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Strict",
      `Max-Age=${maxAgeSegundos}`,
      cookieSeguro ? "Secure" : ""
    ].filter(Boolean).join("; ");
  }

  function iniciar(res, usuarioId) {
    const token = crypto.randomBytes(32).toString("base64url");
    repo.criarSessao(hashToken(token), usuarioId, Date.now() + duracao);
    res.setHeader("Set-Cookie", cookie(token, Math.floor(duracao / 1000)));
  }

  function usuarioDaRequisicao(req) {
    const token = lerCookies(req.headers.cookie)[NOME_COOKIE];
    if (!token || !/^[\w-]{40,60}$/.test(token)) return null;
    return repo.sessao(hashToken(token));
  }

  function encerrar(req, res) {
    const token = lerCookies(req.headers.cookie)[NOME_COOKIE];
    if (token) repo.apagarSessao(hashToken(token));
    res.setHeader("Set-Cookie", cookie("", 0));
  }

  return { iniciar, usuarioDaRequisicao, encerrar };
}

module.exports = { criarGerenciador };
