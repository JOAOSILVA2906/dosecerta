// Regras de negócio do Dose Certa. O servidor e o navegador usam este mesmo arquivo,
// então preço, frete, horário e etapas do pedido são calculados do mesmo jeito nos dois lados.
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.Regras = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const RAIO_ENTREGA = 12; // km
  const FRETE_GRATIS = 80; // R$
  const MAX_POR_ITEM = 10;
  const FUSO = "America/Sao_Paulo";

  // Tempo (ms) que cada etapa leva quando a farmácia não age antes (pedidos feitos pelo app)
  const DURACAO = { pendente: 45000, separacao: 30000, transporte: 70000, pronto: 60000 };

  const ETAPAS = {
    entrega: ["pendente", "separacao", "transporte", "concluido"],
    retirada: ["pendente", "separacao", "pronto", "concluido"]
  };
  const STATUS = ["pendente", "separacao", "pronto", "transporte", "concluido", "cancelado"];
  const PAGAMENTOS = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro" };

  /* ---------- utilitários ---------- */

  const normalizar = texto => String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const paraReais = centavos => Math.round(centavos) / 100;

  // Distância em linha reta (fórmula de Haversine)
  function distanciaKm(a, b) {
    const rad = graus => graus * Math.PI / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  /* ---------- preço e frete ---------- */

  // Preço final terminando em 9 centavos, como no varejo
  function precoCentavos(med, farm) {
    const centavos = Math.round(med.preco * farm.fator * 100);
    return Math.ceil(centavos / 10) * 10 - 1;
  }
  const preco = (med, farm) => paraReais(precoCentavos(med, farm));

  function taxaCentavos(distancia, subtotalCentavos) {
    if (subtotalCentavos >= FRETE_GRATIS * 100) return 0;
    const valor = 3.9 + Math.max(0, distancia - 2) * 1.1;
    return Math.min(1599, Math.ceil(valor) * 100 - 1);
  }
  const taxaEntrega = (distancia, subtotal = 0) => paraReais(taxaCentavos(distancia, Math.round(subtotal * 100)));
  const prazoEntrega = distancia => Math.round(30 + distancia * 3);

  /* ---------- horário (sempre no fuso de Brasília) ---------- */

  const formatoHora = new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  function minutosEmBrasilia(data = new Date()) {
    const partes = Object.fromEntries(formatoHora.formatToParts(data).map(p => [p.type, p.value]));
    return Number(partes.hour) * 60 + Number(partes.minute);
  }

  const minutosDoTexto = texto => {
    const [h, m] = texto.split(":").map(Number);
    return h * 60 + m;
  };

  function aberta(farm, data = new Date()) {
    if (!farm.horario) return true;
    const agora = minutosEmBrasilia(data);
    return agora >= minutosDoTexto(farm.horario.abre) && agora < minutosDoTexto(farm.horario.fecha);
  }

  function textoHorario(farm, data = new Date()) {
    if (!farm.horario) return "Aberta 24 horas";
    return aberta(farm, data) ? `Aberta até ${farm.horario.fecha}` : `Fechada · abre às ${farm.horario.abre}`;
  }

  /* ---------- estoque ---------- */

  function situacaoEstoque(quantidade) {
    if (quantidade === 0) return { texto: "Sem estoque", cls: "empty" };
    if (quantidade <= 20) return { texto: "Estoque baixo", cls: "low" };
    return { texto: "Em estoque", cls: "good" };
  }

  /* ---------- pedidos ---------- */

  function rotulo(pedido, status = pedido.status) {
    return {
      pendente: "Aguardando confirmação",
      separacao: "Em separação",
      pronto: "Pronto para retirada",
      transporte: "Saiu para entrega",
      concluido: pedido.tipo === "entrega" ? "Pedido entregue" : "Pedido retirado",
      cancelado: "Pedido cancelado"
    }[status];
  }

  const etapas = pedido => ETAPAS[pedido.tipo];

  // Próxima etapa do pedido, ou null se ele já terminou
  function proximoStatus(pedido) {
    if (pedido.status === "pendente") return "separacao";
    if (pedido.status === "separacao") return pedido.tipo === "entrega" ? "transporte" : "pronto";
    if (pedido.status === "transporte" || pedido.status === "pronto") return "concluido";
    return null;
  }

  function progressoEntrega(pedido, agora = Date.now()) {
    if (pedido.status === "concluido") return 1;
    if (pedido.status !== "transporte") return 0;
    return Math.min(1, (agora - pedido.historico.transporte) / DURACAO.transporte);
  }

  function previsao(pedido) {
    if (["concluido", "cancelado"].includes(pedido.status)) return null;
    return pedido.criado + (pedido.tipo === "entrega" ? (pedido.prazo || 45) : 30) * 60000;
  }

  const gerarCodigoRetirada = aleatorio => String(1000 + Math.floor(aleatorio() * 9000));

  /**
   * Monta um pedido a partir do que o cliente enviou (já validado por Validacao.pedido).
   * Preço, frete e total são sempre calculados aqui, nunca aceitos do cliente.
   * ctx: { farmacia, medicamento(id), estoqueDe(farmaciaId, medId), agora }
   */
  function montarPedido(entrada, ctx) {
    const farm = ctx.farmacia;
    if (!farm) return { ok: false, erro: "Farmácia não encontrada." };
    if (!aberta(farm, new Date(ctx.agora))) return { ok: false, erro: "A farmácia está fechada agora. Escolha outra unidade." };

    const itens = [];
    let precisaReceita = false;
    for (const { medId, qtd } of entrada.itens) {
      const med = ctx.medicamento(medId);
      if (!med) return { ok: false, erro: "Medicamento não encontrado." };
      if (ctx.estoqueDe(farm.id, med.id) < qtd) return { ok: false, erro: `${med.nome} não tem estoque suficiente nesta farmácia.` };
      if (med.receita !== "isento") precisaReceita = true;
      itens.push({ medId: med.id, nome: med.nome, apresentacao: med.apresentacao, qtd, precoCentavos: precoCentavos(med, farm) });
    }
    if (precisaReceita && !entrada.receita) return { ok: false, erro: "Envie a foto ou o PDF da receita para continuar." };

    const subtotal = itens.reduce((soma, item) => soma + item.precoCentavos * item.qtd, 0);
    let taxa = 0;
    let prazo = 30;
    let endereco = null;
    if (entrada.tipo === "entrega") {
      const e = entrada.endereco;
      const distancia = distanciaKm(e, farm);
      if (distancia > RAIO_ENTREGA) {
        return { ok: false, erro: `Este endereço fica a ${distancia.toFixed(1).replace(".", ",")} km da farmácia. Entregamos em até ${RAIO_ENTREGA} km.` };
      }
      taxa = taxaCentavos(distancia, subtotal);
      prazo = prazoEntrega(distancia);
      endereco = {
        texto: `${e.rua}, ${e.numero}${e.complemento ? ` - ${e.complemento}` : ""} · ${e.bairro}`,
        lat: e.lat,
        lng: e.lng
      };
    }

    const total = subtotal + taxa;
    if (entrada.pagamento === "dinheiro" && entrada.troco !== null && Math.round(entrada.troco * 100) <= total) {
      return { ok: false, erro: `O troco precisa ser para um valor acima de ${(total / 100).toFixed(2).replace(".", ",")}.` };
    }

    return {
      ok: true,
      pedido: {
        farmaciaId: farm.id,
        clienteNome: entrada.nome,
        telefone: entrada.telefone,
        tipo: entrada.tipo,
        status: "pendente",
        itens: itens.map(item => ({ medId: item.medId, nome: item.nome, apresentacao: item.apresentacao, qtd: item.qtd, preco: paraReais(item.precoCentavos) })),
        subtotal: paraReais(subtotal),
        taxa: paraReais(taxa),
        total: paraReais(total),
        pagamento: entrada.pagamento,
        troco: entrada.pagamento === "dinheiro" ? entrada.troco : null,
        receita: entrada.receita,
        endereco,
        bairro: endereco ? entrada.endereco.bairro : farm.bairro,
        prazo,
        criado: ctx.agora,
        historico: { pendente: ctx.agora },
        auto: true
      }
    };
  }

  // Transforma um pedido de exemplo (DadosIniciais.pedidosIniciais) em pedido completo
  function montarPedidoInicial(exemplo, ctx) {
    const farm = ctx.farmacia(exemplo.farmaciaId);
    const passos = ETAPAS[exemplo.tipo];
    const historico = {};
    const intervalos = [0, 4, 16, 38];
    const ate = exemplo.status === "cancelado" ? 0 : passos.indexOf(exemplo.status);
    for (let i = 0; i <= ate; i++) historico[passos[i]] = exemplo.criado + intervalos[i] * 60000;
    if (exemplo.status === "cancelado") historico.cancelado = exemplo.criado + 6 * 60000;

    const itens = exemplo.itens.map(([medId, qtd]) => {
      const med = ctx.medicamento(medId);
      return { medId, nome: med.nome, apresentacao: med.apresentacao, qtd, preco: preco(med, farm) };
    });
    const subtotal = itens.reduce((soma, item) => soma + Math.round(item.preco * 100) * item.qtd, 0);
    const taxa = exemplo.tipo === "entrega" ? taxaCentavos(2.5, subtotal) : 0;
    const c = exemplo.cliente;

    return {
      id: exemplo.id,
      farmaciaId: farm.id,
      clienteNome: c.nome,
      clienteEmail: c.email || null,
      telefone: c.telefone || null,
      tipo: exemplo.tipo,
      status: exemplo.status,
      itens,
      subtotal: paraReais(subtotal),
      taxa: paraReais(taxa),
      total: paraReais(subtotal + taxa),
      pagamento: exemplo.pagamento || "pix",
      troco: null,
      receita: exemplo.receita || null,
      endereco: exemplo.tipo === "entrega" ? {
        texto: `${c.rua} · ${farm.bairro}`,
        lat: farm.lat + (c.dLat || 0.008),
        lng: farm.lng + (c.dLng || -0.006)
      } : null,
      bairro: farm.bairro,
      codigoRetirada: String(4000 + (exemplo.id % 997)),
      prazo: 40,
      motivo: exemplo.motivo || null,
      criado: exemplo.criado,
      historico,
      auto: false
    };
  }

  return {
    RAIO_ENTREGA, FRETE_GRATIS, MAX_POR_ITEM, DURACAO, ETAPAS, STATUS, PAGAMENTOS,
    normalizar, distanciaKm, precoCentavos, preco, taxaEntrega, prazoEntrega,
    minutosEmBrasilia, aberta, textoHorario, situacaoEstoque,
    rotulo, etapas, proximoStatus, progressoEntrega, previsao, gerarCodigoRetirada,
    montarPedido, montarPedidoInicial
  };
});
