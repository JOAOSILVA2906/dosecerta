// Configurações do servidor. Valores podem vir do arquivo .env (veja .env.example).
const path = require("node:path");

const raiz = path.join(__dirname, "..");
try {
  process.loadEnvFile(path.join(raiz, ".env"));
} catch {
  // sem .env: usa os valores padrão abaixo
}

module.exports = {
  raiz,
  porta: Number(process.env.PORTA || 3000),
  // 127.0.0.1 = só este computador acessa. Use 0.0.0.0 para liberar na rede local.
  host: process.env.HOST || "127.0.0.1",
  arquivoBanco: process.env.BANCO || path.join(__dirname, "dados", "dosecerta.db"),
  // Ligue (1) quando o site estiver em HTTPS, para o cookie de sessão só trafegar criptografado
  cookieSeguro: process.env.COOKIE_SEGURO === "1",
  // Contas de teste (demo@dosecerta.app etc.). Desligue (0) em produção.
  contasTeste: process.env.CONTAS_TESTE !== "0",
  // Simula a farmácia avançando pedidos do app quando ninguém age no portal
  processarFila: process.env.PROCESSAR_FILA !== "0",
  duracaoSessao: 7 * 24 * 60 * 60 * 1000
};
