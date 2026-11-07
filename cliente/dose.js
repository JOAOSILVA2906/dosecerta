// Dose Certa: demonstracao local, sem dependencias externas.
(() => {
  "use strict";

  // Keep DOM references and application state private to this script.
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, document.getElementById(id));
    return elements.get(id);
  };
  const screens = [...document.querySelectorAll(".screen")];
  const navigationButtons = [...document.querySelectorAll("[data-nav]")];

  const medicines = [
    { id: 1, name: "Losartana 50 mg" },
    { id: 2, name: "Paracetamol 500 mg" },
    { id: 3, name: "Dipirona 500 mg" },
    { id: 4, name: "Ibuprofeno 400 mg" },
    { id: 5, name: "Loratadina 10 mg" }
  ];

  const pharmacies = [
    { id: 1, name: "Farmácia Central", distance: "1,9 km",
      address: "Águas Claras, Brasília • endereço ilustrativo", x: 69, y: 28 },
    { id: 2, name: "Farmácia Bem Estar", distance: "2,1 km",
      address: "Taguatinga, Brasília • endereço ilustrativo", x: 29, y: 17 },
    { id: 3, name: "Farmácia Vida", distance: "3,4 km",
      address: "Arniqueiras, Brasília • endereço ilustrativo", x: 15, y: 61 },
    { id: 4, name: "Farmácia Popular do Bairro", distance: "4,8 km",
      address: "Vicente Pires, Brasília • endereço ilustrativo", x: 84, y: 63 }
  ];

  let selectedMedicine = medicines[0];
  let selectedPharmacy = pharmacies[0];
  let currentScreen = "auth";
  let sessionUser = null;
  let authMode = "login";
  const accounts = new Map();
  let screenHistory = [];
  const orders = [];
  let activeOrder = null;
  let nextOrderNumber = 1001;

  const icon = name =>
    `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  function showScreen(id, remember = true) {
    if (!sessionUser && id !== "auth") return;
    const screen = $(id);
    if (!screen || !screen.classList.contains("screen")) return;
    if (remember && currentScreen !== id) screenHistory.push(currentScreen);
    if (id === "mapScreen") renderMap();
    if (id === "orders") renderOrders();
    if (id === "tracking") renderTracking();
    if (id === "notifications") renderNotifications();
    const isAuth = id === "auth";
    document.querySelector(".app").classList.toggle("auth-mode", isAuth);
    $("mainNav").hidden = isAuth;
    $("headerActions").hidden = isAuth;
    $("demoFooter").hidden = isAuth;
    currentScreen = id;

    screens.forEach(section =>
      section.classList.toggle("active", section.id === id)
    );

    $("back").hidden = screenHistory.length === 0;

    const navId = ["detail", "receive"].includes(id) ? "mapScreen"
      : id === "tracking" ? "orders" : id;

    navigationButtons.forEach(button => {
      const active = button.dataset.nav === navId;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });

    const heading = screen.querySelector("h1, h2");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }

    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function normalize(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function renderMedicines() {
    const query = normalize($("searchInput").value.trim());
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = medicines.filter(medicine => {
      const name = normalize(medicine.name);
      return terms.every(term => name.includes(term));
    });
    $("results").replaceChildren();

    if (!matches.length) {
      $("results").innerHTML =
        '<p class="muted">Nenhum medicamento encontrado no catálogo demonstrativo.</p>';
      return;
    }

    matches.forEach(medicine => {
      const button = document.createElement("button");
      button.className = "row";
      button.innerHTML = `
        <span class="pill-box"><span class="pill"></span></span>
        <span class="text">
          <strong>${medicine.name}</strong>
          <span class="muted small">Comprimido</span>
        </span>
        <span class="chevron">›</span>`;

      button.onclick = () => {
        selectedMedicine = medicine;
        showScreen("mapScreen");
      };

      $("results").append(button);
    });
  }

  function renderMap() {
    $("mapMedicine").textContent = selectedMedicine.name;
    $("pharmacyList").replaceChildren();
    document.querySelectorAll(".pin").forEach(pin => pin.remove());

    pharmacies.forEach(pharmacy => {
      const pin = document.createElement("button");
      pin.className = "pin" + (pharmacy.id === selectedPharmacy.id ? " selected" : "");
      pin.style.left = pharmacy.x + "%";
      pin.style.top = pharmacy.y + "%";
      pin.setAttribute("aria-label", `${pharmacy.name}, ${pharmacy.distance}`);
      pin.innerHTML = icon("pin");
      pin.onclick = () => openPharmacy(pharmacy);
      $("map").append(pin);

      const row = document.createElement("button");
      row.className = "row";
      row.innerHTML = `
        ${icon("pin")}
        <span class="text">
          <strong class="pharmacy-row-name">${pharmacy.name}</strong>
          <span class="muted small">${pharmacy.distance}</span>
        </span>
        <span class="badge">Disponível</span>
        <span class="chevron">›</span>`;
      row.onclick = () => openPharmacy(pharmacy);
      $("pharmacyList").append(row);
    });
  }

  function openPharmacy(pharmacy) {
    selectedPharmacy = pharmacy;
    $("pharmacyName").textContent = pharmacy.name;
    $("pharmacyAddress").textContent = pharmacy.address;
    $("detailMedicine").textContent = selectedMedicine.name;
    $("distance").textContent = pharmacy.distance;
    showScreen("detail");
  }

  function stages(order) {
    return order.type === "delivery"
      ? ["Pedido recebido", "Em separação", "Em transporte", "Entrega confirmada"]
      : ["Pedido recebido", "Em separação", "Pronto para retirada", "Retirada confirmada"];
  }

  function createOrder(type, address = "") {
    activeOrder = {
      number: nextOrderNumber++,
      medicine: selectedMedicine.name,
      pharmacy: selectedPharmacy.name,
      type,
      address,
      stage: 0
    };

    orders.unshift(activeOrder);
    $("notificationDot").hidden = false;
    screenHistory = [];
    showScreen("tracking", false);
    $("deliveryForm").reset();
    $("deliveryForm").hidden = true;
    $("delivery").setAttribute("aria-expanded", "false");
  }

  function renderTracking() {
    if (!activeOrder) return;

    const labels = stages(activeOrder);
    $("trackingTitle").textContent = labels[activeOrder.stage];
    $("orderNumber").textContent = `Pedido demonstrativo #${activeOrder.number}`;

    $("timeline").innerHTML = labels.map((label, index) => `
      <div class="step ${index <= activeOrder.stage ? "done" : ""}">
        <span class="dot">${index <= activeOrder.stage ? "✓" : "·"}</span>
        <span>${index === activeOrder.stage ? `<strong>${label}</strong>` : label}</span>
      </div>
    `).join("");

    // textContent mantém o endereço digitado como texto.
    $("orderSummary").replaceChildren();
    [
      activeOrder.medicine,
      activeOrder.pharmacy,
      activeOrder.type === "delivery"
        ? `Entrega: ${activeOrder.address}`
        : "Retirada na farmácia"
    ].forEach((text, index) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      if (index > 0) paragraph.className = "small muted";
      $("orderSummary").append(paragraph);
    });

    $("advance").hidden = activeOrder.stage === labels.length - 1;
    if ($("advance").hidden && document.activeElement === $("advance")) {
      $("trackingTitle").focus({ preventScroll: true });
    }
  }

  function renderOrders() {
    $("ordersList").replaceChildren();

    if (!orders.length) {
      $("ordersList").innerHTML =
        '<p class="muted">Você ainda não tem pedidos simulados. Busque um medicamento para começar.</p>';
      return;
    }

    orders.forEach(order => {
      const button = document.createElement("button");
      button.className = "row";
      button.innerHTML = `
        ${icon("order")}
        <span class="text">
          <strong>${order.medicine}</strong>
          <span class="small muted">#${order.number} • ${stages(order)[order.stage]}</span>
        </span>
        <span class="chevron">›</span>`;
      button.onclick = () => {
        activeOrder = order;
        showScreen("tracking");
      };
      $("ordersList").append(button);
    });
  }

  $("searchInput").addEventListener("input", renderMedicines);

  $("clearSearch").onclick = () => {
    $("searchInput").value = "";
    renderMedicines();
    $("searchInput").focus();
  };

  $("back").onclick = () => {
    const previous = screenHistory.pop();
    if (previous) showScreen(previous, false);
  };

  $("continue").onclick = () => {
    $("deliveryForm").hidden = true;
    $("delivery").setAttribute("aria-expanded", "false");
    showScreen("receive");
  };

  $("pickup").onclick = () => createOrder("pickup");

  $("delivery").onclick = () => {
    $("deliveryForm").hidden = false;
    $("delivery").setAttribute("aria-expanded", "true");
    $("address").focus();
    $("deliveryForm").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
  };

  $("deliveryForm").onsubmit = event => {
    event.preventDefault();

    if (!$("deliveryForm").reportValidity()) return;
    const address = $("address").value.trim();
    if (!address) {
      $("address").setCustomValidity("Informe o endereço de entrega.");
      $("address").reportValidity();
      return;
    }

    const complement = $("complement").value.trim();
    createOrder("delivery", address + (complement ? ` — ${complement}` : ""));
  };

  $("address").oninput = () => $("address").setCustomValidity("");

  $("advance").onclick = () => {
    if (activeOrder && activeOrder.stage < stages(activeOrder).length - 1) {
      activeOrder.stage++;
      renderTracking();
    }
  };

  $("newSearch").onclick = () => {
    screenHistory = [];
    showScreen("home", false);
  };

  navigationButtons.forEach(button => {
    button.onclick = () => {
      const target = button.dataset.nav;
      screenHistory = [];
      showScreen(target, false);
    };
  });


  // Demo accounts live only in memory; passwords are never persisted.
  async function passwordDigest(password) {
    const data = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function setAuthMode(mode) {
    authMode = mode;
    const registering = mode === "register";
    $("nameGroup").hidden = !registering;
    $("confirmGroup").hidden = !registering;
    $("authName").required = registering;
    $("confirmPassword").required = registering;
    $("forgotPassword").hidden = registering;
    $("authPassword").autocomplete = registering ? "new-password" : "current-password";
    $("authPassword").type = "password";
    $("togglePassword").setAttribute("aria-pressed", "false");
    $("togglePassword").setAttribute("aria-label", "Mostrar senha");
    $("authPassword").value = "";
    $("confirmPassword").value = "";
    $("authTitle").textContent = registering ? "Seu cuidado começa aqui." : "Que bom ter você aqui.";
    $("authSubtitle").textContent = registering ? "Crie seu perfil para explorar a demonstração." : "Entre para acompanhar seu cuidado.";
    $("authSubmit").textContent = registering ? "Criar minha conta demo →" : "Entrar na minha conta →";
    $("authMessage").textContent = "";
    for (const [id, active] of [["loginTab", !registering], ["registerTab", registering]]) {
      $(id).classList.toggle("selected", active);
      $(id).setAttribute("aria-pressed", String(active));
    }
  }

  function enterApp(user) {
    sessionUser = user;
    const firstName = user.name.split(/\s+/)[0];
    $("greeting").textContent = `Olá, ${firstName} ✦`;
    $("profileName").textContent = user.name;
    $("profileEmail").textContent = user.email || "Explore o Dose Certa no seu ritmo.";
    $("profileAvatar").textContent = user.name.charAt(0).toUpperCase();
    $("profileButton").textContent = user.name.charAt(0).toUpperCase();
    $("authForm").reset();
    screenHistory = [];
    showScreen("home", false);
  }

  function renderNotifications() {
    $("notificationsList").replaceChildren();
    $("notificationDot").hidden = true;
    if (!orders.length) {
      $("notificationsList").innerHTML = `<div class="empty-state">${icon("bell")}<h2>Tudo em dia por aqui.</h2><p>As atualizações dos seus pedidos simulados aparecem neste espaço.</p></div>`;
      return;
    }
    orders.forEach(order => {
      const row = document.createElement("button");
      row.className = "row";
      row.innerHTML = `${icon("order")}<span class="text"><strong>Pedido #${order.number}</strong><span class="small muted">${stages(order)[order.stage]}</span></span><span class="chevron">›</span>`;
      row.onclick = () => { activeOrder = order; showScreen("tracking"); };
      $("notificationsList").append(row);
    });
  }

  $("loginTab").onclick = () => setAuthMode("login");
  $("registerTab").onclick = () => setAuthMode("register");
  $("togglePassword").onclick = () => {
    const visible = $("authPassword").type === "password";
    $("authPassword").type = visible ? "text" : "password";
    $("togglePassword").setAttribute("aria-label", visible ? "Ocultar senha" : "Mostrar senha");
    $("togglePassword").setAttribute("aria-pressed", String(visible));
  };
  $("forgotPassword").onclick = () => {
    $("authMessage").textContent = "Nesta demonstração não enviamos e-mails de recuperação. Use demo@dosecerta.app com a senha Dose1234 ou crie outro perfil fictício.";
  };
  $("authForm").onsubmit = async event => {
    event.preventDefault();
    if (!$("authForm").reportValidity()) return;
    const email = $("authEmail").value.trim().toLowerCase();
    const password = $("authPassword").value;
    const name = $("authName").value.trim().replace(/\s+/g, " ");
    $("authMessage").textContent = "";
    if (authMode === "register" && name.length < 2) {
      $("authMessage").textContent = "Informe um nome com pelo menos 2 caracteres.";
      $("authName").focus();
      return;
    }
    if (authMode === "register" && password !== $("confirmPassword").value) {
      $("authMessage").textContent = "As senhas precisam ser iguais.";
      $("confirmPassword").focus();
      return;
    }
    const submittingMode = authMode;
    $("loginTab").disabled = true;
    $("registerTab").disabled = true;
    $("guestAccess").disabled = true;
    $("authSubmit").disabled = true;
    $("authForm").setAttribute("aria-busy", "true");
    try {
      const hash = await passwordDigest(password);
      if (submittingMode === "register") {
        if (email === "demo@dosecerta.app" || accounts.has(email)) {
          $("authMessage").textContent = "Este e-mail já tem um perfil nesta demonstração. Use a aba Entrar.";
          return;
        }
        accounts.set(email, { name, email, hash });
        enterApp({ name, email });
      } else {
        const account = accounts.get(email);
        const isDemo = email === "demo@dosecerta.app" && hash === await passwordDigest("Dose1234");
        if (isDemo) enterApp({ name: "Alex", email });
        else if (account && account.hash === hash) enterApp({ name: account.name, email });
        else $("authMessage").textContent = "E-mail ou senha não conferem. Use a conta demo ou cadastre um perfil fictício.";
      }
    } catch {
      $("authMessage").textContent = "Não foi possível iniciar o acesso neste navegador. Você pode continuar como visitante.";
    } finally {
      $("authSubmit").disabled = false;
      $("loginTab").disabled = false;
      $("registerTab").disabled = false;
      $("guestAccess").disabled = false;
      $("authForm").removeAttribute("aria-busy");
    }
  };
  $("guestAccess").onclick = () => enterApp({ name: "Visitante", email: "" });
  $("profileButton").onclick = () => showScreen("profile");
  $("notificationsButton").onclick = () => showScreen("notifications");
  $("profileOrders").onclick = $("notificationOrders").onclick = () => showScreen("orders");
  $("signOut").onclick = () => {
    sessionUser = null;
    orders.length = 0;
    activeOrder = null;
    nextOrderNumber = 1001;
    screenHistory = [];
    $("deliveryForm").reset();
    $("deliveryForm").hidden = true;
    $("delivery").setAttribute("aria-expanded", "false");
    $("address").setCustomValidity("");
    $("notificationDot").hidden = true;
    $("authForm").reset();
    setAuthMode("login");
    showScreen("auth", false);
  };
  document.querySelectorAll("[data-shortcut]").forEach(button => {
    button.onclick = () => showScreen(button.dataset.shortcut);
  });

  renderMedicines();
})();
