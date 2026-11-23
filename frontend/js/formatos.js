// Formatação de valores para a tela (moeda, distância, datas) e escape de HTML.
window.Formatos = (() => {
  "use strict";

  const escapar = valor => String(valor ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const moeda = valor => formatoMoeda.format(valor);

  const km = valor => valor < 1
    ? `${Math.round(valor * 1000)} m`
    : `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;

  const hora = timestamp => new Date(timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  function dataCurta(timestamp) {
    const data = new Date(timestamp);
    const hoje = new Date();
    if (data.toDateString() === hoje.toDateString()) return `Hoje, ${hora(timestamp)}`;
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    if (data.toDateString() === ontem.toDateString()) return `Ontem, ${hora(timestamp)}`;
    return `${data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}, ${hora(timestamp)}`;
  }

  function haTempo(timestamp) {
    const minutos = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutos === 0) return "Agora";
    if (minutos < 60) return `Há ${minutos} min`;
    if (minutos < 1440) return `Há ${Math.floor(minutos / 60)} h`;
    return new Date(timestamp).toLocaleDateString("pt-BR");
  }

  return { escapar, moeda, km, hora, dataCurta, haTempo };
})();
