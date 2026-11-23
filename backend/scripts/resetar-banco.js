// Apaga o banco de dados e recria com os dados iniciais. Uso: npm run resetar
const fs = require("node:fs");
const config = require("../config.js");
const repositorio = require("../banco/repositorio.js");
const { popular } = require("../banco/popular.js");

(async () => {
  for (const sufixo of ["", "-wal", "-shm"]) fs.rmSync(config.arquivoBanco + sufixo, { force: true });
  const repo = repositorio.abrir(config.arquivoBanco);
  await popular(repo, { contasTeste: config.contasTeste });
  repo.db.close();
  console.log(`Banco recriado em ${config.arquivoBanco}`);
})();
