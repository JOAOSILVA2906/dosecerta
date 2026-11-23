// Página inicial: números do catálogo e mapa das farmácias parceiras.
(() => {
  "use strict";

  const D = window.DoseCerta;
  const esc = D.escapar;

  document.getElementById("countMedicines").textContent = D.catalogo().length;
  document.getElementById("countPharmacies").textContent = D.farmacias.length;

  document.getElementById("pharmacyList").innerHTML = D.farmacias.map(f => `
    <li>
      <strong>${esc(f.nome)}</strong>
      <span>${esc(f.bairro)} · <span class="${D.aberta(f) ? "open" : "closed"}">${D.textoHorario(f)}</span></span>
    </li>`).join("");

  const mapa = Mapa.criar(document.getElementById("homeMap"), D.LOCAL_PADRAO, 11);
  if (!mapa) return;
  const pontos = D.farmacias.map(f => {
    L.marker([f.lat, f.lng], { icon: Mapa.pino("farmacia"), title: f.nome })
      .bindTooltip(`<strong>${esc(f.nome)}</strong><br>${esc(f.endereco)} · ${esc(f.bairro)}<br>${D.textoHorario(f)}`, { direction: "top" })
      .addTo(mapa);
    return [f.lat, f.lng];
  });
  mapa.fitBounds(pontos, { padding: [40, 40] });
})();
