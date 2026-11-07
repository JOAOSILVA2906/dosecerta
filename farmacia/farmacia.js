// Portal da farmacia: demonstracao local, sem conexao com o cliente.
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const STORAGE_KEY = "dose-certa-farmacia-v1";

  const statuses = {
    pending: "Confirmar disponibilidade",
    separating: "Em separação",
    ready: "Pronto para retirada",
    transit: "Em transporte",
    done: "Concluído"
  };

  const icon = name =>
    `<svg class="icon" aria-hidden="true"><use href="#${name}"/></svg>`;

  const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[char]));

  function seed() {
    const now = Date.now();
    return {
      settings: {
        name: "Farmácia Central",
        address: "Águas Claras, Brasília – DF"
      },
      medicines: [
        { id:1, name:"Losartana 50 mg", pack:"30 comprimidos", stock:75 },
        { id:2, name:"Metformina 850 mg", pack:"60 comprimidos", stock:48 },
        { id:3, name:"Omeprazol 20 mg", pack:"28 cápsulas", stock:32 },
        { id:4, name:"Paracetamol 750 mg", pack:"20 comprimidos", stock:320 },
        { id:5, name:"Amoxicilina 500 mg", pack:"21 cápsulas", stock:18 },
        { id:6, name:"Sinvastatina 20 mg", pack:"30 comprimidos", stock:0 }
      ],
      orders: [
        { id:7842, client:"M. Silva", region:"Águas Claras, Brasília – DF",
          medicineId:1, type:"delivery", status:"pending",
          created:now-5*60000, confirmed:null, completed:null },
        { id:7841, client:"A. Pereira", region:"Taguatinga, Brasília – DF",
          medicineId:2, type:"pickup", status:"separating",
          created:now-12*60000, confirmed:now-10*60000, completed:null },
        { id:7840, client:"R. Costa", region:"Arniqueiras, Brasília – DF",
          medicineId:3, type:"delivery", status:"transit",
          created:now-28*60000, confirmed:now-25*60000, completed:null }
      ]
    };
  }

  function validState(value) {
    if (!value || !value.settings || !Array.isArray(value.medicines) || !Array.isArray(value.orders)) return false;
    const text = (input, max) => typeof input === "string" && input.trim().length > 0 && input.length <= max;
    if (!text(value.settings.name, 70) || !text(value.settings.address, 180)) return false;
    const ids = new Set();
    if (!value.medicines.length || !value.medicines.every(medicine => {
      if (!medicine || !Number.isSafeInteger(medicine.id) || medicine.id < 1 || ids.has(medicine.id) ||
          !text(medicine.name,100) || !text(medicine.pack,100) || !Number.isInteger(medicine.stock) || medicine.stock < 0 || medicine.stock > 100000) return false;
      ids.add(medicine.id);
      return true;
    })) return false;
    const orderIds = new Set();
    return value.orders.every(order => {
      if (!order || !Number.isSafeInteger(order.id) || order.id < 1 || orderIds.has(order.id) || !ids.has(order.medicineId) ||
          !text(order.client,100) || !text(order.region,180) || !["delivery","pickup"].includes(order.type) ||
          !Object.hasOwn(statuses,order.status) || !Number.isFinite(order.created) ||
          !(order.confirmed === null || Number.isFinite(order.confirmed)) || !(order.completed === null || Number.isFinite(order.completed))) return false;
      orderIds.add(order.id);
      return true;
    });
  }

  let state;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!validState(saved)) {
      throw new Error("Sem dados válidos");
    }
    state = saved;
  } catch {
    state = seed();
  }

  let currentPage = "stock";
  let toastTimer;

  function toast(message) {
    $("toast").textContent = message;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").hidden = true, 4200);
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      toast("Alteração aplicada, mas o navegador não permitiu salvar permanentemente.");
      return false;
    }
  }

  function normalize(value) {
    return String(value).normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"").toLowerCase();
  }

  function query() {
    return normalize($("searchInput").value.trim());
  }

  function medicineFor(order) {
    return state.medicines.find(m => m.id === order.medicineId);
  }

  function matchesOrder(order) {
    const medicine = medicineFor(order);
    return normalize(`${order.id} DC-${order.id} ${order.client} ${medicine.name} ${order.region}`)
      .includes(query());
  }

  function elapsed(timestamp) {
    const minutes = Math.max(0, Math.floor((Date.now()-timestamp)/60000));
    if (minutes === 0) return "Agora";
    if (minutes < 60) return `Há ${minutes} min`;
    if (minutes < 1440) return `Há ${Math.floor(minutes/60)} h`;
    return new Date(timestamp).toLocaleDateString("pt-BR");
  }

  function stockStatus(quantity) {
    if (quantity === 0) return { text:"Sem estoque", cls:"empty" };
    if (quantity <= 20) return { text:"Estoque baixo", cls:"low" };
    return { text:"Em estoque", cls:"good" };
  }

  function todayOrders() {
    const day = timestamp => new Date(timestamp).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const today = day(Date.now());
    return state.orders.filter(order => day(order.created) === today);
  }

  function openPage(page) {
    const target = $(page);
    if (!target || !target.classList.contains("page")) return;
    currentPage = page;
    document.querySelectorAll(".page").forEach(section =>
      section.classList.toggle("active", section.id === page)
    );
    document.querySelectorAll("[data-page]").forEach(button => {
      const active = button.dataset.page === page;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    $("searchInput").placeholder = page === "stock" ? "Buscar medicamento no seu estoque..." : "Buscar pedido, cliente ou medicamento...";
    render();
    const heading = target.querySelector("h1");
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    window.scrollTo({top:0, behavior:"auto"});
  }

  function orderCard(order) {
    const medicine = medicineFor(order);
    let action = "";
    if (order.status === "pending") action = "Confirmar disponibilidade";
    if (order.status === "separating") {
      action = order.type === "delivery" ? "Despachar entrega" : "Liberar para retirada";
    }
    if (order.status === "transit") action = "Confirmar entrega";
    if (order.status === "ready") action = "Confirmar retirada";

    const fulfillment = order.type === "delivery"
      ? (order.status === "transit" ? "Saiu para entrega" : "Entrega em domicílio")
      : "Retirada na farmácia";

    return `
      <article class="order ${order.status === "pending" ? "new" : ""}">
        <div class="order-top">
          <span class="order-id">#DC-${order.id}</span>
          <span class="badge ${order.status}">${statuses[order.status]}</span>
          <span class="time">${elapsed(order.created)}</span>
        </div>
        <div class="order-body">
          <div class="product-art"><span class="capsule"></span></div>
          <div class="person">
            <div class="avatar">${escapeHTML(order.client.charAt(0))}</div>
            <div>
              <strong>${escapeHTML(order.client)}</strong>
              <p>${escapeHTML(medicine.name)}</p>
              <p class="muted small">${escapeHTML(medicine.pack)} · 1 caixa</p>
            </div>
          </div>
          <div class="fulfillment">
            <strong>${fulfillment}</strong>
            <span class="muted">${order.type === "delivery"
              ? escapeHTML(order.region) : "Cliente retira no balcão"}</span>
          </div>
          ${action
            ? `<button class="btn order-action" data-advance="${order.id}">${action}</button>`
            : `<span class="good small">✓ Pedido concluído</span>`}
        </div>
      </article>`;
  }

  function renderOrders() {
    const status = $("statusFilter").value;
    const type = $("typeFilter").value;
    const orders = state.orders.filter(o =>
      matchesOrder(o) &&
      (!status || o.status === status) &&
      (!type || o.type === type)
    );
    $("orderList").innerHTML = orders.length
      ? orders.map(orderCard).join("")
      : '<div class="panel empty-state">Nenhum pedido encontrado para esta busca.</div>';
  }

  function renderSummary() {
    $("today").textContent = new Date().toLocaleDateString("pt-BR", {
      day:"numeric", month:"long", year:"numeric", timeZone:"America/Sao_Paulo"
    });
    const orders = todayOrders();
    const completed = orders.filter(o => o.completed);
    const average = completed.length
      ? Math.round(completed.reduce((sum,o) => sum+(o.completed-o.created),0)
        / completed.length / 60000)
      : null;

    const stats = [
      ["cart","Pedidos recebidos",orders.length],
      ["check","Pedidos confirmados",orders.filter(o => o.confirmed).length],
      ["truck","Entregas concluídas",orders.filter(o => o.type === "delivery" && o.status === "done").length],
      ["clock","Tempo médio até conclusão",average === null ? "—" : `${average} min`]
    ];
    $("summaryStats").innerHTML = stats.map(([symbol,label,value]) => `
      <div class="stat">
        <div class="stat-icon">${icon(symbol)}</div>
        <div><span>${label}</span><strong>${value}</strong></div>
      </div>`).join("");

    $("stockPreview").innerHTML = [...state.medicines].sort((a,b) => a.stock - b.stock).slice(0,3).map(m => {
      const status = stockStatus(m.stock);
      return `<div class="stock-item">
        <div class="product-art"><span class="capsule"></span></div>
        <div><p>${escapeHTML(m.name)}</p><p class="${status.cls}">${status.text}</p></div>
        <span class="stock-count">${m.stock} cx.</span>
      </div>`;
    }).join("");
  }

  function renderStock() {
    const filter = $("stockFilter").value;
    const terms = query().split(/\s+/).filter(Boolean);
    const medicines = state.medicines.filter(medicine =>
      terms.every(term => normalize(`${medicine.name} ${medicine.pack}`).includes(term)) &&
      (!filter || stockStatus(medicine.stock).cls === filter)
    );
    $("stockResultCount").textContent = `${medicines.length} de ${state.medicines.length} medicamentos no catálogo`;
    const metrics = [
      ["box", "Itens no catálogo", state.medicines.length, "", "Ver todos os medicamentos"],
      ["cart", "Caixas disponíveis", state.medicines.reduce((sum,m) => sum+m.stock,0), "", "Total disponível no painel"],
      ["clock", "Estoque baixo", state.medicines.filter(m => m.stock > 0 && m.stock <= 20).length, "low", "De 1 a 20 caixas"],
      ["box", "Sem estoque", state.medicines.filter(m => m.stock === 0).length, "empty", "Itens para reposição"]
    ];
    $("inventoryMetrics").innerHTML = metrics.map(([symbol,label,value,filter,hint]) =>
      `<button class="inventory-metric ${filter === "low" ? "warn" : ""}" data-stock-filter="${filter}" aria-label="${label}: ${value}. ${hint}"><span class="metric-icon">${icon(symbol)}</span><span>${label}</span><strong>${value.toLocaleString("pt-BR")}</strong><small>${hint}</small></button>`
    ).join("");
    $("stockTable").innerHTML = medicines.length ? medicines.map(m => {
      const status = stockStatus(m.stock);
      return `<tr>
        <td><div class="stock-product"><div class="product-art" aria-hidden="true"><span class="capsule"></span></div><strong>${escapeHTML(m.name)}</strong></div></td>
        <td>${escapeHTML(m.pack)}</td>
        <td><span class="stock-status ${status.cls}">${status.text}</span></td>
        <td><input class="field" type="number" min="0" max="100000" step="1"
          id="stock-${m.id}" value="${m.stock}"
          aria-label="Quantidade de ${escapeHTML(m.name)}"></td>
        <td><button class="btn light" data-save-stock="${m.id}" aria-label="Salvar estoque de ${escapeHTML(m.name)}">Salvar</button></td>
      </tr>`;
    }).join("") : '<tr><td colspan="5" class="empty-state">Nenhum medicamento encontrado.</td></tr>';
  }

  function renderClients() {
    const clients = new Map();
    state.orders.forEach(order => {
      if (!clients.has(order.client)) clients.set(order.client, []);
      clients.get(order.client).push(order);
    });
    const rows = [...clients.entries()].filter(([name,orders]) =>
      normalize(`${name} ${orders[0].region}`).includes(query())
    );
    $("clientsTable").innerHTML = rows.length ? rows.map(([name,orders]) => `
      <tr>
        <td><strong>${escapeHTML(name)}</strong></td>
        <td>${escapeHTML(orders[0].region)}</td>
        <td>${orders.length}</td>
        <td>#DC-${orders[0].id}</td>
      </tr>`).join("")
      : '<tr><td colspan="4" class="empty-state">Nenhum cliente encontrado.</td></tr>';
  }

  function renderDeliveries() {
    const orders = state.orders.filter(o => o.type === "delivery" && matchesOrder(o));
    $("deliveryList").innerHTML = orders.length ? orders.map(orderCard).join("")
      : '<div class="panel empty-state">Nenhuma entrega encontrada.</div>';
  }

  function renderReports() {
    const orders = todayOrders();
    const completed = orders.filter(o => o.status === "done").length;
    const rate = orders.length ? Math.round(completed/orders.length*100) : 0;

    $("reportMetrics").innerHTML = [
      ["Pedidos do dia",orders.length],
      ["Concluídos",completed],
      ["Taxa de conclusão",`${rate}%`]
    ].map(([label,value]) =>
      `<div class="panel metric"><span class="muted">${label}</span><strong>${value}</strong></div>`
    ).join("");

    $("reportBars").innerHTML = Object.entries(statuses).map(([key,label]) => {
      const count = orders.filter(o => o.status === key).length;
      const width = orders.length ? count/orders.length*100 : 0;
      return `<div class="report-line">
        <span>${label}</span>
        <div class="bar"><span style="width:${width}%"></span></div>
        <strong>${count}</strong>
      </div>`;
    }).join("");
  }

  function render() {
    $("profileName").textContent = state.settings.name;
    renderSummary();
    if (currentPage === "orders") renderOrders();
    if (currentPage === "stock") renderStock();
    if (currentPage === "clients") renderClients();
    if (currentPage === "deliveries") renderDeliveries();
    if (currentPage === "reports") renderReports();
    if (currentPage === "settings") {
      $("storeName").value = state.settings.name;
      $("storeAddress").value = state.settings.address;
    }
  }

  function advanceOrder(id) {
    const order = state.orders.find(o => o.id === id);
    if (!order || order.status === "done") return;
    const medicine = medicineFor(order);

    if (order.status === "pending") {
      if (medicine.stock < 1) {
        toast("Medicamento sem estoque. Atualize o estoque antes de confirmar.");
        return;
      }
      medicine.stock--;
      order.status = "separating";
      order.confirmed = Date.now();
    } else if (order.status === "separating") {
      order.status = order.type === "delivery" ? "transit" : "ready";
    } else {
      order.status = "done";
      order.completed = Date.now();
    }

    const saved = persist();
    render();
    if (saved) toast(`Pedido #DC-${id}: ${statuses[order.status]}.`);
  }

  document.addEventListener("click", event => {
    const stockFilter = event.target.closest("[data-stock-filter]");
    if (stockFilter) {
      $("stockFilter").value = stockFilter.dataset.stockFilter;
      renderStock();
      $("stockFilter").focus({ preventScroll: true });
    }
    const nav = event.target.closest("[data-page],[data-open]");
    if (nav) {
      $("searchInput").value = "";
      openPage(nav.dataset.page || nav.dataset.open);
    }

    const advance = event.target.closest("[data-advance]");
    if (advance) advanceOrder(Number(advance.dataset.advance));

    const save = event.target.closest("[data-save-stock]");
    if (save) {
      const id = Number(save.dataset.saveStock);
      const input = $(`stock-${id}`);
      const value = Number(input.value);
      if (input.value.trim() === "" || !Number.isInteger(value) ||
          value < 0 || value > 100000) {
        toast("Informe uma quantidade inteira entre 0 e 100.000.");
        return;
      }
      state.medicines.find(m => m.id === id).stock = value;
      const saved = persist();
      render();
      if (saved) toast(value === 0 ? "Medicamento marcado como sem estoque." : "Estoque atualizado.");
      const nextInput = $(`stock-${id}`);
      if (nextInput) nextInput.focus({ preventScroll: true });
      else $("stockFilter").focus({ preventScroll: true });
    }
  });

  $("searchInput").addEventListener("input", () => {
    if (["reports","settings"].includes(currentPage)) openPage("orders");
    else render();
    $("searchInput").focus({ preventScroll: true });
  });

  $("filterToggle").onclick = () => {
    $("filters").hidden = !$("filters").hidden;
    $("filterToggle").setAttribute("aria-expanded", String(!$("filters").hidden));
  };

  $("statusFilter").onchange = renderOrders;
  $("typeFilter").onchange = renderOrders;

  $("clearFilters").onclick = () => {
    $("statusFilter").value = "";
    $("typeFilter").value = "";
    $("searchInput").value = "";
    renderOrders();
  };

  $("simulateOrder").onclick = () => {
    const people = [
      ["J. Almeida","Águas Claras, Brasília – DF"],
      ["L. Santos","Guará, Brasília – DF"],
      ["P. Oliveira","Taguatinga, Brasília – DF"],
      ["C. Souza","Arniqueiras, Brasília – DF"]
    ];
    const person = people[Math.floor(Math.random()*people.length)];
    const medicine = state.medicines[Math.floor(Math.random()*state.medicines.length)];
    const id = Math.max(7842,...state.orders.map(o => o.id))+1;
    state.orders.unshift({
      id, client:person[0], region:person[1], medicineId:medicine.id,
      type:Math.random() > .4 ? "delivery" : "pickup",
      status:"pending", created:Date.now(), confirmed:null, completed:null
    });
    $("searchInput").value = "";
    $("statusFilter").value = "";
    $("typeFilter").value = "";
    const saved = persist();
    render();
    if (saved) toast(`Novo pedido demonstrativo #DC-${id} recebido.`);
  };

  $("settingsForm").onsubmit = event => {
    event.preventDefault();
    const name = $("storeName").value.trim();
    const address = $("storeAddress").value.trim();
    if (!name || !address) {
      toast("Preencha o nome e o endereço.");
      return;
    }
    state.settings = { name, address };
    const saved = persist();
    render();
    if (saved) toast("Configurações salvas.");
  };

  $("resetDemo").onclick = () => {
    if (!confirm("Apagar as alterações e reiniciar os dados demonstrativos?")) return;
    state = seed();
    $("searchInput").value = "";
    $("statusFilter").value = "";
    $("typeFilter").value = "";
    const saved = persist();
    $("stockFilter").value = "";
    openPage("stock");
    if (saved) toast("Demonstração reiniciada.");
  };

  $("printReport").onclick = () => window.print();

  $("exportCSV").onclick = () => {
    const rows = [
      ["Pedido","Cliente","Medicamento","Recebimento","Status","Data"],
      ...todayOrders().map(o => [
        `DC-${o.id}`,o.client,medicineFor(o).name,
        o.type === "delivery" ? "Entrega" : "Retirada",
        statuses[o.status],new Date(o.created).toLocaleString("pt-BR")
      ])
    ];
    const csv = "\uFEFF" + rows.map(row => row.map(value =>
      `"${String(value).replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g,'""')}"`
    ).join(";")).join("\r\n");

    const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dose-certa-relatorio.csv";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Relatório CSV gerado.");
  };


  $("stockFilter").onchange = renderStock;
  $("addMedicine").onclick = () => {
    $("medicineForm").reset();
    $("medicineError").textContent = "";
    $("medicineDialog").showModal();
  };
  $("closeMedicine").onclick = $("cancelMedicine").onclick = () => $("medicineDialog").close();
  $("medicineForm").onsubmit = event => {
    event.preventDefault();
    if (!$("medicineForm").reportValidity()) return;
    const name = $("medicineName").value.trim().replace(/\s+/g," ");
    const pack = $("medicinePack").value.trim().replace(/\s+/g," ");
    const stock = Number($("medicineQuantity").value);
    if (!name || !pack || !Number.isInteger(stock) || stock < 0 || stock > 100000) {
      $("medicineError").textContent = "Preencha o nome, a apresentação e uma quantidade inteira entre 0 e 100.000.";
      return;
    }
    if (state.medicines.some(m => normalize(m.name) === normalize(name) && normalize(m.pack) === normalize(pack))) {
      $("medicineError").textContent = "Este medicamento e apresentação já estão cadastrados. Atualize a quantidade na lista.";
      return;
    }
    const id = Math.max(0,...state.medicines.map(m => m.id)) + 1;
    state.medicines.push({ id, name, pack, stock });
    $("searchInput").value = "";
    $("stockFilter").value = "";
    const saved = persist();
    $("medicineDialog").close();
    render();
    if (saved) toast("Medicamento cadastrado no estoque.");
  };
  $("searchInput").placeholder = "Buscar medicamento no seu estoque...";
  render();
})();
