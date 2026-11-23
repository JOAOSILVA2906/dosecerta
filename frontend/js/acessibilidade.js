// Painel de acessibilidade: aparece em todas as páginas e lembra as escolhas da pessoa.
// Pensado para baixa visão, daltonismo, dislexia, TDAH, surdez (Libras), tremores e pessoas idosas.
(() => {
  "use strict";

  const CHAVE = "dosecerta:a11y";
  const TAMANHOS = [1, 1.15, 1.3, 1.5];
  const opcoes = [
    { id: "contraste", nome: "Alto contraste", dica: "Texto preto e bordas fortes" },
    { id: "escuro", nome: "Modo escuro", dica: "Menos brilho na tela" },
    { id: "cinza", nome: "Tons de cinza", dica: "Para sensibilidade a cores" },
    { id: "legivel", nome: "Fonte legível", dica: "Letras mais fáceis de distinguir (dislexia)" },
    { id: "espacamento", nome: "Mais espaçamento", dica: "Entre letras, palavras e linhas" },
    { id: "links", nome: "Destacar links e botões", dica: "Sublinhado e contorno" },
    { id: "alvos", nome: "Botões maiores", dica: "Mais fácil de tocar (tremores)" },
    { id: "cursor", nome: "Cursor grande", dica: "Mouse mais visível" },
    { id: "guia", nome: "Guia de leitura", dica: "Faixa que acompanha o mouse" },
    { id: "pausar", nome: "Parar animações", dica: "Sem movimento na tela" },
    { id: "simples", nome: "Modo simplificado", dica: "Esconde enfeites e distrações" },
    { id: "voz", nome: "Leitura em voz alta", dica: "Lê o item que você tocar ou focar" }
  ];

  let estado = { tamanho: 0 };
  try { estado = { tamanho: 0, ...JSON.parse(localStorage.getItem(CHAVE) || "{}") }; } catch { /* sem armazenamento */ }
  const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch { /* ignora */ } };

  const html = document.documentElement;

  function aplicar() {
    html.style.setProperty("--a11y-zoom", TAMANHOS[estado.tamanho] || 1);
    html.classList.toggle("a11y-zoom", estado.tamanho > 0);
    opcoes.forEach(o => html.classList.toggle(`a11y-${o.id}`, Boolean(estado[o.id])));
    if (estado.legivel) carregarFonte();
    document.querySelectorAll("[data-a11y]").forEach(b => b.setAttribute("aria-pressed", String(Boolean(estado[b.dataset.a11y]))));
    const rotulo = document.getElementById("a11yTamanhoValor");
    if (rotulo) rotulo.textContent = `${Math.round((TAMANHOS[estado.tamanho] || 1) * 100)}%`;
    guia.hidden = !estado.guia;
  }

  function carregarFonte() {
    if (document.getElementById("a11yFonte")) return;
    const link = document.createElement("link");
    link.id = "a11yFonte";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap";
    document.head.append(link);
  }

  /* ---------- leitura em voz alta ---------- */

  function falar(texto) {
    if (!("speechSynthesis" in window) || !texto) return;
    speechSynthesis.cancel();
    const fala = new SpeechSynthesisUtterance(texto.replace(/\s+/g, " ").trim().slice(0, 400));
    fala.lang = "pt-BR";
    fala.rate = 0.95;
    const voz = speechSynthesis.getVoices().find(v => v.lang?.toLowerCase().startsWith("pt"));
    if (voz) fala.voice = voz;
    speechSynthesis.speak(fala);
  }

  const textoDe = el => el.getAttribute("aria-label") || el.innerText || el.value || el.placeholder || el.alt || "";

  function lerAlvo(evento) {
    if (!estado.voz || evento.target.closest("#a11yPainel")) return;
    const alvo = evento.target.closest("button, a, label, input, select, h1, h2, h3, p, li, td, th, .row, .order, .stat");
    if (alvo) falar(textoDe(alvo));
  }
  document.addEventListener("focusin", lerAlvo);
  document.addEventListener("click", lerAlvo);

  function lerPagina() {
    const tela = document.querySelector(".screen.active, .page.active, main") || document.body;
    falar([...tela.querySelectorAll("h1, h2, p")].slice(0, 8).map(textoDe).join(". "));
  }

  /* ---------- Libras (VLibras, do Governo Federal) ---------- */

  function ativarLibras() {
    if (document.querySelector("[vw]")) {
      document.querySelector("[vw-access-button]")?.click();
      return;
    }
    const caixa = document.createElement("div");
    caixa.setAttribute("vw", "");
    caixa.className = "enabled";
    caixa.innerHTML = '<div vw-access-button class="active"></div><div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
    document.body.append(caixa);
    const script = document.createElement("script");
    script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
    script.onload = () => {
      new window.VLibras.Widget("https://vlibras.gov.br/app");
      setTimeout(() => document.querySelector("[vw-access-button]")?.click(), 1500);
    };
    script.onerror = () => aviso("Não foi possível carregar o tradutor de Libras. Verifique a internet.");
    document.body.append(script);
    aviso("Carregando o tradutor de Libras...");
  }

  function aviso(texto) {
    const area = document.getElementById("a11yAviso");
    if (area) area.textContent = texto;
  }

  /* ---------- guia de leitura ---------- */

  const guia = document.createElement("div");
  guia.className = "a11y-guia";
  guia.hidden = true;
  guia.setAttribute("aria-hidden", "true");
  document.addEventListener("mousemove", e => {
    if (estado.guia) guia.style.top = `${e.clientY - 22}px`;
  });

  /* ---------- painel ---------- */

  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "a11y-botao";
  botao.id = "a11yBotao";
  botao.setAttribute("aria-label", "Opções de acessibilidade (Alt + A)");
  botao.setAttribute("aria-expanded", "false");
  botao.setAttribute("aria-controls", "a11yPainel");
  botao.title = "Acessibilidade (Alt + A)";
  botao.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4" r="2.2" fill="currentColor"/><path d="M4 8.5c2.6.8 5.3 1.2 8 1.2s5.4-.4 8-1.2M12 9.7V15m0 0-3.2 6.5M12 15l3.2 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  const painel = document.createElement("div");
  painel.className = "a11y-painel";
  painel.id = "a11yPainel";
  painel.setAttribute("role", "dialog");
  painel.setAttribute("aria-label", "Acessibilidade");
  painel.hidden = true;
  painel.innerHTML = `
    <div class="a11y-topo">
      <strong>Acessibilidade</strong>
      <button type="button" class="a11y-fechar" aria-label="Fechar painel">×</button>
    </div>
    <div class="a11y-tamanho" role="group" aria-label="Tamanho do texto">
      <span>Tamanho do texto</span>
      <div>
        <button type="button" data-tamanho="-1" aria-label="Diminuir texto">A−</button>
        <output id="a11yTamanhoValor">100%</output>
        <button type="button" data-tamanho="1" aria-label="Aumentar texto">A+</button>
      </div>
    </div>
    <div class="a11y-grade">
      ${opcoes.map(o => `<button type="button" class="a11y-opcao" data-a11y="${o.id}" aria-pressed="false"><strong>${o.nome}</strong><small>${o.dica}</small></button>`).join("")}
    </div>
    <div class="a11y-acoes">
      <button type="button" id="a11yLer">🔊 Ler esta tela</button>
      <button type="button" id="a11yLibras">🤟 Tradutor de Libras</button>
      <button type="button" id="a11yResetar">Restaurar padrão</button>
    </div>
    <p class="a11y-aviso" id="a11yAviso" role="status"></p>
    <p class="a11y-rodape">Atalho: <kbd>Alt</kbd> + <kbd>A</kbd> abre este painel. Suas escolhas ficam salvas neste aparelho.</p>`;

  const pular = document.createElement("a");
  pular.href = "#";
  pular.className = "a11y-pular";
  pular.textContent = "Pular para o conteúdo";
  pular.addEventListener("click", e => {
    e.preventDefault();
    const alvo = document.querySelector(".screen.active h1, .screen.active h2, .page.active h1, main h1, main");
    if (alvo) {
      alvo.tabIndex = -1;
      alvo.focus();
    }
  });

  function abrir(abre) {
    painel.hidden = !abre;
    botao.setAttribute("aria-expanded", String(abre));
    if (abre) painel.querySelector("button").focus();
    else botao.focus();
  }

  botao.addEventListener("click", () => abrir(painel.hidden));
  painel.addEventListener("click", e => {
    const opcao = e.target.closest("[data-a11y]");
    if (opcao) {
      const id = opcao.dataset.a11y;
      estado[id] = !estado[id];
      if (id === "contraste" && estado.contraste) estado.escuro = false;
      if (id === "escuro" && estado.escuro) estado.contraste = false;
      if (id === "voz" && !estado.voz && "speechSynthesis" in window) speechSynthesis.cancel();
      if (id === "voz" && estado.voz) falar("Leitura em voz alta ativada.");
      if (id === "voz" && estado.voz && !("speechSynthesis" in window)) aviso("Este navegador não tem leitura em voz alta.");
    }
    const tamanho = e.target.closest("[data-tamanho]");
    if (tamanho) estado.tamanho = Math.min(TAMANHOS.length - 1, Math.max(0, estado.tamanho + Number(tamanho.dataset.tamanho)));
    if (e.target.closest(".a11y-fechar")) return abrir(false);
    if (e.target.closest("#a11yLer")) lerPagina();
    if (e.target.closest("#a11yLibras")) ativarLibras();
    if (e.target.closest("#a11yResetar")) {
      estado = { tamanho: 0 };
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    }
    salvar();
    aplicar();
  });

  document.addEventListener("keydown", e => {
    if (e.altKey && (e.key === "a" || e.key === "A")) {
      e.preventDefault();
      abrir(painel.hidden);
    }
    if (e.key === "Escape" && !painel.hidden) abrir(false);
  });

  document.body.prepend(pular);
  document.body.append(botao, painel, guia);
  aplicar();
})();
