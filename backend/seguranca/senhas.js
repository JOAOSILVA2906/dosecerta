// Senhas guardadas com scrypt (lento de propósito, dificulta ataque de força bruta) e sal aleatório.
const crypto = require("node:crypto");

const PARAMETROS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const TAMANHO = 64;

function scrypt(senha, sal) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(senha, sal, TAMANHO, PARAMETROS, (erro, chave) => (erro ? reject(erro) : resolve(chave)));
  });
}

async function gerarHash(senha) {
  const sal = crypto.randomBytes(16);
  const chave = await scrypt(senha, sal);
  return `scrypt$${sal.toString("base64")}$${chave.toString("base64")}`;
}

// Hash de uma senha qualquer, usado quando o e-mail não existe (mesmo tempo de resposta)
let hashFalso;
async function hashParaComparacaoFalsa() {
  hashFalso ??= await gerarHash(crypto.randomBytes(16).toString("hex"));
  return hashFalso;
}

async function conferir(senha, armazenado) {
  const [algoritmo, salB64, chaveB64] = String(armazenado || "").split("$");
  if (algoritmo !== "scrypt" || !salB64 || !chaveB64) return false;
  const esperado = Buffer.from(chaveB64, "base64");
  const calculado = await scrypt(senha, Buffer.from(salB64, "base64"));
  // comparação em tempo constante para não vazar informação pelo tempo de resposta
  return esperado.length === calculado.length && crypto.timingSafeEqual(esperado, calculado);
}

module.exports = { gerarHash, conferir, hashParaComparacaoFalsa };
