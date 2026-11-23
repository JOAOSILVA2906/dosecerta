// Leitura do corpo JSON e envio de respostas.
const { ErroHttp } = require("./erros.js");

const LIMITE_CORPO = 16 * 1024; // 16 KB: suficiente para qualquer formulário do site

function lerJson(req) {
  return new Promise((resolve, reject) => {
    const tipo = req.headers["content-type"] || "";
    if (!tipo.toLowerCase().startsWith("application/json")) {
      reject(new ErroHttp(415, "Envie os dados em JSON."));
      return;
    }
    let tamanho = 0;
    const partes = [];
    req.on("data", parte => {
      tamanho += parte.length;
      if (tamanho > LIMITE_CORPO) {
        reject(new ErroHttp(413, "Dados grandes demais."));
        req.destroy();
        return;
      }
      partes.push(parte);
    });
    req.on("end", () => {
      if (!partes.length) return resolve({});
      try {
        const corpo = JSON.parse(Buffer.concat(partes).toString("utf8"));
        if (corpo === null || typeof corpo !== "object" || Array.isArray(corpo)) throw new Error();
        resolve(corpo);
      } catch {
        reject(new ErroHttp(400, "JSON inválido."));
      }
    });
    req.on("error", reject);
  });
}

function enviarJson(res, status, dados) {
  const texto = JSON.stringify(dados);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(texto),
    "Cache-Control": "no-store"
  });
  res.end(texto);
}

// IP de quem fez a requisição (sem confiar em X-Forwarded-For, que o cliente pode inventar)
const ipDe = req => req.socket.remoteAddress || "desconhecido";

module.exports = { lerJson, enviarJson, ipDe };
