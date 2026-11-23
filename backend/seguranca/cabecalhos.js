// Cabeçalhos de segurança enviados em todas as respostas.
// A CSP (Content-Security-Policy) diz ao navegador de onde scripts, imagens e conexões podem vir:
// se alguém conseguir injetar um <script>, o navegador recusa executar.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://unpkg.com https://vlibras.gov.br https://cdn.jsdelivr.net 'wasm-unsafe-eval' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com https://vlibras.gov.br",
  "font-src 'self' data: https://fonts.gstatic.com https://vlibras.gov.br",
  "img-src 'self' data: blob: https://server.arcgisonline.com https://tile.openstreetmap.org https://unpkg.com https://vlibras.gov.br",
  "connect-src 'self' https://viacep.com.br https://nominatim.openstreetmap.org https://vlibras.gov.br https://*.vlibras.gov.br https://cdn.jsdelivr.net",
  "media-src 'self' blob: https://vlibras.gov.br",
  "worker-src 'self' blob:",
  "frame-src https://vlibras.gov.br",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'"
].join("; ");

function aplicar(res) {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(self), camera=(), microphone=(), payment=(), usb=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
}

module.exports = { aplicar, CSP };
