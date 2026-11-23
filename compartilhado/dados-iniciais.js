// Dados iniciais do Dose Certa: categorias, medicamentos, farmácias e contas de teste.
// O servidor usa para popular o banco; o navegador usa quando roda sem servidor.
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.DadosIniciais = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

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

  // Quantidade inicial de caixas de cada medicamento em cada farmácia
  function estoqueInicial(farmaciaId, medId) {
    if (medId >= 1000) return 0;
    const h = (medId * 37 + farmaciaId * 101) % 29;
    if (h < 3) return 0;
    if (h < 6) return h;
    return 8 + (h * 7) % 80;
  }

  // Contas de teste divulgadas na tela de login. Em produção, desligue com CONTAS_TESTE=0.
  const contasTeste = [
    { email: "demo@dosecerta.app", senha: "Dose1234", nome: "Alex Moreira", papel: "cliente", telefone: "(61) 99876-5432" },
    ...farmacias.map(f => ({ email: `farmacia${f.id}@dosecerta.app`, senha: "Farma1234", nome: "Gerente", papel: "farmacia", farmaciaId: f.id }))
  ];

  // Pedidos de exemplo para o portal não começar vazio
  function pedidosIniciais(agora = Date.now()) {
    const clientes = [
      { nome: "Maria Silva", rua: "Rua 25 Norte, Lote 3, Apto 802", dLat: 0.006, dLng: -0.004, telefone: "(61) 99812-3344" },
      { nome: "André Pereira", telefone: "(61) 98455-1020" },
      { nome: "Renata Costa", rua: "Rua 36 Sul, Lote 12, Apto 1104", dLat: -0.009, dLng: 0.005, telefone: "(61) 99130-7788" },
      { nome: "Júlio Almeida", telefone: "(61) 98222-6501" },
      { nome: "Larissa Santos", rua: "Av. Castanheiras, Lote 1050", dLat: 0.004, dLng: 0.009, telefone: "(61) 99607-4412" },
      { nome: "Paulo Oliveira", telefone: "(61) 98731-0098" },
      { nome: "Camila Souza", rua: "Quadra 104, Lote 7", dLat: -0.005, dLng: -0.008, telefone: "(61) 99345-2210" },
      { nome: "Bruno Martins", rua: "Quadra 202, Bloco C", dLat: 0.01, dLng: 0.002, telefone: "(61) 98004-5567" }
    ];
    const p = (id, farmaciaId, cliente, itens, tipo, status, minutosAtras, extra = {}) =>
      ({ id, farmaciaId, cliente, itens, tipo, status, criado: agora - minutosAtras * 60000, ...extra });
    return [
      p(7842, 1, clientes[0], [[1, 1]], "entrega", "pendente", 5, { receita: "receita-maria.jpg", pagamento: "cartao" }),
      p(7841, 1, clientes[1], [[18, 2]], "retirada", "separacao", 12, { receita: "receita-andre.pdf" }),
      p(7840, 1, clientes[2], [[21, 1], [24, 1]], "entrega", "transporte", 28),
      p(7839, 1, clientes[3], [[7, 2], [8, 1]], "retirada", "concluido", 95, { pagamento: "dinheiro" }),
      p(7838, 1, clientes[4], [[27, 1]], "entrega", "concluido", 160, { receita: "receita-larissa.jpg", pagamento: "cartao" }),
      p(7837, 1, clientes[5], [[14, 1]], "retirada", "cancelado", 210, { motivo: "Cancelado pelo cliente." }),
      p(7836, 1, clientes[6], [[35, 1], [34, 2]], "entrega", "concluido", 260),
      p(7835, 1, { nome: "Alex Moreira", email: "demo@dosecerta.app" }, [[35, 1]], "retirada", "concluido", 60 * 24 * 3),
      p(7834, 2, clientes[7], [[3, 1]], "entrega", "pendente", 8, { receita: "receita-bruno.jpg" }),
      p(7833, 2, clientes[3], [[10, 1]], "retirada", "concluido", 120),
      p(7832, 5, clientes[0], [[32, 1]], "retirada", "separacao", 15, { receita: "receita-maria-2.jpg" }),
      p(7831, 6, clientes[6], [[42, 1], [39, 1]], "entrega", "concluido", 180)
    ];
  }

  return { categorias, medicamentos, farmacias, estoqueInicial, contasTeste, pedidosIniciais };
});
