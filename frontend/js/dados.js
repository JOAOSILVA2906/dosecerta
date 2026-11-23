// Dados e regras compartilhados pela área do cliente e pelo portal da farmácia.
// Os pedidos e o estoque ficam no localStorage, então as duas telas enxergam as mesmas informações.
window.DoseCerta = (() => {
  "use strict";

  const VERSAO = "2";
  const CHAVES = {
    versao: "dosecerta:versao",
    pedidos: "dosecerta:pedidos",
    estoque: "dosecerta:estoque",
    extras: "dosecerta:catalogo-extra",
    contas: "dosecerta:contas",
    sessao: "dosecerta:sessao",
    lidas: "dosecerta:notificacoes-lidas",
    enderecos: "dosecerta:enderecos",
    unidade: "dosecerta:unidade",
    responsavel: "dosecerta:responsavel",
    local: "dosecerta:localizacao"
  };

  const RAIO_ENTREGA = 12; // km
  const FRETE_GRATIS = 80; // R$

  const categorias = [
    { id: "pressao", nome: "Pressão e coração", cor: "#b45e7d" },
    { id: "dor", nome: "Dor e febre", cor: "#d9786b" },
    { id: "alergia", nome: "Alergia", cor: "#7d9bc9" },
    { id: "diabetes", nome: "Diabetes", cor: "#5f9e8a" },
    { id: "estomago", nome: "Estômago", cor: "#c9a35b" },
    { id: "antibiotico", nome: "Antibióticos", cor: "#8c6bb8" },
    { id: "colesterol", nome: "Colesterol", cor: "#cf8e4f" },
    { id: "vitaminas", nome: "Vitaminas", cor: "#e0a83c" },
    { id: "respiratorio", nome: "Gripe e respiração", cor: "#5b9fc9" },
    { id: "outros", nome: "Outros", cor: "#8a8f99" }
  ];

  // receita: "isento" (venda livre), "simples" (tarja vermelha) ou "retencao" (a farmácia retém a receita)
  const medicamentos = [
    { id: 1, nome: "Losartana potássica 50 mg", apresentacao: "Caixa com 30 comprimidos", forma: "comprimido", categoria: "pressao", preco: 14.9, receita: "simples", generico: true },
    { id: 2, nome: "Enalapril 10 mg", apresentacao: "Caixa com 30 comprimidos", forma: "comprimido", categoria: "pressao", preco: 11.5, receita: "simples", generico: true },
    { id: 3, nome: "Anlodipino 5 mg", apresentacao: "Caixa com 30 comprimidos", forma: "comprimido", categoria: "pressao", preco: 12.8, receita: "simples", generico: true },
    { id: 4, nome: "Hidroclorotiazida 25 mg", apresentacao: "Caixa com 30 comprimidos", forma: "comprimido", categoria: "pressao", preco: 7.9, receita: "simples", generico: true },
    { id: 5, nome: "Atenolol 25 mg", apresentacao: "Caixa com 30 comprimidos", forma: "comprimido", categoria: "pressao", preco: 9.4, receita: "simples", generico: true },
    { id: 6, nome: "Ácido acetilsalicílico 100 mg", apresentacao: "Caixa com 30 comprimidos", forma: "comprimido", categoria: "pressao", preco: 8.9, receita: "isento", generico: false },
    { id: 7, nome: "Paracetamol 750 mg", apresentacao: "Caixa com 20 comprimidos", forma: "comprimido", categoria: "dor", preco: 9.9, receita: "isento", generico: true },
    { id: 8, nome: "Dipirona monoidratada 500 mg", apresentacao: "Caixa com 10 comprimidos", forma: "comprimido", categoria: "dor", preco: 6.5, receita: "isento", generico: true },
    { id: 9, nome: "Dipirona gotas 500 mg/ml", apresentacao: "Frasco com 20 ml", forma: "liquido", categoria: "dor", preco: 8.7, receita: "isento", generico: true },
    { id: 10, nome: "Ibuprofeno 400 mg", apresentacao: "Caixa com 10 cápsulas", forma: "capsula", categoria: "dor", preco: 12.4, receita: "isento", generico: false },
    { id: 11, nome: "Ibuprofeno gotas 50 mg/ml", apresentacao: "Frasco com 30 ml", forma: "liquido", categoria: "dor", preco: 15.9, receita: "isento", generico: true },
    { id: 12, nome: "Nimesulida 100 mg", apresentacao: "Caixa com 12 comprimidos", forma: "comprimido", categoria: "dor", preco: 10.9, receita: "simples", generico: true },
    { id: 13, nome: "Cetoprofeno 100 mg", apresentacao: "Caixa com 10 cápsulas", forma: "capsula", categoria: "dor", preco: 18.5, receita: "simples", generico: true },
    { id: 14, nome: "Loratadina 10 mg", apresentacao: "Caixa com 12 comprimidos", forma: "comprimido", categoria: "alergia", preco: 9.8, receita: "isento", generico: true },
    { id: 15, nome: "Desloratadina 5 mg", apresentacao: "Caixa com 10 comprimidos", forma: "comprimido", categoria: "alergia", preco: 19.9, receita: "isento", generico: true },
    { id: 16, nome: "Cetirizina 10 mg", apresentacao: "Caixa com 10 comprimidos", forma: "comprimido", categoria: "alergia", preco: 14.2, receita: "isento", generico: true },
    { id: 17, nome: "Dexclorfeniramina 2 mg", apresentacao: "Caixa com 20 comprimidos", forma: "comprimido", categoria: "alergia", preco: 11.3, receita: "isento", generico: true },
    { id: 18, nome: "Metformina 850 mg", apresentacao: "Caixa com 30 comprimidos", forma: "comprimido", categoria: "diabetes", preco: 10.9, receita: "simples", generico: true },
    { id: 19, nome: "Glibenclamida 5 mg", apresentacao: "Caixa com 30 comprimidos", forma: "comprimido", categoria: "diabetes", preco: 6.9, receita: "simples", generico: true },
    { id: 20, nome: "Gliclazida 30 mg", apresentacao: "Caixa com 30 comprimidos", forma: "comprimido", categoria: "diabetes", preco: 22.4, receita: "simples", generico: true },
    { id: 21, nome: "Omeprazol 20 mg", apresentacao: "Caixa com 28 cápsulas", forma: "capsula", categoria: "estomago", preco: 13.9, receita: "isento", generico: true },
    { id: 22, nome: "Pantoprazol 40 mg", apresentacao: "Caixa com 28 comprimidos", forma: "comprimido", categoria: "estomago", preco: 24.9, receita: "simples", generico: true },
    { id: 23, nome: "Domperidona 10 mg", apresentacao: "Caixa com 30 comprimidos", forma: "comprimido", categoria: "estomago", preco: 16.8, receita: "simples", generico: true },
    { id: 24, nome: "Simeticona 40 mg", apresentacao: "Caixa com 20 comprimidos", forma: "comprimido", categoria: "estomago", preco: 7.5, receita: "isento", generico: true },
    { id: 25, nome: "Bromoprida 10 mg", apresentacao: "Caixa com 20 cápsulas", forma: "capsula", categoria: "estomago", preco: 12.9, receita: "simples", generico: true },
    { id: 26, nome: "Sais para reidratação oral", apresentacao: "Caixa com 4 envelopes", forma: "sache", categoria: "estomago", preco: 9.5, receita: "isento", generico: false },
    { id: 27, nome: "Amoxicilina 500 mg", apresentacao: "Caixa com 21 cápsulas", forma: "capsula", categoria: "antibiotico", preco: 19.9, receita: "retencao", generico: true },
    { id: 28, nome: "Azitromicina 500 mg", apresentacao: "Caixa com 3 comprimidos", forma: "comprimido", categoria: "antibiotico", preco: 21.5, receita: "retencao", generico: true },
    { id: 29, nome: "Cefalexina 500 mg", apresentacao: "Caixa com 8 cápsulas", forma: "capsula", categoria: "antibiotico", preco: 17.8, receita: "retencao", generico: true },
    { id: 30, nome: "Amoxicilina + clavulanato 875 mg", apresentacao: "Caixa com 14 comprimidos", forma: "comprimido", categoria: "antibiotico", preco: 54.9, receita: "retencao", generico: true },
    { id: 31, nome: "Sinvastatina 20 mg", apresentacao: "Caixa com 30 comprimidos", forma: "comprimido", categoria: "colesterol", preco: 11.9, receita: "simples", generico: true },
    { id: 32, nome: "Atorvastatina 20 mg", apresentacao: "Caixa com 30 comprimidos", forma: "comprimido", categoria: "colesterol", preco: 24.9, receita: "simples", generico: true },
    { id: 33, nome: "Rosuvastatina 10 mg", apresentacao: "Caixa com 30 comprimidos", forma: "comprimido", categoria: "colesterol", preco: 34.9, receita: "simples", generico: true },
    { id: 34, nome: "Vitamina C 1 g efervescente", apresentacao: "Tubo com 10 comprimidos", forma: "comprimido", categoria: "vitaminas", preco: 12.9, receita: "isento", generico: false },
    { id: 35, nome: "Vitamina D3 2.000 UI", apresentacao: "Frasco com 30 cápsulas", forma: "capsula", categoria: "vitaminas", preco: 29.9, receita: "isento", generico: false },
    { id: 36, nome: "Complexo B", apresentacao: "Caixa com 30 drágeas", forma: "comprimido", categoria: "vitaminas", preco: 14.5, receita: "isento", generico: false },
    { id: 37, nome: "Sulfato ferroso 40 mg", apresentacao: "Caixa com 50 comprimidos", forma: "comprimido", categoria: "vitaminas", preco: 8.2, receita: "isento", generico: true },
    { id: 38, nome: "Ácido fólico 5 mg", apresentacao: "Caixa com 20 comprimidos", forma: "comprimido", categoria: "vitaminas", preco: 6.9, receita: "isento", generico: true },
    { id: 39, nome: "Xarope de guaco", apresentacao: "Frasco com 120 ml", forma: "liquido", categoria: "respiratorio", preco: 13.4, receita: "isento", generico: false },
    { id: 40, nome: "Acetilcisteína 600 mg", apresentacao: "Caixa com 16 envelopes", forma: "sache", categoria: "respiratorio", preco: 31.9, receita: "isento", generico: true },
    { id: 41, nome: "Ambroxol xarope 30 mg/5 ml", apresentacao: "Frasco com 120 ml", forma: "liquido", categoria: "respiratorio", preco: 14.9, receita: "isento", generico: true },
    { id: 42, nome: "Soro fisiológico nasal 0,9%", apresentacao: "Spray com 50 ml", forma: "spray", categoria: "respiratorio", preco: 11.9, receita: "isento", generico: false },
    { id: 43, nome: "Budesonida spray nasal 32 mcg", apresentacao: "Frasco com 120 doses", forma: "spray", categoria: "respiratorio", preco: 39.9, receita: "simples", generico: true },
    { id: 44, nome: "Levotiroxina 50 mcg", apresentacao: "Caixa com 30 comprimidos", forma: "comprimido", categoria: "outros", preco: 15.3, receita: "simples", generico: true },
    { id: 45, nome: "Fluconazol 150 mg", apresentacao: "Caixa com 1 cápsula", forma: "capsula", categoria: "outros", preco: 9.9, receita: "simples", generico: true }
  ];

  // horario null = aberta 24 horas
  const farmacias = [
    { id: 1, nome: "Farmácia Central", endereco: "Av. das Araucárias, 1835", bairro: "Águas Claras", lat: -15.8352, lng: -48.0226, horario: { abre: "07:00", fecha: "23:00" }, telefone: "(61) 3201-4410", nota: 4.8, avaliacoes: 312, fator: 1 },
    { id: 2, nome: "Farmácia Bem Estar", endereco: "QNC 12, Lote 3", bairro: "Taguatinga Norte", lat: -15.8155, lng: -48.0610, horario: { abre: "08:00", fecha: "22:00" }, telefone: "(61) 3352-1187", nota: 4.6, avaliacoes: 198, fator: 0.96 },
    { id: 3, nome: "Farmácia Vida", endereco: "Rua 8, Chácara 52", bairro: "Arniqueira", lat: -15.8560, lng: -48.0110, horario: { abre: "08:00", fecha: "20:00" }, telefone: "(61) 3397-2045", nota: 4.5, avaliacoes: 87, fator: 1.03 },
    { id: 4, nome: "Farmácia Popular do Bairro", endereco: "Rua 4C, Chácara 128", bairro: "Vicente Pires", lat: -15.8040, lng: -48.0300, horario: { abre: "07:30", fecha: "21:30" }, telefone: "(61) 3036-7712", nota: 4.4, avaliacoes: 143, fator: 0.92 },
    { id: 5, nome: "Drogaria Saúde Mais", endereco: "QE 40, Lote 8", bairro: "Guará II", lat: -15.8350, lng: -47.9800, horario: null, telefone: "(61) 3381-9020", nota: 4.7, avaliacoes: 421, fator: 1.05 },
    { id: 6, nome: "Farmácia Plantão 24h", endereco: "CLS 306, Bloco B, Loja 12", bairro: "Asa Sul", lat: -15.8085, lng: -47.9005, horario: null, telefone: "(61) 3244-6031", nota: 4.6, avaliacoes: 509, fator: 1.08 },
    { id: 7, nome: "Drogaria Esperança", endereco: "QNM 18, Conjunto A, Lote 4", bairro: "Ceilândia", lat: -15.8180, lng: -48.1080, horario: { abre: "08:00", fecha: "22:00" }, telefone: "(61) 3371-5584", nota: 4.3, avaliacoes: 76, fator: 0.94 },
    { id: 8, nome: "Farmácia Preço Justo", endereco: "QS 406, Conjunto E, Lote 2", bairro: "Samambaia", lat: -15.8750, lng: -48.0850, horario: { abre: "08:00", fecha: "21:00" }, telefone: "(61) 3358-4470", nota: 4.5, avaliacoes: 131, fator: 0.9 }
  ];

  const LOCAL_PADRAO = { lat: -15.8396, lng: -48.0256, nome: "Águas Claras, DF", padrao: true };

  // Tempo (ms) que cada etapa leva quando a farmácia não age antes.
  const DURACAO = {
    pendente: 45000,
    separacao: 30000,
    transporte: 70000,
    pronto: 60000
  };

  /* ---------- armazenamento ---------- */

  const memoria = new Map();
  let usaMemoria = false;
  try {
    localStorage.setItem("dosecerta:teste", "1");
    localStorage.removeItem("dosecerta:teste");
  } catch {
    usaMemoria = true;
  }

  function ler(chave, padrao) {
    try {
      const texto = usaMemoria ? memoria.get(chave) : localStorage.getItem(chave);
      if (texto == null) return padrao;
      return JSON.parse(texto);
    } catch {
      return padrao;
    }
  }

  function gravar(chave, valor) {
    const texto = JSON.stringify(valor);
    if (usaMemoria) {
      memoria.set(chave, texto);
      return true;
    }
    try {
      localStorage.setItem(chave, texto);
      return true;
    } catch {
      return false;
    }
  }

  function remover(chave) {
    if (usaMemoria) memoria.delete(chave);
    else localStorage.removeItem(chave);
  }

  function aoMudar(callback) {
    window.addEventListener("storage", evento => {
      if (evento.key === null || evento.key.startsWith("dosecerta:")) callback(evento.key);
    });
  }

  /* ---------- utilitários ---------- */

  const normalizar = texto => String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const escapar = valor => String(valor).replace(/[&<>"']/g, c => ({
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
    return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + `, ${hora(timestamp)}`;
  }

  function haTempo(timestamp) {
    const minutos = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutos === 0) return "Agora";
    if (minutos < 60) return `Há ${minutos} min`;
    if (minutos < 1440) return `Há ${Math.floor(minutos / 60)} h`;
    return new Date(timestamp).toLocaleDateString("pt-BR");
  }

  // Distância em linha reta (fórmula de Haversine)
  function distanciaKm(a, b) {
    const rad = graus => graus * Math.PI / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  /* ---------- catálogo e farmácias ---------- */

  const categoria = id => categorias.find(c => c.id === id) || categorias[categorias.length - 1];
  const farmacia = id => farmacias.find(f => f.id === Number(id));

  function catalogo() {
    return medicamentos.concat(ler(CHAVES.extras, []));
  }

  function medicamento(id) {
    return catalogo().find(m => m.id === Number(id));
  }

  function adicionarMedicamento(dados, farmaciaId, quantidade) {
    const extras = ler(CHAVES.extras, []);
    const id = Math.max(999, ...extras.map(m => m.id)) + 1;
    const novo = { id, generico: false, forma: "comprimido", ...dados };
    extras.push(novo);
    gravar(CHAVES.extras, extras);
    definirEstoque(farmaciaId, id, quantidade);
    return novo;
  }

  function estoquePadrao(farmaciaId, medId) {
    if (medId >= 1000) return 0;
    const h = (medId * 37 + farmaciaId * 101) % 29;
    if (h < 3) return 0;
    if (h < 6) return h;
    return 8 + (h * 7) % 80;
  }

  function estoqueDe(farmaciaId, medId) {
    const ajustes = ler(CHAVES.estoque, {});
    const valor = ajustes[farmaciaId]?.[medId];
    return Number.isInteger(valor) ? valor : estoquePadrao(farmaciaId, medId);
  }

  function definirEstoque(farmaciaId, medId, quantidade) {
    const ajustes = ler(CHAVES.estoque, {});
    ajustes[farmaciaId] = ajustes[farmaciaId] || {};
    ajustes[farmaciaId][medId] = quantidade;
    return gravar(CHAVES.estoque, ajustes);
  }

  function preco(med, farm) {
    const centavos = Math.round(med.preco * farm.fator * 100);
    return (Math.ceil(centavos / 10) * 10 - 1) / 100;
  }

  function menorPreco(med) {
    const valores = farmacias.filter(f => estoqueDe(f.id, med.id) > 0).map(f => preco(med, f));
    return valores.length ? Math.min(...valores) : null;
  }

  function minutosDoDia(texto) {
    const [h, m] = texto.split(":").map(Number);
    return h * 60 + m;
  }

  function aberta(farm, agora = new Date()) {
    if (!farm.horario) return true;
    const atual = agora.getHours() * 60 + agora.getMinutes();
    return atual >= minutosDoDia(farm.horario.abre) && atual < minutosDoDia(farm.horario.fecha);
  }

  function textoHorario(farm) {
    if (!farm.horario) return "Aberta 24 horas";
    return aberta(farm) ? `Aberta até ${farm.horario.fecha}` : `Fechada · abre às ${farm.horario.abre}`;
  }

  function taxaEntrega(distancia, subtotal = 0) {
    if (subtotal >= FRETE_GRATIS) return 0;
    const valor = 3.9 + Math.max(0, distancia - 2) * 1.1;
    return Math.min(15.99, Math.ceil(valor) - 0.01);
  }

  const prazoEntrega = distancia => Math.round(30 + distancia * 3);

  /* ---------- localização do cliente ---------- */

  const localizacao = () => ler(CHAVES.local, LOCAL_PADRAO);
  const salvarLocalizacao = local => gravar(CHAVES.local, local);

  /* ---------- pedidos ---------- */

  const ETAPAS = {
    entrega: ["pendente", "separacao", "transporte", "concluido"],
    retirada: ["pendente", "separacao", "pronto", "concluido"]
  };

  function rotulo(pedido, status = pedido.status) {
    const textos = {
      pendente: "Aguardando confirmação",
      separacao: "Em separação",
      pronto: "Pronto para retirada",
      transporte: "Saiu para entrega",
      concluido: pedido.tipo === "entrega" ? "Pedido entregue" : "Pedido retirado",
      cancelado: "Pedido cancelado"
    };
    return textos[status];
  }

  const etapas = pedido => ETAPAS[pedido.tipo];
  const pedidos = () => ler(CHAVES.pedidos, []);
  const salvarPedidos = lista => gravar(CHAVES.pedidos, lista);
  const pedido = id => pedidos().find(p => p.id === Number(id));

  function criarPedido(dados) {
    const lista = pedidos();
    const agora = Date.now();
    const novo = {
      id: Math.max(7842, ...lista.map(p => p.id)) + 1,
      criado: agora,
      status: "pendente",
      historico: { pendente: agora },
      codigoRetirada: String(Math.floor(1000 + Math.random() * 9000)),
      auto: true,
      ...dados
    };
    lista.unshift(novo);
    salvarPedidos(lista);
    return novo;
  }

  function aplicarAvanco(p, quando) {
    if (p.status === "pendente") {
      const faltando = p.itens.find(item => estoqueDe(p.farmaciaId, item.medId) < item.qtd);
      if (faltando) return { ok: false, motivo: `${faltando.nome} sem estoque suficiente.` };
      p.itens.forEach(item => definirEstoque(p.farmaciaId, item.medId, estoqueDe(p.farmaciaId, item.medId) - item.qtd));
      p.status = "separacao";
    } else if (p.status === "separacao") {
      p.status = p.tipo === "entrega" ? "transporte" : "pronto";
    } else if (p.status === "transporte" || p.status === "pronto") {
      p.status = "concluido";
    } else {
      return { ok: false, motivo: "Este pedido já foi finalizado." };
    }
    p.historico[p.status] = quando;
    return { ok: true };
  }

  function avancarPedido(id) {
    const lista = pedidos();
    const p = lista.find(item => item.id === Number(id));
    if (!p) return { ok: false, motivo: "Pedido não encontrado." };
    const resultado = aplicarAvanco(p, Date.now());
    if (resultado.ok) salvarPedidos(lista);
    return { ...resultado, pedido: p };
  }

  function cancelarPedido(id, motivo) {
    const lista = pedidos();
    const p = lista.find(item => item.id === Number(id));
    if (!p || p.status !== "pendente") return false;
    p.status = "cancelado";
    p.motivo = motivo;
    p.historico.cancelado = Date.now();
    return salvarPedidos(lista);
  }

  // Simula a farmácia andando com os pedidos feitos pelo app quando ninguém age no portal.
  function processarFila() {
    const lista = pedidos();
    const agora = Date.now();
    let mudou = false;
    lista.forEach(p => {
      if (!p.auto) return;
      while (DURACAO[p.status]) {
        const prazo = p.historico[p.status] + DURACAO[p.status];
        if (prazo > agora) break;
        const resultado = aplicarAvanco(p, prazo);
        if (!resultado.ok) {
          p.status = "cancelado";
          p.motivo = resultado.motivo;
          p.historico.cancelado = prazo;
        }
        mudou = true;
      }
    });
    if (mudou) salvarPedidos(lista);
    return mudou;
  }

  function progressoEntrega(p) {
    if (p.status === "concluido") return 1;
    if (p.status !== "transporte") return 0;
    return Math.min(1, (Date.now() - p.historico.transporte) / DURACAO.transporte);
  }

  function previsao(p) {
    if (["concluido", "cancelado"].includes(p.status)) return null;
    if (p.tipo === "entrega") return p.criado + (p.prazo || 45) * 60000;
    return p.criado + 30 * 60000;
  }

  /* ---------- contas e sessão ---------- */

  async function resumoSenha(senha) {
    const dados = new TextEncoder().encode(senha);
    const digest = await crypto.subtle.digest("SHA-256", dados);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  }

  const contas = () => ler(CHAVES.contas, {});
  const salvarContas = lista => gravar(CHAVES.contas, lista);
  const sessao = () => ler(CHAVES.sessao, null);
  const iniciarSessao = usuario => gravar(CHAVES.sessao, usuario);
  const encerrarSessao = () => remover(CHAVES.sessao);

  function ultimaLeitura(clienteId) {
    return ler(CHAVES.lidas, {})[clienteId] || 0;
  }

  function marcarLidas(clienteId) {
    const lidas = ler(CHAVES.lidas, {});
    lidas[clienteId] = Date.now();
    gravar(CHAVES.lidas, lidas);
  }

  const enderecoSalvo = clienteId => ler(CHAVES.enderecos, {})[clienteId] || null;
  function salvarEndereco(clienteId, endereco) {
    const lista = ler(CHAVES.enderecos, {});
    lista[clienteId] = endereco;
    gravar(CHAVES.enderecos, lista);
  }

  /* ---------- portal ---------- */

  const unidade = () => farmacia(ler(CHAVES.unidade, 1)) || farmacias[0];
  const definirUnidade = id => gravar(CHAVES.unidade, Number(id));
  const responsavel = () => ler(CHAVES.responsavel, "Gerente");
  const definirResponsavel = nome => gravar(CHAVES.responsavel, nome);

  /* ---------- dados iniciais ---------- */

  function pedidoInicial(id, farmaciaId, cliente, itens, tipo, status, minutosAtras, extra = {}) {
    const farm = farmacia(farmaciaId);
    const criado = Date.now() - minutosAtras * 60000;
    const passos = ETAPAS[tipo];
    const historico = {};
    const ate = status === "cancelado" ? 0 : passos.indexOf(status);
    const intervalos = [0, 4, 16, 38];
    for (let i = 0; i <= ate; i++) historico[passos[i]] = criado + intervalos[i] * 60000;
    if (status === "cancelado") historico.cancelado = criado + 6 * 60000;

    const linhas = itens.map(([medId, qtd]) => {
      const med = medicamento(medId);
      return { medId, nome: med.nome, apresentacao: med.apresentacao, qtd, preco: preco(med, farm) };
    });
    const subtotal = linhas.reduce((soma, item) => soma + item.preco * item.qtd, 0);
    const taxa = tipo === "entrega" ? taxaEntrega(2.5, subtotal) : 0;

    return {
      id, farmaciaId, criado, status, historico, tipo,
      clienteId: cliente.id || `balcao-${id}`,
      clienteNome: cliente.nome,
      itens: linhas,
      subtotal, taxa, total: subtotal + taxa,
      pagamento: extra.pagamento || "pix",
      endereco: tipo === "entrega" ? {
        texto: `${cliente.rua} · ${farm.bairro}`,
        lat: farm.lat + (cliente.dLat || 0.008),
        lng: farm.lng + (cliente.dLng || -0.006)
      } : null,
      bairro: farm.bairro,
      receita: extra.receita || null,
      codigoRetirada: String(4000 + (id % 997)),
      prazo: 40,
      auto: false
    };
  }

  function popular() {
    const clientes = [
      { nome: "Maria Silva", rua: "Rua 25 Norte, Lote 3, Apto 802", dLat: 0.006, dLng: -0.004 },
      { nome: "André Pereira" },
      { nome: "Renata Costa", rua: "Rua 36 Sul, Lote 12, Apto 1104", dLat: -0.009, dLng: 0.005 },
      { nome: "Júlio Almeida" },
      { nome: "Larissa Santos", rua: "Av. Castanheiras, Lote 1050", dLat: 0.004, dLng: 0.009 },
      { nome: "Paulo Oliveira" },
      { nome: "Camila Souza", rua: "Quadra 104, Lote 7", dLat: -0.005, dLng: -0.008 },
      { nome: "Bruno Martins", rua: "Quadra 202, Bloco C", dLat: 0.01, dLng: 0.002 }
    ];
    const lista = [
      pedidoInicial(7842, 1, clientes[0], [[1, 1]], "entrega", "pendente", 5, { receita: "receita-maria.jpg", pagamento: "cartao" }),
      pedidoInicial(7841, 1, clientes[1], [[18, 2]], "retirada", "separacao", 12, { receita: "receita-andre.pdf" }),
      pedidoInicial(7840, 1, clientes[2], [[21, 1], [24, 1]], "entrega", "transporte", 28),
      pedidoInicial(7839, 1, clientes[3], [[7, 2], [8, 1]], "retirada", "concluido", 95, { pagamento: "dinheiro" }),
      pedidoInicial(7838, 1, clientes[4], [[27, 1]], "entrega", "concluido", 160, { receita: "receita-larissa.jpg", pagamento: "cartao" }),
      pedidoInicial(7837, 1, clientes[5], [[14, 1]], "retirada", "cancelado", 210),
      pedidoInicial(7836, 1, clientes[6], [[35, 1], [34, 2]], "entrega", "concluido", 260),
      pedidoInicial(7834, 2, clientes[7], [[3, 1]], "entrega", "pendente", 8, { receita: "receita-bruno.jpg" }),
      pedidoInicial(7833, 2, clientes[3], [[10, 1]], "retirada", "concluido", 120),
      pedidoInicial(7832, 5, clientes[0], [[32, 1]], "retirada", "separacao", 15, { receita: "receita-maria-2.jpg" }),
      pedidoInicial(7831, 6, clientes[6], [[42, 1], [39, 1]], "entrega", "concluido", 180),
      pedidoInicial(7835, 1, { id: "demo@dosecerta.app", nome: "Alex Moreira" }, [[35, 1]], "retirada", "concluido", 60 * 24 * 3)
    ];
    salvarPedidos(lista);
  }

  function prepararDados() {
    if (usaMemoria || ler(CHAVES.versao, null) === VERSAO) {
      if (!ler(CHAVES.pedidos, null)) popular();
      return;
    }
    Object.keys(localStorage)
      .filter(chave => chave.startsWith("dosecerta:") || chave === "dose-certa-farmacia-v1")
      .forEach(chave => localStorage.removeItem(chave));
    gravar(CHAVES.versao, VERSAO);
    popular();
  }

  function reiniciarTudo() {
    [CHAVES.pedidos, CHAVES.estoque, CHAVES.extras, CHAVES.lidas].forEach(remover);
    popular();
  }

  prepararDados();

  return {
    RAIO_ENTREGA, FRETE_GRATIS, LOCAL_PADRAO,
    categorias, farmacias,
    normalizar, escapar, moeda, km, hora, dataCurta, haTempo, distanciaKm,
    categoria, farmacia, catalogo, medicamento, adicionarMedicamento,
    estoqueDe, definirEstoque, preco, menorPreco, aberta, textoHorario,
    taxaEntrega, prazoEntrega, localizacao, salvarLocalizacao,
    rotulo, etapas, pedidos, pedido, criarPedido, avancarPedido, cancelarPedido,
    processarFila, progressoEntrega, previsao,
    resumoSenha, contas, salvarContas, sessao, iniciarSessao, encerrarSessao,
    ultimaLeitura, marcarLidas, enderecoSalvo, salvarEndereco,
    unidade, definirUnidade, responsavel, definirResponsavel,
    reiniciarTudo, aoMudar
  };
})();
