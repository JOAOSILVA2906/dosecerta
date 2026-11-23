// Funções de mapa usadas nas páginas (Leaflet + OpenStreetMap).
window.Mapa = (() => {
  "use strict";

  const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const CREDITOS = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

  const disponivel = () => typeof window.L !== "undefined";

  function criar(elemento, centro, zoom = 13) {
    if (!disponivel()) {
      elemento.classList.add("map-offline");
      elemento.innerHTML = '<p>Não foi possível carregar o mapa. Verifique sua conexão com a internet.</p>';
      return null;
    }
    const mapa = L.map(elemento, { zoomControl: false, scrollWheelZoom: false, attributionControl: true })
      .setView([centro.lat, centro.lng], zoom);
    L.control.zoom({ position: "bottomright" }).addTo(mapa);
    L.tileLayer(TILES, { attribution: CREDITOS, maxZoom: 19 }).addTo(mapa);
    mapa.attributionControl.setPrefix(false);
    // Rolagem do mouse só depois de clicar no mapa, para não atrapalhar a rolagem da página
    mapa.on("click", () => mapa.scrollWheelZoom.enable());
    mapa.on("mouseout", () => mapa.scrollWheelZoom.disable());
    return mapa;
  }

  function pino(tipo = "farmacia", destaque = false) {
    const simbolo = { farmacia: "i-store", casa: "i-home", moto: "i-truck" }[tipo] || "i-store";
    return L.divIcon({
      className: "",
      html: `<span class="map-pin ${tipo}${destaque ? " selected" : ""}"><svg aria-hidden="true"><use href="#${simbolo}"/></svg></span>`,
      iconSize: [38, 46],
      iconAnchor: [19, 44],
      tooltipAnchor: [0, -40]
    });
  }

  function pontoUsuario() {
    return L.divIcon({ className: "", html: '<span class="user-dot"></span>', iconSize: [22, 22], iconAnchor: [11, 11] });
  }

  // Leaflet precisa recalcular o tamanho quando o mapa estava escondido
  function ajustar(mapa) {
    if (!mapa) return;
    requestAnimationFrame(() => mapa.invalidateSize());
  }

  // Link de rota no Google Maps a partir da localização atual do aparelho
  const rota = destino => `https://www.google.com/maps/dir/?api=1&destination=${destino.lat},${destino.lng}`;

  return { disponivel, criar, pino, pontoUsuario, ajustar, rota };
})();
