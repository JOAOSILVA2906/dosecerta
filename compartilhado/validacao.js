// Validação de tudo que chega do usuário. O servidor nunca confia no navegador:
// mesmo que alguém pule a validação da tela, ela é refeita aqui antes de gravar no banco.
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.Validacao = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const erro = mensagem => ({ ok: false, erro: mensagem });
  const ok = dados => ({ ok: true, dados });

  // Texto simples: tira espaços extras e caracteres de controle, limita o tamanho
  function texto(valor, { min = 1, max = 100 } = {}) {
    if (typeof valor !== "string") return null;
    const limpo = valor.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
    if (limpo.length < min || limpo.length > max) return null;
    return limpo;
  }

  const inteiro = (valor, min, max) => Number.isInteger(valor) && valor >= min && valor <= max ? valor : null;
  const numero = (valor, min, max) => typeof valor === "number" && Number.isFinite(valor) && valor >= min && valor <= max ? valor : null;

  const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

  function email(valor) {
    const limpo = texto(valor, { min: 6, max: 150 });
    return limpo && EMAIL.test(limpo) ? limpo.toLowerCase() : null;
  }

  function telefone(valor) {
    const limpo = texto(valor, { min: 10, max: 20 });
    if (!limpo || !/^[\d\s()+-]+$/.test(limpo)) return null;
    const digitos = limpo.replace(/\D/g, "");
    return digitos.length >= 10 && digitos.length <= 13 ? limpo : null;
  }

  // Nome de arquivo sem caminho e só com caracteres seguros
  function nomeArquivo(valor) {
    if (valor == null || valor === "") return null;
    if (typeof valor !== "string") return undefined;
    const base = valor.split(/[\\/]/).pop().replace(/[^\w.\- ()À-ÿ]/g, "").trim();
    return base.length >= 1 && base.length <= 120 ? base : undefined;
  }

  function senhaForte(valor) {
    if (typeof valor !== "string" || valor.length < 8 || valor.length > 128) return false;
    return /[a-zA-Z]/.test(valor) && /\d/.test(valor);
  }

  /* ---------- contas ---------- */

  function cadastro(corpo) {
    const nome = texto(corpo?.nome, { min: 2, max: 70 });
    if (!nome) return erro("Informe um nome com 2 a 70 letras.");
    const mail = email(corpo?.email);
    if (!mail) return erro("Informe um e-mail válido.");
    if (!senhaForte(corpo?.senha)) return erro("A senha precisa ter de 8 a 128 caracteres, com letras e números.");
    return ok({ nome, email: mail, senha: corpo.senha });
  }

  function login(corpo) {
    const mail = email(corpo?.email);
    if (!mail || typeof corpo?.senha !== "string" || !corpo.senha || corpo.senha.length > 128) {
      return erro("E-mail ou senha incorretos.");
    }
    return ok({ email: mail, senha: corpo.senha });
  }

  /* ---------- pedido ---------- */

  // Área aproximada do Distrito Federal e entorno
  const LIMITES_DF = { latMin: -16.2, latMax: -15.4, lngMin: -48.4, lngMax: -47.2 };

  function pedido(corpo) {
    if (!corpo || typeof corpo !== "object") return erro("Pedido inválido.");

    const farmaciaId = inteiro(corpo.farmaciaId, 1, 1e6);
    if (!farmaciaId) return erro("Farmácia inválida.");

    if (!Array.isArray(corpo.itens) || corpo.itens.length < 1 || corpo.itens.length > 10) return erro("O pedido precisa ter de 1 a 10 itens.");
    const itens = [];
    const vistos = new Set();
    for (const item of corpo.itens) {
      const medId = inteiro(item?.medId, 1, 1e6);
      const qtd = inteiro(item?.qtd, 1, 10);
      if (!medId || !qtd) return erro("Quantidade inválida. Cada item aceita de 1 a 10 caixas.");
      if (vistos.has(medId)) return erro("Item repetido no pedido.");
      vistos.add(medId);
      itens.push({ medId, qtd });
    }

    if (!["entrega", "retirada"].includes(corpo.tipo)) return erro("Escolha retirada ou entrega.");
    if (!["pix", "cartao", "dinheiro"].includes(corpo.pagamento)) return erro("Forma de pagamento inválida.");

    const nome = texto(corpo.nome, { min: 3, max: 70 });
    if (!nome) return erro("Informe seu nome para identificarmos o pedido.");
    const fone = telefone(corpo.telefone);
    if (!fone) return erro("Informe um celular com DDD.");

    let troco = null;
    if (corpo.troco != null && corpo.troco !== "") {
      troco = numero(corpo.troco, 0.01, 10000);
      if (troco === null) return erro("Valor de troco inválido.");
    }

    const receita = nomeArquivo(corpo.receita);
    if (receita === undefined) return erro("Nome do arquivo da receita inválido.");

    let endereco = null;
    if (corpo.tipo === "entrega") {
      const e = corpo.endereco || {};
      const rua = texto(e.rua, { min: 2, max: 150 });
      const num = texto(e.numero, { min: 1, max: 20 });
      const bairro = texto(e.bairro, { min: 2, max: 80 });
      const complemento = e.complemento ? texto(e.complemento, { min: 1, max: 100 }) : "";
      const cep = e.cep ? texto(e.cep, { min: 8, max: 9 }) : "";
      const lat = numero(e.lat, LIMITES_DF.latMin, LIMITES_DF.latMax);
      const lng = numero(e.lng, LIMITES_DF.lngMin, LIMITES_DF.lngMax);
      if (!rua || !num || !bairro) return erro("Preencha rua, número e bairro para a entrega.");
      if (complemento === null) return erro("Complemento muito longo.");
      if (cep === null || (cep && !/^\d{5}-?\d{3}$/.test(cep))) return erro("CEP inválido.");
      if (lat === null || lng === null) return erro("Endereço fora da área atendida (Distrito Federal).");
      endereco = { rua, numero: num, bairro, complemento, cep, lat, lng };
    }

    return ok({ farmaciaId, itens, tipo: corpo.tipo, pagamento: corpo.pagamento, troco, nome, telefone: fone, receita, endereco });
  }

  /* ---------- portal da farmácia ---------- */

  function quantidadeEstoque(valor) {
    const qtd = inteiro(valor, 0, 100000);
    return qtd === null ? erro("Informe uma quantidade inteira entre 0 e 100.000.") : ok(qtd);
  }

  function novoMedicamento(corpo, categoriasValidas) {
    const nome = texto(corpo?.nome, { min: 3, max: 100 });
    const apresentacao = texto(corpo?.apresentacao, { min: 3, max: 100 });
    if (!nome || !apresentacao) return erro("Preencha o nome e a apresentação.");
    if (!categoriasValidas.includes(corpo.categoria)) return erro("Categoria inválida.");
    if (!["isento", "simples", "retencao"].includes(corpo.receita)) return erro("Tipo de receita inválido.");
    const preco = numero(corpo.preco, 0.5, 9999.99);
    if (preco === null) return erro("Informe um preço entre R$ 0,50 e R$ 9.999,99.");
    const qtd = inteiro(corpo.quantidade, 0, 100000);
    if (qtd === null) return erro("Informe uma quantidade inteira entre 0 e 100.000.");
    return ok({ nome, apresentacao, categoria: corpo.categoria, receita: corpo.receita, preco: Math.round(preco * 100) / 100, quantidade: qtd });
  }

  function responsavel(valor) {
    const nome = texto(valor, { min: 2, max: 60 });
    return nome ? ok(nome) : erro("Informe o nome do responsável (2 a 60 letras).");
  }

  return { texto, email, telefone, senhaForte, cadastro, login, pedido, quantidadeEstoque, novoMedicamento, responsavel };
});
