// Portal da farmácia: pedidos, estoque, clientes, entregas e relatórios da unidade.
(() => {
  "use strict";

  const D = window.DoseCerta;
  const $ = id => document.getElementById(id);
  const esc = D.escapar;

  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#${name}"/></svg>`;

  let unidade = D.unidade();
  let paginaAtual = "orders";
  let timerAviso;
  let pendentesConhecidos = new Set();
  const mapa = { entregas: null, camada: null, unidadeId: null };

  const pagamentos = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro" };

  function aviso(texto) {
    $("toast").textContent = texto;
    $("toast").hidden = false;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => { $("toast").hidden = true; }, 4200);
  }

  const busca = () => D.normalizar($("searchInput").value.trim());
  const pedidosDaUnidade = () => D.pedidos().filter(p => p.farmaciaId === unidade.id).sort((a, b) => b.criado - a.criado);
  const resumoItens = p => p.itens.map(item => `${item.qtd}× ${item.nome}`).join(", ");

  function confere(p) {
    const termo = busca();
    if (!termo) return true;
    return D.normalizar(`${p.id} DC-${p.id} ${p.clienteNome} ${resumoItens(p)} ${p.bairro}`).includes(termo);
  }

  function situacaoEstoque(quantidade) {
    if (quantidade === 0) return { texto: "Sem estoque", cls: "empty" };
    if (quantidade <= 20) return { texto: "Estoque baixo", cls: "low" };
    return { texto: "Em estoque", cls: "good" };
  }

  const ehHoje = timestamp => new Date(timestamp).toDateString() === new Date().toDateString();
  const pedidosDeHoje = () => pedidosDaUnidade().filter(p => ehHoje(p.criado));

  /* ---------- navegação ---------- */

  function abrirPagina(pagina) {
    const alvo = $(pagina);
    if (!alvo || !alvo.classList.contains("page")) return;
    paginaAtual = pagina;
    document.querySelectorAll(".page").forEach(secao => secao.classList.toggle("active", secao.id === pagina));
    document.querySelectorAll("[data-page]").forEach(botao => {
      const ativo = botao.dataset.page === pagina;
      botao.classList.toggle("active", ativo);
      if (ativo) botao.setAttribute("aria-current", "page");
      else botao.removeAttribute("aria-current");
    });
    $("searchInput").placeholder = pagina === "stock" ? "Buscar medicamento no seu estoque..." : "Buscar pedido, cliente ou medicamento...";
    render();
    const titulo = alvo.querySelector("h1");
    titulo.tabIndex = -1;
    titulo.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "auto" });
    history.replaceState(null, "", `#${pagina}`);
  }

  /* ---------- pedidos ---------- */

  function cartaoPedido(p) {
    let acao = "";
    if (p.status === "pendente") acao = "Confirmar pedido";
    if (p.status === "separacao") acao = p.tipo === "entrega" ? "Despachar entrega" : "Liberar para retirada";
    if (p.status === "transporte") acao = "Confirmar entrega";
    if (p.status === "pronto") acao = "Confirmar retirada";

    const recebimento = p.tipo === "entrega"
      ? (p.status === "transporte" ? "Saiu para entrega" : "Entrega em domicílio")
      : "Retirada na farmácia";
    const destino = p.tipo === "entrega" ? esc(p.endereco?.texto || p.bairro) : `Código de retirada: <strong>${esc(p.codigoRetirada)}</strong>`;

    let final;
    if (acao) {
      final = `<div class="order-action">
        <button class="btn" data-advance="${p.id}">${acao}</button>
        ${p.status === "pendente" ? `<button class="btn light" data-refuse="${p.id}">Recusar</button>` : ""}
      </div>`;
    } else if (p.status === "cancelado") {
      final = `<span class="empty small">✕ ${esc(p.motivo || "Pedido cancelado")}</span>`;
    } else {
      final = '<span class="good small">✓ Pedido concluído</span>';
    }

    return `
      <article class="order ${p.status === "pendente" ? "new" : ""}">
        <div class="order-top">
          <span class="order-id">#DC-${p.id}</span>
          <span class="badge ${p.status}">${D.rotulo(p)}</span>
          ${p.auto ? '<span class="origin-tag">App</span>' : ""}
          <span class="time">${D.haTempo(p.criado)}</span>
        </div>
        <div class="order-body">
          <div class="product-art"><span class="capsule"></span></div>
          <div class="person">
            <div class="avatar">${esc(p.clienteNome.charAt(0))}</div>
            <div>
              <strong>${esc(p.clienteNome)}</strong>
              <p>${esc(resumoItens(p))}</p>
              <p class="muted small">${D.moeda(p.total)} · ${pagamentos[p.pagamento] || "Pix"}${p.troco ? ` (troco p/ ${D.moeda(p.troco)})` : ""}${p.telefone ? ` · ${esc(p.telefone)}` : ""}</p>
              ${p.receita ? `<p class="receipt small">${icon("file")}Receita: ${esc(p.receita)}</p>` : ""}
            </div>
          </div>
          <div class="fulfillment">
            <strong>${recebimento}</strong>
            <span class="muted">${destino}</span>
          </div>
          ${final}
        </div>
      </article>`;
  }

  function renderPedidos() {
    const status = $("statusFilter").value;
    const tipo = $("typeFilter").value;
    const lista = pedidosDaUnidade().filter(p => confere(p) && (!status || p.status === status) && (!tipo || p.tipo === tipo));
    $("orderList").innerHTML = lista.length
      ? lista.map(cartaoPedido).join("")
      : '<div class="panel empty-state">Nenhum pedido encontrado para esta busca.</div>';
  }

  function renderResumo() {
    $("today").textContent = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    const hoje = pedidosDeHoje();
    const concluidos = hoje.filter(p => p.status === "concluido");
    const media = concluidos.length
      ? Math.round(concluidos.reduce((soma, p) => soma + (p.historico.concluido - p.criado), 0) / concluidos.length / 60000)
      : null;
    const faturamento = concluidos.reduce((soma, p) => soma + p.total, 0);

    const stats = [
      ["cart", "Pedidos recebidos", hoje.length],
      ["check", "Pedidos confirmados", hoje.filter(p => p.historico.separacao).length],
      ["money", "Faturamento concluído", D.moeda(faturamento)],
      ["clock", "Tempo médio até concluir", media === null ? "—" : `${media} min`]
    ];
    $("summaryStats").innerHTML = stats.map(([simbolo, rotulo, valor]) => `
      <div class="stat">
        <div class="stat-icon">${icon(simbolo)}</div>
        <div><span>${rotulo}</span><strong>${valor}</strong></div>
      </div>`).join("");

    const criticos = D.catalogo()
      .map(m => ({ m, qtd: D.estoqueDe(unidade.id, m.id) }))
      .sort((a, b) => a.qtd - b.qtd)
      .slice(0, 3);
    $("stockPreview").innerHTML = criticos.map(({ m, qtd }) => {
      const s = situacaoEstoque(qtd);
      return `<div class="stock-item">
        <div class="product-art"><span class="capsule"></span></div>
        <div><p>${esc(m.nome)}</p><p class="${s.cls}">${s.texto}</p></div>
        <span class="stock-count">${qtd} cx.</span>
      </div>`;
    }).join("");

    const pendentes = pedidosDaUnidade().filter(p => p.status === "pendente").length;
    $("pendingCount").hidden = !pendentes;
    $("pendingCount").textContent = pendentes;
    document.title = `${pendentes ? `(${pendentes}) ` : ""}Dose Certa | Portal da Farmácia`;
  }

  function avancar(id) {
    const resultado = D.avancarPedido(id);
    if (!resultado.ok) {
      aviso(resultado.motivo.includes("estoque") ? `${resultado.motivo} Atualize o estoque antes de confirmar.` : resultado.motivo);
      return;
    }
    pendentesConhecidos.delete(resultado.pedido.id);
    render();
    aviso(`Pedido #DC-${id}: ${D.rotulo(resultado.pedido)}.`);
  }

  function recusar(id) {
    if (!confirm(`Recusar o pedido #DC-${id}? O cliente será avisado no app.`)) return;
    if (D.cancelarPedido(id, "A farmácia não pôde atender este pedido.")) {
      render();
      aviso(`Pedido #DC-${id} recusado.`);
    }
  }

  /* ---------- estoque ---------- */

  function renderEstoque() {
    const filtro = $("stockFilter").value;
    const categoria = $("categoryFilter").value;
    const termos = busca().split(/\s+/).filter(Boolean);
    const catalogo = D.catalogo().map(m => ({ m, qtd: D.estoqueDe(unidade.id, m.id) }));
    const lista = catalogo.filter(({ m, qtd }) =>
      termos.every(t => D.normalizar(`${m.nome} ${m.apresentacao}`).includes(t)) &&
      (!categoria || m.categoria === categoria) &&
      (!filtro || situacaoEstoque(qtd).cls === filtro)
    );

    $("stockResultCount").textContent = `${lista.length} de ${catalogo.length} medicamentos no catálogo`;

    const metricas = [
      ["box", "Itens no catálogo", catalogo.length, "", "Ver todos os medicamentos"],
      ["cart", "Caixas disponíveis", catalogo.reduce((soma, item) => soma + item.qtd, 0), "", "Total nesta unidade"],
      ["clock", "Estoque baixo", catalogo.filter(item => item.qtd > 0 && item.qtd <= 20).length, "low", "De 1 a 20 caixas"],
      ["box", "Sem estoque", catalogo.filter(item => item.qtd === 0).length, "empty", "Itens para reposição"]
    ];
    $("inventoryMetrics").innerHTML = metricas.map(([simbolo, rotulo, valor, chave, dica]) =>
      `<button class="inventory-metric ${chave === "low" ? "warn" : ""}" data-stock-filter="${chave}" aria-label="${rotulo}: ${valor}. ${dica}"><span class="metric-icon">${icon(simbolo)}</span><span>${rotulo}</span><strong>${valor.toLocaleString("pt-BR")}</strong><small>${dica}</small></button>`
    ).join("");

    $("stockTable").innerHTML = lista.length ? lista.map(({ m, qtd }) => {
      const s = situacaoEstoque(qtd);
      return `<tr>
        <td><div class="stock-product"><div class="product-art" aria-hidden="true"><span class="capsule" style="--cor:${D.categoria(m.categoria).cor}"></span></div><div><strong>${esc(m.nome)}</strong><small class="muted">${esc(D.categoria(m.categoria).nome)}${m.receita !== "isento" ? " · receita" : ""}</small></div></div></td>
        <td>${esc(m.apresentacao)}</td>
        <td class="price-cell">${D.moeda(D.preco(m, unidade))}</td>
        <td><span class="stock-status ${s.cls}">${s.texto}</span></td>
        <td><input class="field" type="number" min="0" max="100000" step="1" id="stock-${m.id}" value="${qtd}" aria-label="Quantidade de ${esc(m.nome)}"></td>
        <td><button class="btn light" data-save-stock="${m.id}" aria-label="Salvar estoque de ${esc(m.nome)}">Salvar</button></td>
      </tr>`;
    }).join("") : '<tr><td colspan="6" class="empty-state">Nenhum medicamento encontrado.</td></tr>';
  }

  function salvarEstoque(id) {
    const campo = $(`stock-${id}`);
    const valor = Number(campo.value);
    if (campo.value.trim() === "" || !Number.isInteger(valor) || valor < 0 || valor > 100000) {
      aviso("Informe uma quantidade inteira entre 0 e 100.000.");
      return;
    }
    const salvo = D.definirEstoque(unidade.id, id, valor);
    render();
    if (salvo) aviso(valor === 0 ? "Medicamento marcado como sem estoque." : "Estoque atualizado. Os clientes já veem a mudança.");
    else aviso("O navegador não permitiu salvar a alteração.");
    const proximo = $(`stock-${id}`);
    if (proximo) proximo.focus({ preventScroll: true });
  }

  /* ---------- clientes ---------- */

  function renderClientes() {
    const grupos = new Map();
    pedidosDaUnidade().forEach(p => {
      if (!grupos.has(p.clienteId)) grupos.set(p.clienteId, []);
      grupos.get(p.clienteId).push(p);
    });
    const termo = busca();
    const linhas = [...grupos.values()].filter(lista => D.normalizar(`${lista[0].clienteNome} ${lista[0].bairro}`).includes(termo));
    $("clientsTable").innerHTML = linhas.length ? linhas.map(lista => {
      const total = lista.filter(p => p.status !== "cancelado").reduce((soma, p) => soma + p.total, 0);
      return `<tr>
        <td><strong>${esc(lista[0].clienteNome)}</strong>${lista[0].auto ? ' <span class="origin-tag">App</span>' : ""}</td>
        <td>${esc(lista[0].bairro)}</td>
        <td>${lista.length}</td>
        <td>${D.moeda(total)}</td>
        <td>#DC-${lista[0].id} · ${D.haTempo(lista[0].criado)}</td>
      </tr>`;
    }).join("") : '<tr><td colspan="5" class="empty-state">Nenhum cliente encontrado.</td></tr>';
  }

  /* ---------- entregas ---------- */

  function renderEntregas() {
    const entregas = pedidosDaUnidade().filter(p => p.tipo === "entrega" && confere(p));
    $("deliveryList").innerHTML = entregas.length
      ? entregas.map(cartaoPedido).join("")
      : '<div class="panel empty-state">Nenhuma entrega encontrada.</div>';

    if (!mapa.entregas) {
      mapa.entregas = Mapa.criar($("deliveryMap"), unidade, 13);
      if (!mapa.entregas) return;
      mapa.camada = L.layerGroup().addTo(mapa.entregas);
    }
    Mapa.ajustar(mapa.entregas);
    mapa.camada.clearLayers();
    L.marker([unidade.lat, unidade.lng], { icon: Mapa.pino("farmacia", true) }).bindTooltip(esc(unidade.nome), { direction: "top" }).addTo(mapa.camada);

    const ativas = entregas.filter(p => p.endereco && !["concluido", "cancelado"].includes(p.status));
    ativas.forEach(p => {
      const casa = [p.endereco.lat, p.endereco.lng];
      L.marker(casa, { icon: Mapa.pino(p.status === "transporte" ? "moto" : "casa") })
        .bindTooltip(`<strong>#DC-${p.id}</strong><br>${esc(p.clienteNome)}<br>${D.rotulo(p)}`, { direction: "top" })
        .addTo(mapa.camada);
      L.polyline([[unidade.lat, unidade.lng], casa], { color: "#941d3e", weight: 2, opacity: 0.6, dashArray: "5 7" }).addTo(mapa.camada);
    });

    if (mapa.unidadeId !== unidade.id) {
      mapa.unidadeId = unidade.id;
      const pontos = [[unidade.lat, unidade.lng], ...ativas.map(p => [p.endereco.lat, p.endereco.lng])];
      if (pontos.length > 1) mapa.entregas.fitBounds(pontos, { padding: [40, 40], maxZoom: 15 });
      else mapa.entregas.setView(pontos[0], 14);
    }
  }

  /* ---------- relatórios ---------- */

  function renderRelatorios() {
    const hoje = pedidosDeHoje();
    const validos = hoje.filter(p => p.status !== "cancelado");
    const concluidos = hoje.filter(p => p.status === "concluido");
    const faturamento = validos.reduce((soma, p) => soma + p.total, 0);
    const taxa = hoje.length ? Math.round(concluidos.length / hoje.length * 100) : 0;

    $("reportMetrics").innerHTML = [
      ["Pedidos do dia", hoje.length],
      ["Concluídos", `${concluidos.length} <small>(${taxa}%)</small>`],
      ["Vendas do dia", D.moeda(faturamento)],
      ["Ticket médio", validos.length ? D.moeda(faturamento / validos.length) : "—"]
    ].map(([rotulo, valor]) => `<div class="panel metric"><span class="muted">${rotulo}</span><strong>${valor}</strong></div>`).join("");

    const etapas = [
      ["pendente", "Aguardando confirmação"],
      ["separacao", "Em separação"],
      ["pronto", "Pronto para retirada"],
      ["transporte", "Saiu para entrega"],
      ["concluido", "Concluído"],
      ["cancelado", "Cancelado"]
    ];
    $("reportBars").innerHTML = etapas.map(([chave, rotulo]) => {
      const qtd = hoje.filter(p => p.status === chave).length;
      const largura = hoje.length ? qtd / hoje.length * 100 : 0;
      return `<div class="report-line"><span>${rotulo}</span><div class="bar"><span style="width:${largura}%"></span></div><strong>${qtd}</strong></div>`;
    }).join("");

    const vendidos = new Map();
    validos.forEach(p => p.itens.forEach(item => {
      const atual = vendidos.get(item.nome) || { qtd: 0, valor: 0 };
      vendidos.set(item.nome, { qtd: atual.qtd + item.qtd, valor: atual.valor + item.qtd * item.preco });
    }));
    const ranking = [...vendidos.entries()].sort((a, b) => b[1].qtd - a[1].qtd).slice(0, 5);
    $("topProducts").innerHTML = ranking.length
      ? ranking.map(([nome, v]) => `<li><span>${esc(nome)}</span><strong>${v.qtd} cx.</strong><small>${D.moeda(v.valor)}</small></li>`).join("")
      : '<li class="muted">Nenhuma venda registrada hoje.</li>';
  }

  function exportarCsv() {
    const linhas = [
      ["Pedido", "Cliente", "Itens", "Recebimento", "Pagamento", "Total", "Status", "Data"],
      ...pedidosDeHoje().map(p => [
        `DC-${p.id}`, p.clienteNome, resumoItens(p),
        p.tipo === "entrega" ? "Entrega" : "Retirada",
        pagamentos[p.pagamento] || "Pix",
        p.total.toFixed(2).replace(".", ","),
        D.rotulo(p), new Date(p.criado).toLocaleString("pt-BR")
      ])
    ];
    // Aspas duplicadas e prefixo nos campos que começam com =, +, - ou @ (evita fórmula no Excel)
    const csv = "﻿" + linhas.map(linha => linha.map(valor =>
      `"${String(valor).replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`
    ).join(";")).join("\r\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `dose-certa-relatorio-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    aviso("Relatório CSV gerado.");
  }

  /* ---------- configurações ---------- */

  function renderConfiguracoes() {
    $("unitSelect").value = unidade.id;
    $("managerName").value = D.responsavel();
    mostrarInfoUnidade(unidade);
  }

  function mostrarInfoUnidade(f) {
    $("unitInfo").innerHTML = `
      <p><strong>${esc(f.nome)}</strong></p>
      <p class="muted small">${esc(f.endereco)} · ${esc(f.bairro)}, Brasília - DF</p>
      <p class="muted small">${f.horario ? `Funciona das ${f.horario.abre} às ${f.horario.fecha}` : "Aberta 24 horas"} · ${esc(f.telefone)}</p>`;
  }

  /* ---------- render geral ---------- */

  function render() {
    $("profileName").textContent = unidade.nome;
    $("profileRole").textContent = D.responsavel();
    $("profileInitial").textContent = unidade.nome.replace(/^(Farmácia|Drogaria)\s+/i, "").charAt(0);
    $("sidebarUnit").textContent = unidade.nome;
    $("unitChip").textContent = unidade.nome;
    renderResumo();
    if (paginaAtual === "orders") renderPedidos();
    if (paginaAtual === "stock") renderEstoque();
    if (paginaAtual === "clients") renderClientes();
    if (paginaAtual === "deliveries") renderEntregas();
    if (paginaAtual === "reports") renderRelatorios();
    if (paginaAtual === "settings") renderConfiguracoes();
  }

  // Avisa quando chega pedido novo pelo app (outra aba ou outro processo)
  function checarNovosPedidos() {
    const pendentes = pedidosDaUnidade().filter(p => p.status === "pendente");
    const novos = pendentes.filter(p => !pendentesConhecidos.has(p.id));
    if (novos.length) aviso(`Novo pedido #DC-${novos[0].id} de ${novos[0].clienteNome}.`);
    pendentesConhecidos = new Set(pendentes.map(p => p.id));
  }

  /* ---------- eventos ---------- */

  document.addEventListener("click", evento => {
    const filtro = evento.target.closest("[data-stock-filter]");
    if (filtro) {
      $("stockFilter").value = filtro.dataset.stockFilter;
      renderEstoque();
      $("stockFilter").focus({ preventScroll: true });
    }
    const nav = evento.target.closest("[data-page],[data-open]");
    if (nav) {
      $("searchInput").value = "";
      abrirPagina(nav.dataset.page || nav.dataset.open);
    }
    const avancarBotao = evento.target.closest("[data-advance]");
    if (avancarBotao) avancar(Number(avancarBotao.dataset.advance));
    const recusarBotao = evento.target.closest("[data-refuse]");
    if (recusarBotao) recusar(Number(recusarBotao.dataset.refuse));
    const salvar = evento.target.closest("[data-save-stock]");
    if (salvar) salvarEstoque(Number(salvar.dataset.saveStock));
  });

  document.addEventListener("keydown", evento => {
    if (evento.key === "Enter" && evento.target.id?.startsWith("stock-")) {
      evento.preventDefault();
      salvarEstoque(Number(evento.target.id.slice(6)));
    }
  });

  $("searchInput").addEventListener("input", () => {
    if (["reports", "settings"].includes(paginaAtual)) abrirPagina("orders");
    else render();
    $("searchInput").focus({ preventScroll: true });
  });

  $("filterToggle").onclick = () => {
    $("filters").hidden = !$("filters").hidden;
    $("filterToggle").setAttribute("aria-expanded", String(!$("filters").hidden));
  };
  $("statusFilter").onchange = renderPedidos;
  $("typeFilter").onchange = renderPedidos;
  $("clearFilters").onclick = () => {
    $("statusFilter").value = "";
    $("typeFilter").value = "";
    $("searchInput").value = "";
    renderPedidos();
  };

  $("stockFilter").onchange = renderEstoque;
  $("categoryFilter").onchange = renderEstoque;

  $("unitSelect").onchange = () => mostrarInfoUnidade(D.farmacia($("unitSelect").value));
  $("settingsForm").onsubmit = evento => {
    evento.preventDefault();
    const nome = $("managerName").value.trim();
    if (!nome) {
      aviso("Informe o responsável pelo atendimento.");
      return;
    }
    D.definirUnidade($("unitSelect").value);
    D.definirResponsavel(nome);
    unidade = D.unidade();
    pendentesConhecidos = new Set(pedidosDaUnidade().filter(p => p.status === "pendente").map(p => p.id));
    render();
    aviso(`Configurações salvas. Você está gerenciando ${unidade.nome}.`);
  };

  $("resetData").onclick = () => {
    if (!confirm("Restaurar os dados iniciais? Pedidos, ajustes de estoque e medicamentos cadastrados serão apagados.")) return;
    D.reiniciarTudo();
    $("searchInput").value = "";
    $("statusFilter").value = "";
    $("typeFilter").value = "";
    $("stockFilter").value = "";
    $("categoryFilter").value = "";
    pendentesConhecidos = new Set(pedidosDaUnidade().filter(p => p.status === "pendente").map(p => p.id));
    mapa.unidadeId = null;
    abrirPagina("orders");
    aviso("Dados restaurados.");
  };

  $("printReport").onclick = () => window.print();
  $("exportCSV").onclick = exportarCsv;

  $("addMedicine").onclick = () => {
    $("medicineForm").reset();
    $("medicineError").textContent = "";
    $("medicineDialog").showModal();
  };
  $("closeMedicine").onclick = $("cancelMedicine").onclick = () => $("medicineDialog").close();
  $("medicineForm").onsubmit = evento => {
    evento.preventDefault();
    if (!$("medicineForm").reportValidity()) return;
    const nome = $("medicineName").value.trim().replace(/\s+/g, " ");
    const apresentacao = $("medicinePack").value.trim().replace(/\s+/g, " ");
    const precoInformado = Number($("medicinePrice").value.replace(/[^\d,.]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", "."));
    const quantidade = Number($("medicineQuantity").value);
    if (!nome || !apresentacao || !(precoInformado > 0 && precoInformado < 10000) || !Number.isInteger(quantidade) || quantidade < 0 || quantidade > 100000) {
      $("medicineError").textContent = "Preencha nome, apresentação, um preço válido e uma quantidade inteira entre 0 e 100.000.";
      return;
    }
    if (D.catalogo().some(m => D.normalizar(m.nome) === D.normalizar(nome) && D.normalizar(m.apresentacao) === D.normalizar(apresentacao))) {
      $("medicineError").textContent = "Este medicamento já está no catálogo. Atualize a quantidade na lista.";
      return;
    }
    D.adicionarMedicamento({
      nome, apresentacao,
      categoria: $("medicineCategory").value,
      receita: $("medicineRx").value,
      preco: Math.round(precoInformado / unidade.fator * 100) / 100
    }, unidade.id, quantidade);
    $("searchInput").value = "";
    $("stockFilter").value = "";
    $("categoryFilter").value = "";
    $("medicineDialog").close();
    render();
    aviso("Medicamento cadastrado. Ele já aparece na busca do app.");
  };

  D.aoMudar(() => {
    unidade = D.unidade();
    checarNovosPedidos();
    // Não redesenha a tabela enquanto alguém digita uma quantidade
    if (paginaAtual === "stock" && document.activeElement?.id?.startsWith("stock-")) renderResumo();
    else render();
  });

  setInterval(() => {
    if (["orders", "deliveries"].includes(paginaAtual)) render();
  }, 30000);

  /* ---------- início ---------- */

  const opcoesCategoria = D.categorias.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join("");
  $("categoryFilter").insertAdjacentHTML("beforeend", opcoesCategoria);
  $("medicineCategory").innerHTML = opcoesCategoria;
  $("unitSelect").innerHTML = D.farmacias.map(f => `<option value="${f.id}">${esc(f.nome)} · ${esc(f.bairro)}</option>`).join("");

  pendentesConhecidos = new Set(pedidosDaUnidade().filter(p => p.status === "pendente").map(p => p.id));
  const inicial = location.hash.slice(1);
  if (["orders", "stock", "clients", "deliveries", "reports", "settings"].includes(inicial) && inicial !== "orders") abrirPagina(inicial);
  else render();
})();
