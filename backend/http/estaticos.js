// Entrega os arquivos do front-end. Só serve o que está dentro de frontend/ e compartilhado/:
// caminhos com ".." ou arquivos ocultos são recusados (proteção contra path traversal).
const fs = require("node:fs");
const path = require("node:path");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2"
};

function criarEstaticos(raiz) {
  const pastas = {
    "/frontend/": path.join(raiz, "frontend"),
    "/compartilhado/": path.join(raiz, "compartilhado")
  };

  return function servir(req, res, caminhoUrl) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    if (caminhoUrl === "/" || caminhoUrl === "/index.html" || caminhoUrl === "/frontend") {
      res.writeHead(302, { Location: "/frontend/" }).end();
      return;
    }

    const prefixo = Object.keys(pastas).find(p => caminhoUrl.startsWith(p));
    let relativo;
    try {
      relativo = prefixo && decodeURIComponent(caminhoUrl.slice(prefixo.length));
    } catch {
      relativo = null;
    }
    if (relativo === "" || relativo?.endsWith("/")) relativo += "index.html";

    const base = prefixo && pastas[prefixo];
    const arquivo = base && relativo != null ? path.resolve(base, relativo) : null;
    const dentroDaPasta = arquivo && arquivo.startsWith(base + path.sep);
    const oculto = relativo && relativo.split(/[\\/]/).some(parte => parte.startsWith(".") || parte === "");
    const tipo = arquivo && TIPOS[path.extname(arquivo).toLowerCase()];

    if (!dentroDaPasta || oculto || !tipo || relativo.includes("\0")) return naoEncontrado(res);

    fs.stat(arquivo, (erro, info) => {
      if (erro || !info.isFile()) return naoEncontrado(res);
      res.writeHead(200, {
        "Content-Type": tipo,
        "Content-Length": info.size,
        "Cache-Control": tipo.startsWith("text/html") ? "no-cache" : "public, max-age=300"
      });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(arquivo).pipe(res);
    });
  };
}

function naoEncontrado(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Página não encontrada.");
}

module.exports = { criarEstaticos };
