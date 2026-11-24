// Área do cliente: busca, farmácias no mapa, compra e acompanhamento do pedido.
(() => {
  "use strict";

  const D = window.DoseCerta;
  const $ = id => document.getElementById(id);
  const esc = D.escapar;
  const telas = [...document.querySelectorAll(".screen")];
  const botoesNav = [...document.querySelectorAll("[data-nav]")];
  const semAnimacao = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TELAS_LIVRES = ["home", "mapScreen", "popular", "orders", "notifications", "profile", "more"];
  const FORMAS = ["comprimido", "capsula", "liquido", "spray", "sache"];

  const icone = nome => `<svg class="icon" aria-hidden="true"><use href="#i-${nome}"/></svg>`;

  let usuario = null;
  let telaAtual = "auth";
  let pilha = [];
  let modoAcesso = "login";
  let categoriaAtiva = "";
  let medSelecionado = null;
  let farmSelecionada = null;
  let medPopular = null; // medicamento escolhido na tela Farmácia Popular
  let quantidade = 1;
  let recebimento = null;
  let destino = null;
  let pedidoAberto = null;
  let local = D.localizacao();
  let consultaCep = 0;
  let timerAviso;
  let segundos = 0;
  const statusConhecidos = new Map();
  const mapas = { popular: null, pinosPopular: null, chavePopular: "", farmacias: null, pinos: null, chave: "", pedido: null, camada: null, pedidoId: null, moto: null };

  /* ---------- utilidades ---------- */

  function aviso(texto) {
    $("toast").textContent = texto;
    $("toast").hidden = false;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => { $("toast").hidden = true; }, 4500);
  }

  async function buscarJson(url, limite = 6000) {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), limite);
    try {
      const resposta = await fetch(url, { signal: controle.signal });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      return await resposta.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // No DF existem várias "Quadra 205", então entre os resultados fica o mais perto da farmácia
  async function geocodificar(texto, referencia) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(texto)}`;
      const pontos = (await buscarJson(url)).map(r => ({ lat: Number(r.lat), lng: Number(r.lon) }));
      if (!pontos.length) return null;
      return pontos.sort((a, b) => D.distanciaKm(a, referencia) - D.distanciaKm(b, referencia))[0];
    } catch {
      return null;
    }
  }

  async function nomeDoLugar({ lat, lng }) {
    try {
      const r = await buscarJson(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=14&accept-language=pt-BR&lat=${lat}&lon=${lng}`);
      const a = r.address || {};
      const lugar = a.suburb || a.neighbourhood || a.city_district || a.town || a.city;
      const uf = (a["ISO3166-2-lvl4"] || "").replace("BR-", "");
      return lugar ? `${lugar}${uf ? `, ${uf}` : ""}` : null;
    } catch {
      return null;
    }
  }

  const meusPedidos = () => usuario ? D.pedidos().filter(p => p.clienteId === usuario.id) : [];

  function arteRemedio(m, id = "") {
    const forma = FORMAS.includes(m.forma) ? m.forma : "comprimido";
    return `<span class="pill-box"${id ? ` id="${id}"` : ""} style="--cor:${D.categoria(m.categoria).cor}"><span class="pill ${forma}"></span></span>`;
  }

  function etiquetas(m) {
    const lista = [];
    if (m.generico) lista.push('<span class="tag">Genérico</span>');
    if (m.receita === "simples") lista.push('<span class="tag rx">Precisa de receita</span>');
    if (m.receita === "retencao") lista.push('<span class="tag rx">Retém receita</span>');
    if (D.indicacaoPopular(m)) lista.push('<span class="tag popular">Farmácia Popular</span>');
    return lista.join("");
  }

  const resumoItens = p => p.itens.map(item => `${item.qtd > 1 ? `${item.qtd}× ` : ""}${item.nome}`).join(", ");

  /* ---------- navegação ---------- */

  function mostrarTela(id, { empilhar = true } = {}) {
    if (!usuario && id !== "auth") return;
    if (id === "tracking" && !D.pedido(pedidoAberto)) id = "orders";
    if (["detail", "receive"].includes(id) && !farmSelecionada) id = "mapScreen";
    if (id === "receive" && !medSelecionado) id = "home";
    const tela = $(id);
    if (!tela || !tela.classList.contains("screen")) return;

    if (empilhar && telaAtual !== id && telaAtual !== "auth") pilha.push(telaAtual);
    telaAtual = id;

    const entrada = id === "auth";
    document.querySelector(".app").classList.toggle("auth-mode", entrada);
    $("mainNav").hidden = entrada;
    $("headerActions").hidden = entrada;
    $("appFooter").hidden = entrada;
    telas.forEach(secao => secao.classList.toggle("active", secao.id === id));
    $("back").hidden = pilha.length === 0;

    const navAtivo = ["detail", "receive"].includes(id) ? "mapScreen" : id === "tracking" ? "orders" : id;
    botoesNav.forEach(botao => {
      const ativo = botao.dataset.nav === navAtivo;
      botao.classList.toggle("active", ativo);
      if (ativo) botao.setAttribute("aria-current", "page");
      else botao.removeAttribute("aria-current");
    });

    renderizar(id);

    const titulo = tela.querySelector("h1, h2");
    if (titulo) {
      titulo.tabIndex = -1;
      titulo.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0, behavior: "auto" });

    const endereco = entrada ? location.pathname + location.search : `#${id}`;
    if (empilhar) history.pushState({ tela: id }, "", endereco);
    else history.replaceState({ tela: id }, "", endereco);
  }

  function irPara(id) {
    pilha = [];
    mostrarTela(id, { empilhar: false });
  }

  function renderizar(id) {
    if (id === "home") renderCatalogo();
    if (id === "mapScreen") renderFarmacias();
    if (id === "popular") renderPopular();
    if (id === "detail") renderDetalhe();
    if (id === "receive") renderRecebimento();
    if (id === "tracking") renderAcompanhamento();
    if (id === "orders") renderPedidos();
    if (id === "notifications") renderNotificacoes();
    if (id === "profile") renderPerfil();
  }

  window.addEventListener("popstate", evento => {
    if (!usuario) return;
    const alvo = evento.state?.tela;
    pilha.pop();
    mostrarTela(alvo && alvo !== "auth" ? alvo : "home", { empilhar: false });
  });

  /* ---------- catálogo ---------- */

  function renderCategorias() {
    const opcoes = [{ id: "", nome: "Todos" }, ...D.categorias];
    $("categoryChips").innerHTML = opcoes.map(c =>
      `<button type="button" class="chip${c.id === categoriaAtiva ? " selected" : ""}" data-category="${c.id}" aria-pressed="${c.id === categoriaAtiva}">${esc(c.nome)}</button>`
    ).join("");
  }

  function renderCatalogo() {
    const texto = $("searchInput").value.trim();
    $("clearSearch").hidden = !texto;
    const termos = D.normalizar(texto).split(/\s+/).filter(Boolean);
    const lista = D.catalogo().filter(m => {
      if (categoriaAtiva && m.categoria !== categoriaAtiva) return false;
      const alvo = D.normalizar(`${m.nome} ${m.apresentacao} ${D.categoria(m.categoria).nome}`);
      return termos.every(termo => alvo.includes(termo));
    });

    $("resultsTitle").textContent = categoriaAtiva ? D.categoria(categoriaAtiva).nome : "Medicamentos";
    $("resultCount").textContent = `${lista.length} ${lista.length === 1 ? "item" : "itens"}`;

    if (!lista.length) {
      $("results").innerHTML = `<div class="empty-state">${icone("search")}<h2>Nada encontrado</h2><p>Confira a grafia ou tente pelo princípio ativo, por exemplo "paracetamol".</p></div>`;
      return;
    }

    $("results").innerHTML = lista.map(m => {
      const menor = D.menorPreco(m);
      return `<button class="row med-row" data-med="${m.id}">
        ${arteRemedio(m)}
        <span class="text"><strong>${esc(m.nome)}</strong><span class="muted small">${esc(m.apresentacao)}</span><span class="tags">${etiquetas(m)}</span></span>
        <span class="price-from">${menor === null ? "<small>Em falta</small>" : `<small>a partir de</small>${D.moeda(menor)}`}</span>
        <span class="chevron" aria-hidden="true">›</span>
      </button>`;
    }).join("");
  }

  /* ---------- farmácias e mapa ---------- */

  function listaFarmacias() {
    const criterio = $("sortPharmacies").value;
    return D.farmacias.map(f => ({
      f,
      distancia: D.distanciaKm(local, f),
      estoque: medSelecionado ? D.estoqueDe(f.id, medSelecionado.id) : null,
      preco: medSelecionado ? D.preco(medSelecionado, f) : null,
      aberta: D.aberta(f)
    })).sort((a, b) => {
      if (medSelecionado && (a.estoque > 0) !== (b.estoque > 0)) return a.estoque > 0 ? -1 : 1;
      if (criterio === "preco" && medSelecionado) return a.preco - b.preco || a.distancia - b.distancia;
      if (criterio === "nota") return b.f.nota - a.f.nota;
      return a.distancia - b.distancia;
    });
  }

  function renderFarmacias() {
    const porPreco = $("sortPharmacies").querySelector('[value="preco"]');
    porPreco.disabled = !medSelecionado;
    if (!medSelecionado && $("sortPharmacies").value === "preco") $("sortPharmacies").value = "distancia";

    $("mapMedicine").textContent = medSelecionado ? medSelecionado.nome : "Todas as farmácias";
    $("changeMedicine").textContent = medSelecionado ? "Trocar" : "Escolher remédio";

    const lista = listaFarmacias();
    $("mapHint").textContent = medSelecionado
      ? `${lista.filter(item => item.estoque > 0).length} de ${lista.length} farmácias têm este medicamento agora.`
      : "Toque em uma farmácia para ver endereço, horário e telefone.";

    $("pharmacyList").innerHTML = lista.map(({ f, distancia, estoque, preco, aberta }) => {
      let lado;
      if (!medSelecionado) {
        lado = `<span class="badge${aberta ? "" : " off"}">${aberta ? "Aberta" : "Fechada"}</span>`;
      } else if (estoque === 0) {
        lado = '<span class="badge off">Em falta</span>';
      } else {
        lado = `<span class="row-price">${D.moeda(preco)}<small class="${estoque <= 5 ? "low" : "ok"}">${estoque <= 5 ? "Últimas unidades" : "Disponível"}</small></span>`;
      }
      return `<button class="row pharmacy-row${farmSelecionada?.id === f.id ? " current" : ""}" data-pharmacy="${f.id}">
        ${icone("pin")}
        <span class="text"><strong class="pharmacy-row-name">${esc(f.nome)}</strong><span class="muted small">${D.km(distancia)} · ${esc(f.bairro)}</span><span class="small ${aberta ? "open" : "closed"}">${D.textoHorario(f)}</span>${D.credenciadaPopular(f) ? '<span class="tags"><span class="tag popular">Farmácia Popular</span></span>' : ""}</span>
        ${lado}<span class="chevron" aria-hidden="true">›</span>
      </button>`;
    }).join("");

    desenharMapa(lista);
  }

  /* ---------- Farmácia Popular ---------- */

  function renderPopular() {
    const meds = D.catalogo().filter(m => D.indicacaoPopular(m));
    const credenciadas = D.farmacias.filter(D.credenciadaPopular);
    const med = meds.find(m => m.id === medPopular) || null;

    $("popularMeds").innerHTML = meds.map(m => {
      const onde = credenciadas.filter(f => D.estoqueDe(f.id, m.id) > 0).length;
      const ativo = med?.id === m.id;
      return `<button type="button" class="popular-med${ativo ? " selected" : ""}" data-popular-med="${m.id}" aria-pressed="${ativo}">
        ${arteRemedio(m)}
        <span class="text"><strong>${esc(m.nome)}</strong><span class="tag popular">${esc(D.indicacaoPopular(m))}</span><span class="small ${onde ? "muted" : "closed"}">${onde ? `Tem em ${onde} de ${credenciadas.length} farmácias` : "Em falta nas credenciadas"}</span></span>
      </button>`;
    }).join("");

    const lista = credenciadas.map(f => ({
      f,
      distancia: D.distanciaKm(local, f),
      aberta: D.aberta(f),
      estoque: med ? D.estoqueDe(f.id, med.id) : null,
      itens: meds.filter(m => D.estoqueDe(f.id, m.id) > 0).length
    })).sort((a, b) => {
      if (med && (a.estoque > 0) !== (b.estoque > 0)) return a.estoque > 0 ? -1 : 1;
      return a.distancia - b.distancia;
    });

    $("popularHint").textContent = med
      ? `${lista.filter(item => item.estoque > 0).length} de ${lista.length} farmácias credenciadas têm ${med.nome} agora.`
      : `${lista.length} farmácias credenciadas. Toque em um medicamento acima para ver onde tem.`;

    $("popularList").innerHTML = lista.map(({ f, distancia, aberta, estoque, itens }) => {
      let lado;
      if (!med) lado = `<span class="stock-note ok">${itens} de ${meds.length} itens</span>`;
      else if (estoque === 0) lado = '<span class="badge off">Em falta</span>';
      else lado = `<span class="stock-note ${estoque <= 5 ? "low" : "ok"}">${estoque <= 5 ? "Últimas unidades" : "Disponível"}</span>`;
      return `<button class="row pharmacy-row" data-pharmacy="${f.id}">
        ${icone("pin")}
        <span class="text"><strong class="pharmacy-row-name">${esc(f.nome)}</strong><span class="muted small">${D.km(distancia)} · ${esc(f.bairro)}</span><span class="small ${aberta ? "open" : "closed"}">${D.textoHorario(f)}</span></span>
        ${lado}<span class="chevron" aria-hidden="true">›</span>
      </button>`;
    }).join("");

    desenharMapaPopular(lista, med);
  }

  function desenharMapaPopular(lista, med) {
    if (!mapas.popular) {
      mapas.popular = Mapa.criar($("popularMap"), local, 12);
      if (!mapas.popular) return;
      mapas.pinosPopular = L.layerGroup().addTo(mapas.popular);
    }
    Mapa.ajustar(mapas.popular);
    mapas.pinosPopular.clearLayers();

    const perto = Math.min(...lista.map(item => item.distancia)) < 40;
    if (perto) {
      L.marker([local.lat, local.lng], { icon: Mapa.pontoUsuario(), keyboard: false, zIndexOffset: -100 })
        .bindTooltip(local.padrao ? "Região de referência" : "Você está aqui")
        .addTo(mapas.pinosPopular);
    }

    lista.forEach(({ f, estoque }) => {
      const emFalta = med && estoque === 0;
      const dica = `<strong>${esc(f.nome)}</strong><br>${med ? (emFalta ? "Em falta" : "Disponível") : esc(f.bairro)}`;
      L.marker([f.lat, f.lng], { icon: Mapa.pino("farmacia", med && !emFalta), title: f.nome, opacity: emFalta ? 0.45 : 1 })
        .bindTooltip(dica, { direction: "top" })
        .on("click", () => abrirFarmaciaPopular(f.id))
        .addTo(mapas.pinosPopular);
    });

    const chave = `${local.lat}|${local.lng}`;
    if (chave !== mapas.chavePopular) {
      mapas.chavePopular = chave;
      const limites = L.latLngBounds(lista.map(item => [item.f.lat, item.f.lng]));
      if (perto) limites.extend([local.lat, local.lng]);
      mapas.popular.fitBounds(limites, { padding: [36, 36], maxZoom: 14 });
    }
  }

  // Da tela Farmácia Popular, abre a farmácia já com o remédio escolhido (se houver)
  function abrirFarmaciaPopular(id) {
    if (medPopular) medSelecionado = D.medicamento(medPopular);
    abrirFarmacia(id);
  }

  function desenharMapa(lista) {
    if (!mapas.farmacias) {
      mapas.farmacias = Mapa.criar($("map"), local, 12);
      if (!mapas.farmacias) return;
      mapas.pinos = L.layerGroup().addTo(mapas.farmacias);
    }
    Mapa.ajustar(mapas.farmacias);
    mapas.pinos.clearLayers();

    const perto = Math.min(...lista.map(item => item.distancia)) < 40;
    if (perto) {
      L.marker([local.lat, local.lng], { icon: Mapa.pontoUsuario(), keyboard: false, zIndexOffset: -100 })
        .bindTooltip(local.padrao ? "Região de referência" : "Você está aqui")
        .addTo(mapas.pinos);
    }

    lista.forEach(({ f, estoque, preco }) => {
      const emFalta = medSelecionado && estoque === 0;
      const dica = `<strong>${esc(f.nome)}</strong>${medSelecionado ? `<br>${emFalta ? "Em falta" : D.moeda(preco)}` : `<br>${esc(f.bairro)}`}`;
      L.marker([f.lat, f.lng], { icon: Mapa.pino("farmacia", farmSelecionada?.id === f.id), title: f.nome, opacity: emFalta ? 0.5 : 1 })
        .bindTooltip(dica, { direction: "top" })
        .on("click", () => abrirFarmacia(f.id))
        .addTo(mapas.pinos);
    });

    const chave = `${medSelecionado?.id}|${local.lat}|${local.lng}`;
    if (chave !== mapas.chave) {
      mapas.chave = chave;
      const limites = L.latLngBounds(lista.map(item => [item.f.lat, item.f.lng]));
      if (perto) limites.extend([local.lat, local.lng]);
      mapas.farmacias.fitBounds(limites, { padding: [36, 36], maxZoom: 14 });
    }
  }

  function atualizarLocal() {
    $("locationName").textContent = local.nome;
  }

  function usarMinhaLocalizacao() {
    if (!navigator.geolocation) {
      aviso("Seu navegador não oferece localização.");
      return;
    }
    $("locateButton").disabled = true;
    $("locationChip").disabled = true;
    aviso("Buscando sua localização...");
    const liberar = () => {
      $("locateButton").disabled = false;
      $("locationChip").disabled = false;
    };
    navigator.geolocation.getCurrentPosition(async posicao => {
      const novo = { lat: posicao.coords.latitude, lng: posicao.coords.longitude, nome: "Sua localização", padrao: false };
      const maisPerto = Math.min(...D.farmacias.map(f => D.distanciaKm(novo, f)));
      if (maisPerto > 40) {
        liberar();
        aviso("Você está fora da área atendida. Por enquanto atendemos o Distrito Federal.");
        return;
      }
      local = novo;
      D.salvarLocalizacao(local);
      atualizarLocal();
      renderizar(telaAtual);
      aviso("Localização atualizada. Distâncias recalculadas.");
      const nome = await nomeDoLugar(local);
      if (nome) {
        local.nome = nome;
        D.salvarLocalizacao(local);
        atualizarLocal();
      }
      liberar();
    }, erro => {
      liberar();
      aviso(erro.code === 1
        ? "Permissão de localização negada. Mostrando a região de Águas Claras."
        : "Não foi possível obter sua localização agora.");
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }

  /* ---------- detalhe da farmácia ---------- */

  function abrirFarmacia(id) {
    farmSelecionada = D.farmacia(id);
    quantidade = 1;
    mostrarTela("detail");
  }

  function renderDetalhe() {
    const f = farmSelecionada;
    if (!f) return;
    const aberta = D.aberta(f);
    $("facadeName").textContent = f.nome.toUpperCase();
    $("pharmacyName").textContent = f.nome;
    $("pharmacyAddress").textContent = `${f.endereco} · ${f.bairro}, Brasília - DF`;
    $("pharmacyRating").innerHTML = `${icone("star")} ${f.nota.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} <span class="muted">(${f.avaliacoes} avaliações)</span>`;
    $("pharmacyOpen").textContent = D.textoHorario(f);
    $("pharmacyOpen").className = `open-status ${aberta ? "open" : "closed"}`;
    $("pharmacyPopular").hidden = !D.credenciadaPopular(f);
    $("pharmacyHours").textContent = f.horario ? `Todos os dias, das ${f.horario.abre} às ${f.horario.fecha}` : "24 horas, todos os dias";
    $("pharmacyPhone").textContent = f.telefone;
    $("pharmacyPhone").href = `tel:+55${f.telefone.replace(/\D/g, "")}`;
    $("distance").textContent = `${D.km(D.distanciaKm(local, f))} em linha reta`;
    $("routeLink").href = Mapa.rota(f);

    const med = medSelecionado;
    $("productBox").hidden = !med;
    $("pickMedicine").hidden = !!med;
    $("continue").hidden = !med;

    let bloqueio = "";
    if (med) {
      const estoque = D.estoqueDe(f.id, med.id);
      const maximo = Math.max(1, Math.min(estoque, 10));
      quantidade = Math.min(Math.max(1, quantidade), maximo);
      $("detailArt").outerHTML = arteRemedio(med, "detailArt");
      $("detailMedicine").textContent = med.nome;
      $("detailPack").textContent = med.apresentacao;
      $("detailTags").innerHTML = etiquetas(med);
      $("detailPrice").textContent = D.moeda(D.preco(med, f));
      $("detailStock").textContent = estoque === 0 ? "Em falta nesta loja" : estoque <= 5 ? `Últimas ${estoque} unidades` : "✓ Disponível";
      $("detailStock").className = `badge light${estoque === 0 ? " off" : estoque <= 5 ? " warn" : ""}`;
      $("qtyValue").textContent = quantidade;
      $("qtyMinus").disabled = quantidade <= 1;
      $("qtyPlus").disabled = quantidade >= maximo || estoque === 0;
      if (estoque === 0) bloqueio = "Este medicamento está em falta nesta farmácia. Volte e escolha outra unidade.";
    }
    if (!aberta) bloqueio = `A farmácia está fechada agora. Abre às ${f.horario.abre}.`;
    $("detailMessage").textContent = bloqueio;
    $("continue").disabled = !!bloqueio;
  }

  /* ---------- recebimento e pagamento ---------- */

  function valoresCompra() {
    const f = farmSelecionada;
    const precoUnit = D.preco(medSelecionado, f);
    const subtotal = Math.round(precoUnit * quantidade * 100) / 100;
    const distancia = D.distanciaKm(destino || local, f);
    const taxa = recebimento === "entrega" ? D.taxaEntrega(distancia, subtotal) : 0;
    return { precoUnit, subtotal, distancia, taxa, total: Math.round((subtotal + taxa) * 100) / 100 };
  }

  function renderRecebimento() {
    const f = farmSelecionada;
    const med = medSelecionado;
    if (!f || !med) return;

    const distancia = D.distanciaKm(local, f);
    const subtotal = D.preco(med, f) * quantidade;
    const taxa = D.taxaEntrega(distancia, subtotal);
    const fora = distancia > D.RAIO_ENTREGA;

    $("pickupInfo").textContent = `Sem taxa. Fica pronto em cerca de 30 minutos na loja de ${f.bairro}.`;
    $("deliveryInfo").textContent = fora
      ? `Você está a ${D.km(distancia)} desta farmácia. Entregamos em até ${D.RAIO_ENTREGA} km.`
      : `${taxa === 0 ? "Frete grátis" : `Taxa de ${D.moeda(taxa)}`} · chega em cerca de ${D.prazoEntrega(distancia)} minutos.`;
    $("delivery").disabled = fora;
    if (fora && recebimento === "entrega") recebimento = null;

    ["pickup", "delivery"].forEach(id => $(id).setAttribute("aria-pressed", String($(id).dataset.receive === recebimento)));
    $("checkoutForm").hidden = !recebimento;
    if (!recebimento) return;

    $("addressFields").hidden = recebimento !== "entrega";
    $("prescriptionField").hidden = med.receita === "isento";
    $("prescriptionText").textContent = med.receita === "retencao"
      ? "Antibiótico: envie a foto da receita agora. A via original fica retida na farmácia na entrega ou retirada."
      : "Este medicamento precisa de receita. Envie uma foto ou PDF para a farmácia conferir.";
    $("cardHint").textContent = recebimento === "entrega" ? "Crédito ou débito na entrega" : "Crédito ou débito no balcão";
    renderResumoCompra();
  }

  function renderResumoCompra() {
    const v = valoresCompra();
    const f = farmSelecionada;
    const linhaFrete = recebimento === "entrega"
      ? `<div><dt>Entrega${destino ? ` (${D.km(v.distancia)})` : ""}</dt><dd>${v.taxa === 0 ? "Grátis" : D.moeda(v.taxa)}</dd></div>`
      : "<div><dt>Retirada na loja</dt><dd>Grátis</dd></div>";
    $("checkoutSummary").innerHTML = `
      <div class="summary-item">${arteRemedio(medSelecionado)}<div><strong>${esc(medSelecionado.nome)}</strong><span class="small muted">${quantidade} × ${D.moeda(v.precoUnit)}</span></div></div>
      <p class="small muted">${esc(f.nome)} · ${esc(f.bairro)}</p>
      <dl class="totals">
        <div><dt>Subtotal</dt><dd>${D.moeda(v.subtotal)}</dd></div>
        ${linhaFrete}
        <div class="total"><dt>Total</dt><dd>${D.moeda(v.total)}</dd></div>
      </dl>
      ${recebimento === "entrega" && v.taxa > 0 ? `<p class="small muted">Frete grátis em compras a partir de ${D.moeda(D.FRETE_GRATIS)}.</p>` : ""}`;
  }

  function escolherRecebimento(tipo) {
    recebimento = tipo;
    if (!$("contactName").value) $("contactName").value = usuario.nome === "Visitante" ? "" : usuario.nome;
    if (!$("contactPhone").value && usuario.telefone) $("contactPhone").value = usuario.telefone;
    if (tipo === "entrega" && !$("street").value) {
      const salvo = D.enderecoSalvo(usuario.id);
      if (salvo) {
        $("cep").value = salvo.cep || "";
        $("street").value = salvo.rua;
        $("number").value = salvo.numero;
        $("district").value = salvo.bairro;
        $("complement").value = salvo.complemento || "";
        $("cepStatus").textContent = "Endereço salvo do seu último pedido.";
        if (salvo.lat) destino = { lat: salvo.lat, lng: salvo.lng };
      }
    }
    renderRecebimento();
    $("checkoutForm").scrollIntoView({ behavior: semAnimacao ? "auto" : "smooth", block: "start" });
  }

  async function buscarCep(cep) {
    const consulta = ++consultaCep;
    destino = null;
    $("cepStatus").textContent = "Buscando endereço...";
    try {
      const dados = await buscarJson(`https://viacep.com.br/ws/${cep}/json/`);
      if (consulta !== consultaCep) return;
      if (dados.erro) {
        $("cepStatus").textContent = "CEP não encontrado. Preencha o endereço manualmente.";
        return;
      }
      if (dados.logradouro) $("street").value = dados.logradouro;
      if (dados.bairro) $("district").value = dados.bairro;
      $("cepStatus").textContent = `${dados.bairro ? `${dados.bairro} · ` : ""}${dados.localidade} - ${dados.uf}`;
      $("number").focus();

      // O ViaCEP devolve bairros como "Sul (Águas Claras)"; o nome entre parênteses localiza melhor
      const bairro = (dados.bairro || "").replace(/^.*\((.+)\)\s*$/, "$1");
      const cidade = `${dados.localidade} - ${dados.uf}`;
      const ref = farmSelecionada;
      const ponto = (dados.logradouro && bairro && await geocodificar(`${dados.logradouro}, ${bairro}, ${cidade}`, ref))
        || (dados.logradouro && await geocodificar(`${dados.logradouro}, ${cidade}`, ref))
        || (bairro && await geocodificar(`${bairro}, ${cidade}`, ref))
        || await geocodificar(cidade, ref);
      if (consulta !== consultaCep || !ponto) return;
      destino = ponto;
      const distancia = D.distanciaKm(destino, farmSelecionada);
      if (distancia > D.RAIO_ENTREGA) {
        $("cepStatus").textContent = `Este endereço fica a ${D.km(distancia)} da farmácia. Entregamos em até ${D.RAIO_ENTREGA} km.`;
      }
      renderResumoCompra();
    } catch {
      if (consulta === consultaCep) $("cepStatus").textContent = "Não foi possível consultar o CEP agora. Preencha o endereço manualmente.";
    }
  }

  function limparCompra() {
    $("checkoutForm").reset();
    recebimento = null;
    destino = null;
    consultaCep++;
    $("prescriptionName").textContent = "Enviar foto ou PDF da receita";
    $("cepStatus").textContent = "Digite o CEP para preencher o endereço.";
    $("changeGroup").hidden = true;
    $("checkoutMessage").textContent = "";
  }

  function finalizarCompra(evento) {
    evento.preventDefault();
    const erro = (texto, campo) => {
      $("checkoutMessage").textContent = texto;
      if (campo) campo.focus();
    };
    $("checkoutMessage").textContent = "";
    if (!recebimento) return;

    const f = farmSelecionada;
    const med = medSelecionado;
    const v = valoresCompra();
    const nome = $("contactName").value.trim().replace(/\s+/g, " ");
    const telefone = $("contactPhone").value.trim();

    if (nome.length < 3) return erro("Informe seu nome para identificarmos o pedido.", $("contactName"));
    if (telefone.replace(/\D/g, "").length < 10) return erro("Informe um celular com DDD.", $("contactPhone"));
    if (!D.aberta(f)) return erro("A farmácia acabou de fechar. Escolha outra unidade.");
    if (D.estoqueDe(f.id, med.id) < quantidade) return erro("O estoque desta farmácia mudou. Volte e ajuste a quantidade.");

    let endereco = null;
    if (recebimento === "entrega") {
      const campos = ["street", "number", "district"].map(id => $(id));
      const vazio = campos.find(campo => !campo.value.trim());
      if (vazio) return erro("Preencha rua, número e bairro para a entrega.", vazio);
      if (v.distancia > D.RAIO_ENTREGA) return erro(`Este endereço fica a ${D.km(v.distancia)} da farmácia. Entregamos em até ${D.RAIO_ENTREGA} km.`);
      const [rua, numero, bairro] = campos.map(campo => campo.value.trim());
      const complemento = $("complement").value.trim();
      const ponto = destino || local;
      endereco = { texto: `${rua}, ${numero}${complemento ? ` - ${complemento}` : ""} · ${bairro}`, lat: ponto.lat, lng: ponto.lng };
      D.salvarEndereco(usuario.id, { cep: $("cep").value, rua, numero, bairro, complemento, lat: ponto.lat, lng: ponto.lng });
    }

    const arquivo = $("prescription").files[0];
    if (med.receita !== "isento" && !arquivo) return erro("Envie a foto ou o PDF da receita para continuar.", $("prescription"));

    const pagamento = new FormData($("checkoutForm")).get("payment");
    let troco = null;
    if (pagamento === "dinheiro" && $("change").value.trim()) {
      troco = Number($("change").value.replace(/[^\d,]/g, "").replace(",", "."));
      if (!(troco > v.total)) return erro(`O troco precisa ser para um valor acima de ${D.moeda(v.total)}.`, $("change"));
    }

    usuario.telefone = telefone;
    if (usuario.nome === "Visitante") usuario.nome = nome;
    D.iniciarSessao(usuario);
    atualizarUsuario();

    const novo = D.criarPedido({
      farmaciaId: f.id,
      clienteId: usuario.id,
      clienteNome: nome,
      telefone,
      itens: [{ medId: med.id, nome: med.nome, apresentacao: med.apresentacao, qtd: quantidade, preco: v.precoUnit }],
      subtotal: v.subtotal,
      taxa: v.taxa,
      total: v.total,
      tipo: recebimento,
      endereco,
      bairro: endereco ? $("district").value.trim() : f.bairro,
      pagamento,
      troco,
      receita: arquivo ? arquivo.name : null,
      prazo: recebimento === "entrega" ? D.prazoEntrega(v.distancia) : 30
    });

    statusConhecidos.set(novo.id, novo.status);
    pedidoAberto = novo.id;
    limparCompra();
    irPara("tracking");
    aviso(`Pedido #DC-${novo.id} enviado para ${f.nome}.`);
  }

  /* ---------- acompanhamento ---------- */

  function rotuloEtapa(p, status) {
    if (status === "pendente") return "Pedido enviado à farmácia";
    if (status === "separacao") return "Confirmado e em separação";
    return D.rotulo(p, status);
  }

  function renderAcompanhamento() {
    const p = D.pedido(pedidoAberto);
    if (!p) return;
    const f = D.farmacia(p.farmaciaId);
    const cancelado = p.status === "cancelado";
    const concluido = p.status === "concluido";

    const marca = $("trackingIcon");
    marca.className = `success-icon${cancelado ? " canceled" : concluido ? "" : " waiting"}`;
    marca.innerHTML = cancelado ? "×" : concluido ? "✓" : icone("clock");

    $("trackingTitle").textContent = D.rotulo(p);
    $("orderNumber").textContent = `Pedido #DC-${p.id} · ${f.nome} · ${D.dataCurta(p.criado)}`;
    if (cancelado) $("trackingEta").textContent = p.motivo || "";
    else if (concluido) $("trackingEta").textContent = `Finalizado às ${D.hora(p.historico.concluido)}. Obrigado pela confiança!`;
    else $("trackingEta").textContent = `Previsão: ${p.tipo === "entrega" ? "chegar" : "ficar pronto"} até ${D.hora(D.previsao(p))}`;

    const mostrarCodigo = p.tipo === "retirada" && !cancelado && !concluido;
    $("pickupCode").hidden = !mostrarCodigo;
    if (mostrarCodigo) {
      $("pickupCode").innerHTML = `<span>Código de retirada</span><strong>${esc(p.codigoRetirada)}</strong><small>Apresente no balcão da ${esc(f.nome)}, ${esc(f.endereco)}.</small>`;
    }

    const passos = cancelado ? ["pendente", "cancelado"] : D.etapas(p);
    const atual = passos.indexOf(p.status);
    $("timeline").innerHTML = passos.map((status, i) => {
      const feito = i <= atual;
      const quando = p.historico[status];
      const texto = rotuloEtapa(p, status);
      return `<div class="step${feito ? " done" : ""}${status === "cancelado" ? " canceled" : ""}">
        <span class="dot">${feito ? (status === "cancelado" ? "×" : "✓") : "·"}</span>
        <span>${i === atual ? `<strong>${texto}</strong>` : texto}${quando ? `<small>${D.hora(quando)}</small>` : ""}</span>
      </div>`;
    }).join("");

    const pagamentos = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro" };
    const linhas = p.itens.map(item => `<div><dt>${item.qtd}× ${esc(item.nome)}</dt><dd>${D.moeda(item.preco * item.qtd)}</dd></div>`).join("");
    $("orderSummary").innerHTML = `
      <h2>Resumo</h2>
      <dl class="totals">
        ${linhas}
        <div><dt>${p.tipo === "entrega" ? "Entrega" : "Retirada na loja"}</dt><dd>${p.taxa ? D.moeda(p.taxa) : "Grátis"}</dd></div>
        <div class="total"><dt>Total</dt><dd>${D.moeda(p.total)}</dd></div>
      </dl>
      <p class="small muted">Pagamento: ${pagamentos[p.pagamento] || "Pix"}${p.troco ? ` · troco para ${D.moeda(p.troco)}` : ""}</p>
      <p class="small muted">${p.tipo === "entrega" ? `Entrega em: ${esc(p.endereco.texto)}` : `Retirada em: ${esc(f.endereco)} · ${esc(f.bairro)}`}</p>
      ${p.receita ? `<p class="small muted">Receita enviada: ${esc(p.receita)}</p>` : ""}
      <p class="small muted">Dúvidas? Ligue para a farmácia: <a class="link" href="tel:+55${f.telefone.replace(/\D/g, "")}">${f.telefone}</a></p>`;

    $("cancelOrder").hidden = p.status !== "pendente";
    desenharMapaPedido(p, f);
  }

  function posicaoEntregador(p, f) {
    const t = D.progressoEntrega(p);
    return [f.lat + (p.endereco.lat - f.lat) * t, f.lng + (p.endereco.lng - f.lng) * t];
  }

  function desenharMapaPedido(p, f) {
    if (!mapas.pedido) {
      mapas.pedido = Mapa.criar($("trackingMap"), f, 14);
      if (!mapas.pedido) return;
      mapas.camada = L.layerGroup().addTo(mapas.pedido);
    }
    Mapa.ajustar(mapas.pedido);
    mapas.camada.clearLayers();
    mapas.moto = null;

    L.marker([f.lat, f.lng], { icon: Mapa.pino("farmacia", true) }).bindTooltip(esc(f.nome), { direction: "top" }).addTo(mapas.camada);

    const novoPedido = mapas.pedidoId !== p.id;
    mapas.pedidoId = p.id;

    if (p.tipo === "entrega" && p.endereco) {
      const casa = [p.endereco.lat, p.endereco.lng];
      L.marker(casa, { icon: Mapa.pino("casa") }).bindTooltip("Endereço de entrega", { direction: "top" }).addTo(mapas.camada);
      L.polyline([[f.lat, f.lng], casa], { color: "#941d3e", weight: 3, opacity: 0.7, dashArray: "6 8" }).addTo(mapas.camada);
      if (p.status === "transporte") {
        mapas.moto = L.marker(posicaoEntregador(p, f), { icon: Mapa.pino("moto"), zIndexOffset: 500 })
          .bindTooltip("Entregador a caminho", { direction: "top" })
          .addTo(mapas.camada);
      }
      if (novoPedido) mapas.pedido.fitBounds([[f.lat, f.lng], casa], { padding: [50, 50], maxZoom: 15 });
    } else if (novoPedido) {
      mapas.pedido.setView([f.lat, f.lng], 15);
    }
  }

  function moverEntregador() {
    if (!mapas.moto) return;
    const p = D.pedido(pedidoAberto);
    if (!p || p.status !== "transporte") return;
    mapas.moto.setLatLng(posicaoEntregador(p, D.farmacia(p.farmaciaId)));
  }

  /* ---------- pedidos, notificações e perfil ---------- */

  function linhaPedido(p) {
    const f = D.farmacia(p.farmaciaId);
    return `<button class="row order-row" data-order="${p.id}">
      ${icone(p.tipo === "entrega" ? "truck" : "store")}
      <span class="text"><strong>${esc(resumoItens(p))}</strong><span class="small muted">#DC-${p.id} · ${D.dataCurta(p.criado)} · ${esc(f.nome)}</span><span class="status-tag ${p.status}">${D.rotulo(p)}</span></span>
      <span class="order-total">${D.moeda(p.total)}</span>
      <span class="chevron" aria-hidden="true">›</span>
    </button>`;
  }

  function renderPedidos() {
    const lista = meusPedidos().sort((a, b) => b.criado - a.criado);
    if (!lista.length) {
      $("ordersList").innerHTML = `<div class="empty-state">${icone("order")}<h2>Nenhum pedido ainda</h2><p>Busque um medicamento, escolha a farmácia e faça seu primeiro pedido.</p><button class="primary" type="button" data-shortcut="home">Buscar medicamento</button></div>`;
      return;
    }
    const andamento = lista.filter(p => !["concluido", "cancelado"].includes(p.status));
    const anteriores = lista.filter(p => ["concluido", "cancelado"].includes(p.status));
    $("ordersList").innerHTML =
      (andamento.length ? `<h2 class="list-title">Em andamento</h2><div class="order-group">${andamento.map(linhaPedido).join("")}</div>` : "") +
      (anteriores.length ? `<h2 class="list-title">Anteriores</h2><div class="order-group">${anteriores.map(linhaPedido).join("")}</div>` : "");
  }

  function textoEvento(p, status) {
    const f = D.farmacia(p.farmaciaId);
    return {
      pendente: `Pedido enviado para ${f.nome}. Aguardando confirmação.`,
      separacao: "A farmácia confirmou e está separando seus itens.",
      transporte: "Seu pedido saiu para entrega.",
      pronto: `Pronto para retirada. Código: ${p.codigoRetirada}.`,
      concluido: p.tipo === "entrega" ? "Pedido entregue. Obrigado!" : "Pedido retirado. Obrigado!",
      cancelado: p.motivo ? `Pedido cancelado. ${p.motivo}` : "Pedido cancelado."
    }[status];
  }

  function renderNotificacoes() {
    const leitura = D.ultimaLeitura(usuario.id);
    const eventos = [];
    meusPedidos().forEach(p => Object.entries(p.historico).forEach(([status, quando]) => eventos.push({ p, status, quando })));
    eventos.sort((a, b) => b.quando - a.quando);
    D.marcarLidas(usuario.id);
    $("notificationDot").hidden = true;

    if (!eventos.length) {
      $("notificationsList").innerHTML = `<div class="empty-state">${icone("bell")}<h2>Tudo em dia por aqui.</h2><p>As atualizações dos seus pedidos aparecem neste espaço.</p></div>`;
      return;
    }
    $("notificationsList").innerHTML = eventos.slice(0, 30).map(({ p, status, quando }) =>
      `<button class="row notification-row${quando > leitura ? " unread" : ""}" data-order="${p.id}">
        ${icone(status === "transporte" ? "truck" : status === "pronto" ? "store" : "bell")}
        <span class="text"><strong>Pedido #DC-${p.id}</strong><span class="small">${esc(textoEvento(p, status))}</span><span class="small muted">${D.dataCurta(quando)}</span></span>
        <span class="chevron" aria-hidden="true">›</span>
      </button>`
    ).join("");
  }

  function renderPerfil() {
    const lista = meusPedidos();
    const andamento = lista.filter(p => !["concluido", "cancelado"].includes(p.status)).length;
    const gasto = lista.filter(p => p.status !== "cancelado").reduce((soma, p) => soma + p.total, 0);
    $("profileStats").innerHTML = `
      <div><strong>${lista.length}</strong><span>Pedidos</span></div>
      <div><strong>${andamento}</strong><span>Em andamento</span></div>
      <div><strong>${D.moeda(gasto)}</strong><span>Total em compras</span></div>`;
    const endereco = D.enderecoSalvo(usuario.id);
    $("profileAddress").innerHTML = endereco
      ? `<strong>Endereço salvo</strong><p class="small muted">${esc(endereco.rua)}, ${esc(endereco.numero)}${endereco.complemento ? ` - ${esc(endereco.complemento)}` : ""} · ${esc(endereco.bairro)}${endereco.cep ? ` · CEP ${esc(endereco.cep)}` : ""}</p>`
      : '<strong>Endereço salvo</strong><p class="small muted">Seu endereço fica salvo depois do primeiro pedido com entrega.</p>';
  }

  /* ---------- atualizações em tempo real ---------- */

  function atualizarSino() {
    if (!usuario) return;
    const leitura = D.ultimaLeitura(usuario.id);
    const novidade = meusPedidos().some(p => Object.values(p.historico).some(quando => quando > leitura));
    $("notificationDot").hidden = !novidade || telaAtual === "notifications";
  }

  function verificarMudancas() {
    meusPedidos().forEach(p => {
      const anterior = statusConhecidos.get(p.id);
      if (anterior && anterior !== p.status) aviso(`Pedido #DC-${p.id}: ${D.rotulo(p)}.`);
      statusConhecidos.set(p.id, p.status);
    });
    atualizarSino();
  }

  function dadosMudaram() {
    if (!usuario) return;
    verificarMudancas();
    if (telaAtual !== "receive") renderizar(telaAtual);
  }

  function tique() {
    segundos++;
    if (!usuario) return;
    if (segundos % 3 === 0 && D.processarFila()) dadosMudaram();
    if (telaAtual === "tracking") moverEntregador();
  }

  /* ---------- acesso ---------- */

  function modo(novo) {
    modoAcesso = novo;
    const cadastro = novo === "register";
    $("nameGroup").hidden = !cadastro;
    $("confirmGroup").hidden = !cadastro;
    $("authName").required = cadastro;
    $("confirmPassword").required = cadastro;
    $("forgotPassword").hidden = cadastro;
    $("authPassword").autocomplete = cadastro ? "new-password" : "current-password";
    $("authPassword").type = "password";
    $("togglePassword").setAttribute("aria-pressed", "false");
    $("togglePassword").setAttribute("aria-label", "Mostrar senha");
    $("authPassword").value = "";
    $("confirmPassword").value = "";
    $("authTitle").textContent = cadastro ? "Seu cuidado começa aqui." : "Que bom ter você aqui.";
    $("authSubtitle").textContent = cadastro ? "Crie sua conta em menos de um minuto." : "Entre para acompanhar seus pedidos.";
    $("authSubmit").innerHTML = `${cadastro ? "Criar minha conta" : "Entrar na minha conta"} <span aria-hidden="true">→</span>`;
    $("authMessage").textContent = "";
    [["loginTab", !cadastro], ["registerTab", cadastro]].forEach(([id, ativo]) => {
      $(id).classList.toggle("selected", ativo);
      $(id).setAttribute("aria-pressed", String(ativo));
    });
  }

  function atualizarUsuario() {
    const primeiroNome = usuario.nome.split(/\s+/)[0];
    const inicial = usuario.nome.charAt(0).toUpperCase();
    $("greeting").innerHTML = `Olá, ${esc(primeiroNome)} <span aria-hidden="true">✦</span>`;
    $("profileName").textContent = usuario.nome;
    $("profileEmail").textContent = usuario.email || "Comprando sem cadastro";
    $("profileBadge").textContent = usuario.email ? "Cliente Dose Certa" : "Sem cadastro";
    $("profileAvatar").textContent = inicial;
    $("profileButton").textContent = inicial;
  }

  function entrar(dados, telaInicial = "home") {
    usuario = dados;
    D.iniciarSessao(usuario);
    atualizarUsuario();
    statusConhecidos.clear();
    meusPedidos().forEach(p => statusConhecidos.set(p.id, p.status));
    $("authForm").reset();
    pilha = [];
    telaAtual = "";
    mostrarTela(telaInicial, { empilhar: false });
    atualizarSino();
  }

  async function enviarAcesso(evento) {
    evento.preventDefault();
    if (!$("authForm").reportValidity()) return;
    const email = $("authEmail").value.trim().toLowerCase();
    const senha = $("authPassword").value;
    const nome = $("authName").value.trim().replace(/\s+/g, " ");
    const mensagem = texto => { $("authMessage").textContent = texto; };
    mensagem("");

    if (modoAcesso === "register" && nome.length < 2) {
      mensagem("Informe um nome com pelo menos 2 letras.");
      $("authName").focus();
      return;
    }
    if (modoAcesso === "register" && senha !== $("confirmPassword").value) {
      mensagem("As senhas precisam ser iguais.");
      $("confirmPassword").focus();
      return;
    }

    const botoes = ["loginTab", "registerTab", "guestAccess", "authSubmit"];
    botoes.forEach(id => { $(id).disabled = true; });
    $("authForm").setAttribute("aria-busy", "true");
    try {
      const resumo = await D.resumoSenha(senha);
      const contas = D.contas();
      if (modoAcesso === "register") {
        if (email === "demo@dosecerta.app" || contas[email]) {
          mensagem("Já existe uma conta com este e-mail. Use a aba Entrar.");
          return;
        }
        contas[email] = { nome, resumo, criado: Date.now() };
        D.salvarContas(contas);
        entrar({ id: email, nome, email });
      } else if (email === "demo@dosecerta.app" && resumo === await D.resumoSenha("Dose1234")) {
        entrar({ id: email, nome: "Alex Moreira", email, telefone: "(61) 99876-5432" });
      } else if (contas[email] && contas[email].resumo === resumo) {
        entrar({ id: email, nome: contas[email].nome, email });
      } else {
        mensagem("E-mail ou senha incorretos.");
      }
    } catch {
      mensagem("Não foi possível entrar por este navegador. Você pode continuar sem cadastro.");
    } finally {
      botoes.forEach(id => { $(id).disabled = false; });
      $("authForm").removeAttribute("aria-busy");
    }
  }

  function sair() {
    D.encerrarSessao();
    usuario = null;
    pilha = [];
    pedidoAberto = null;
    farmSelecionada = null;
    medSelecionado = null;
    limparCompra();
    statusConhecidos.clear();
    $("notificationDot").hidden = true;
    modo("login");
    mostrarTela("auth", { empilhar: false });
  }

  /* ---------- eventos ---------- */

  $("searchInput").addEventListener("input", renderCatalogo);
  $("clearSearch").onclick = () => {
    $("searchInput").value = "";
    renderCatalogo();
    $("searchInput").focus();
  };

  $("categoryChips").addEventListener("click", evento => {
    const chip = evento.target.closest("[data-category]");
    if (!chip) return;
    categoriaAtiva = chip.dataset.category;
    renderCategorias();
    renderCatalogo();
  });

  $("results").addEventListener("click", evento => {
    const item = evento.target.closest("[data-med]");
    if (!item) return;
    medSelecionado = D.medicamento(item.dataset.med);
    mostrarTela("mapScreen");
  });

  $("pharmacyList").addEventListener("click", evento => {
    const item = evento.target.closest("[data-pharmacy]");
    if (item) abrirFarmacia(item.dataset.pharmacy);
  });

  $("popularMeds").addEventListener("click", evento => {
    const item = evento.target.closest("[data-popular-med]");
    if (!item) return;
    const id = Number(item.dataset.popularMed);
    medPopular = medPopular === id ? null : id;
    renderPopular();
  });

  $("popularList").addEventListener("click", evento => {
    const item = evento.target.closest("[data-pharmacy]");
    if (item) abrirFarmaciaPopular(item.dataset.pharmacy);
  });

  document.addEventListener("click", evento => {
    const pedido = evento.target.closest("[data-order]");
    if (pedido) {
      pedidoAberto = Number(pedido.dataset.order);
      mostrarTela("tracking");
      return;
    }
    const atalho = evento.target.closest("[data-shortcut]");
    if (atalho) mostrarTela(atalho.dataset.shortcut);
  });

  $("sortPharmacies").onchange = renderFarmacias;
  $("locateButton").onclick = usarMinhaLocalizacao;
  $("locationChip").onclick = usarMinhaLocalizacao;
  $("changeMedicine").onclick = () => {
    irPara("home");
    $("searchInput").focus();
  };
  $("pickMedicine").onclick = () => irPara("home");

  $("qtyMinus").onclick = () => { quantidade--; renderDetalhe(); };
  $("qtyPlus").onclick = () => { quantidade++; renderDetalhe(); };
  $("continue").onclick = () => {
    limparCompra();
    mostrarTela("receive");
  };

  $("pickup").onclick = () => escolherRecebimento("retirada");
  $("delivery").onclick = () => escolherRecebimento("entrega");
  $("checkoutForm").addEventListener("submit", finalizarCompra);

  $("cep").addEventListener("input", () => {
    const digitos = $("cep").value.replace(/\D/g, "").slice(0, 8);
    $("cep").value = digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
    if (digitos.length === 8) buscarCep(digitos);
  });

  $("contactPhone").addEventListener("input", () => {
    const d = $("contactPhone").value.replace(/\D/g, "").slice(0, 11);
    let texto = d;
    if (d.length > 2) texto = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 7) texto = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
    $("contactPhone").value = texto;
  });

  $("prescription").addEventListener("change", () => {
    const arquivo = $("prescription").files[0];
    $("prescriptionName").textContent = arquivo ? `✓ ${arquivo.name}` : "Enviar foto ou PDF da receita";
  });

  $("checkoutForm").addEventListener("change", evento => {
    if (evento.target.name === "payment") $("changeGroup").hidden = evento.target.value !== "dinheiro";
  });

  $("cancelOrder").onclick = () => {
    if (!confirm(`Cancelar o pedido #DC-${pedidoAberto}?`)) return;
    if (D.cancelarPedido(pedidoAberto, "Cancelado por você.")) {
      statusConhecidos.set(pedidoAberto, "cancelado");
      renderAcompanhamento();
      aviso("Pedido cancelado.");
    } else {
      aviso("A farmácia já confirmou este pedido. Para cancelar, ligue para a loja.");
      renderAcompanhamento();
    }
  };

  $("newSearch").onclick = () => irPara("home");
  $("back").onclick = () => history.back();

  botoesNav.forEach(botao => {
    botao.onclick = () => irPara(botao.dataset.nav);
  });

  $("loginTab").onclick = () => modo("login");
  $("registerTab").onclick = () => modo("register");
  $("togglePassword").onclick = () => {
    const mostrar = $("authPassword").type === "password";
    $("authPassword").type = mostrar ? "text" : "password";
    $("togglePassword").setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
    $("togglePassword").setAttribute("aria-pressed", String(mostrar));
  };
  $("forgotPassword").onclick = () => {
    $("authMessage").textContent = "A recuperação por e-mail ainda não está disponível. Crie uma nova conta ou use a conta de teste.";
  };
  $("fillDemo").onclick = () => {
    modo("login");
    $("authEmail").value = "demo@dosecerta.app";
    $("authPassword").value = "Dose1234";
    $("authSubmit").focus();
  };
  $("authForm").addEventListener("submit", enviarAcesso);
  $("guestAccess").onclick = () => {
    const anterior = D.sessao();
    const id = anterior && !anterior.email ? anterior.id : `visitante-${Date.now().toString(36)}`;
    entrar({ id, nome: "Visitante", email: "" });
  };

  $("profileButton").onclick = () => mostrarTela("profile");
  $("notificationsButton").onclick = () => mostrarTela("notifications");
  $("profileOrders").onclick = $("notificationOrders").onclick = () => mostrarTela("orders");
  $("signOut").onclick = sair;

  D.aoMudar(dadosMudaram);

  /* ---------- início ---------- */

  renderCategorias();
  atualizarLocal();
  modo("login");

  const busca = new URLSearchParams(location.search).get("busca");
  if (busca) $("searchInput").value = busca.slice(0, 80);

  const sessaoSalva = D.sessao();
  const telaDoEndereco = location.hash.slice(1);
  if (sessaoSalva) {
    entrar(sessaoSalva, !busca && TELAS_LIVRES.includes(telaDoEndereco) ? telaDoEndereco : "home");
  } else {
    mostrarTela("auth", { empilhar: false });
  }

  setInterval(tique, 1000);
})();
