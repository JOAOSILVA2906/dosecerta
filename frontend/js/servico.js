// Camada de dados do front-end. As telas chamam estas funções sem saber onde os dados ficam:
//  - modo "servidor": quando o back-end está rodando, tudo passa pela API e fica no banco SQLite;
//  - modo "local": sem servidor (arquivo aberto direto ou GitHub Pages), os dados ficam no navegador.
// As regras (preço, frete, validação) vêm de compartilhado/, as mesmas usadas pelo servidor.
window.Servico = (() => {
  "use strict";

  const R = window.Regras;
  const V = window.Validacao;
  const Dados = window.DadosIniciais;

  class ErroServico extends Error {
    constructor(mensagem, status = 400) {
      super(mensagem);
      this.status = status;
    }
  }

  /* ======================= modo servidor ======================= */

  function criarServidor() {
    async function chamar(caminho, { metodo = "GET", corpo } = {}) {
      let resposta;
      try {
        resposta = await fetch(`/api${caminho}`, {
          method: metodo,
          credentials: "same-origin",
          headers: corpo !== undefined ? { "Content-Type": "application/json" } : {},
          body: corpo !== undefined ? JSON.stringify(corpo) : undefined
        });
      } catch {
        throw new ErroServico("Sem conexão com o servidor. Verifique sua internet.", 0);
      }
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new ErroServico(dados.erro || "Não foi possível concluir. Tente novamente.", resposta.status);
      return dados;
    }

    return {
      modo: "servidor",
      catalogo: () => chamar("/catalogo"),
      conta: async () => (await chamar("/conta")).usuario,
      cadastrar: async corpo => (await chamar("/conta/cadastro", { metodo: "POST", corpo })).usuario,
      entrar: async corpo => (await chamar("/conta/entrar", { metodo: "POST", corpo })).usuario,
      entrarFarmacia: async corpo => (await chamar("/farmacia/entrar", { metodo: "POST", corpo })).usuario,
      entrarVisitante: async () => (await chamar("/conta/visitante", { metodo: "POST", corpo: {} })).usuario,
      sair: () => chamar("/conta/sair", { metodo: "POST", corpo: {} }),
      endereco: async () => (await chamar("/conta/endereco")).endereco,
      marcarLidas: () => chamar("/conta/notificacoes-lidas", { metodo: "POST", corpo: {} }),
      meusPedidos: () => chamar("/pedidos"),
      criarPedido: corpo => chamar("/pedidos", { metodo: "POST", corpo }),
      cancelarPedido: id => chamar(`/pedidos/${id}/cancelar`, { metodo: "POST", corpo: {} }),
      versao: async () => (await chamar("/versao")).versao,
      pedidosFarmacia: async () => (await chamar("/farmacia/pedidos")).pedidos,
      avancarPedido: async id => (await chamar(`/farmacia/pedidos/${id}/avancar`, { metodo: "POST", corpo: {} })).pedido,
      recusarPedido: async id => (await chamar(`/farmacia/pedidos/${id}/recusar`, { metodo: "POST", corpo: {} })).pedido,
      definirEstoque: (medId, quantidade) => chamar(`/farmacia/estoque/${medId}`, { metodo: "PUT", corpo: { quantidade } }),
      adicionarMedicamento: corpo => chamar("/farmacia/medicamentos", { metodo: "POST", corpo }),
      salvarResponsavel: async nome => (await chamar("/farmacia/responsavel", { metodo: "PUT", corpo: { nome } })).usuario,
      reiniciar: async () => { throw new ErroServico("Com servidor, restaure o banco pelo terminal: npm run resetar", 403); }
    };
  }

  /* ======================= modo local ======================= */

  function criarLocal() {
    const PREFIXO = "dosecerta:v3:";
    const memoria = new Map();
    let usaMemoria = false;
    try {
      localStorage.setItem(PREFIXO + "teste", "1");
      localStorage.removeItem(PREFIXO + "teste");
    } catch {
      usaMemoria = true;
    }

    const ler = (chave, padrao) => {
      try {
        const texto = usaMemoria ? memoria.get(chave) : localStorage.getItem(PREFIXO + chave);
        return texto == null ? padrao : JSON.parse(texto);
      } catch {
        return padrao;
      }
    };
    const gravar = (chave, valor) => {
      const texto = JSON.stringify(valor);
      if (usaMemoria) memoria.set(chave, texto);
      else localStorage.setItem(PREFIXO + chave, texto);
    };
    const remover = chave => (usaMemoria ? memoria.delete(chave) : localStorage.removeItem(PREFIXO + chave));
    const mudou = () => gravar("versao", ler("versao", 0) + 1);
    const erro = (mensagem, status = 400) => { throw new ErroServico(mensagem, status); };

    // apaga dados de versões antigas do site
    if (!usaMemoria) {
      Object.keys(localStorage)
        .filter(c => (c.startsWith("dosecerta:") && !c.startsWith(PREFIXO) && c !== "dosecerta:localizacao" && !c.startsWith("dosecerta:a11y")) || c === "dose-certa-farmacia-v1")
        .forEach(c => localStorage.removeItem(c));
    }

    /* ----- catálogo ----- */

    const medicamentos = () => Dados.medicamentos.concat(ler("extras", []));
    const medicamento = id => medicamentos().find(m => m.id === Number(id)) || null;
    const farmacia = id => Dados.farmacias.find(f => f.id === Number(id)) || null;
    const estoqueDe = (fid, mid) => {
      const valor = ler("estoque", {})[fid]?.[mid];
      return Number.isInteger(valor) ? valor : Dados.estoqueInicial(fid, mid);
    };
    function definirEstoqueInterno(fid, mid, qtd) {
      const ajustes = ler("estoque", {});
      (ajustes[fid] ??= {})[mid] = qtd;
      gravar("estoque", ajustes);
    }

    function catalogo() {
      const estoque = {};
      const lista = medicamentos();
      Dados.farmacias.forEach(f => {
        estoque[f.id] = {};
        lista.forEach(m => { estoque[f.id][m.id] = estoqueDe(f.id, m.id); });
      });
      return { categorias: Dados.categorias, medicamentos: lista, farmacias: Dados.farmacias, estoque };
    }

    /* ----- pedidos ----- */

    const pedidos = () => ler("pedidos", null) ?? popular();
    const salvarPedidos = lista => { gravar("pedidos", lista); mudou(); };

    function popular() {
      const ctx = { farmacia, medicamento };
      const lista = Dados.pedidosIniciais().map(exemplo => {
        const p = R.montarPedidoInicial(exemplo, ctx);
        p.clienteId = p.clienteEmail || null;
        return p;
      });
      gravar("pedidos", lista);
      return lista;
    }

    function aplicarAvanco(p, quando) {
      const proximo = R.proximoStatus(p);
      if (!proximo) return { ok: false, erro: "Este pedido já foi finalizado." };
      if (p.status === "pendente") {
        if (p.itens.some(i => estoqueDe(p.farmaciaId, i.medId) < i.qtd)) {
          return { ok: false, semEstoque: true, erro: "Sem estoque suficiente para confirmar. Atualize o estoque antes." };
        }
        p.itens.forEach(i => definirEstoqueInterno(p.farmaciaId, i.medId, estoqueDe(p.farmaciaId, i.medId) - i.qtd));
      }
      p.status = proximo;
      p.historico[proximo] = quando;
      return { ok: true };
    }

    function processarFila() {
      const lista = pedidos();
      const agora = Date.now();
      let alterou = false;
      lista.forEach(p => {
        if (!p.auto) return;
        while (R.DURACAO[p.status]) {
          const prazo = p.historico[p.status] + R.DURACAO[p.status];
          if (prazo > agora) break;
          const r = aplicarAvanco(p, prazo);
          if (!r.ok) {
            p.status = "cancelado";
            p.motivo = "Medicamento sem estoque suficiente na farmácia.";
            p.historico.cancelado = prazo;
          }
          alterou = true;
        }
      });
      if (alterou) salvarPedidos(lista);
    }

    /* ----- contas (senhas com PBKDF2 do próprio navegador) ----- */

    const bytesParaHex = buffer => Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, "0")).join("");
    async function derivar(senha, salHex) {
      if (!crypto?.subtle) erro("Este navegador não permite criar senhas com segurança. Use outro navegador ou continue sem cadastro.");
      const sal = new Uint8Array(salHex.match(/../g).map(h => parseInt(h, 16)));
      const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: 150000 }, chave, 256);
      return bytesParaHex(bits);
    }

    const sessao = () => ler("sessao", null);
    const iniciar = usuario => { gravar("sessao", usuario); return usuario; };
    const exigir = papeis => {
      const u = sessao();
      if (!u) erro("Entre na sua conta para continuar.", 401);
      if (!papeis.includes(u.papel)) erro("Você não tem permissão para isso.", 403);
      return u;
    };

    async function entrarCom(corpo, papel) {
      const v = V.login(corpo);
      if (!v.ok) erro("E-mail ou senha incorretos.", 401);
      const teste = Dados.contasTeste.find(c => c.email === v.dados.email && c.papel === papel);
      if (teste && teste.senha === v.dados.senha) {
        return iniciar({ id: teste.email, nome: teste.nome, email: teste.email, papel, farmaciaId: teste.farmaciaId ?? null, telefone: teste.telefone || "" });
      }
      const conta = ler("contas", {})[v.dados.email];
      if (papel === "cliente" && conta && await derivar(v.dados.senha, conta.sal) === conta.hash) {
        return iniciar({ id: v.dados.email, nome: conta.nome, email: v.dados.email, papel: "cliente", farmaciaId: null, telefone: conta.telefone || "" });
      }
      erro("E-mail ou senha incorretos.", 401);
    }

    function pedidoDoCliente(usuario, id) {
      const lista = pedidos();
      const p = lista.find(x => x.id === Number(id));
      if (!p || p.clienteId !== usuario.id) erro("Pedido não encontrado.", 404);
      return { lista, p };
    }

    function pedidoDaFarmacia(usuario, id) {
      const lista = pedidos();
      const p = lista.find(x => x.id === Number(id));
      if (!p || p.farmaciaId !== usuario.farmaciaId) erro("Pedido não encontrado.", 404);
      return { lista, p };
    }

    const local = {
      modo: "local",
      async catalogo() { return catalogo(); },
      async conta() { return sessao(); },

      async cadastrar(corpo) {
        const v = V.cadastro(corpo);
        if (!v.ok) erro(v.erro);
        const contas = ler("contas", {});
        if (contas[v.dados.email] || Dados.contasTeste.some(c => c.email === v.dados.email)) erro("Já existe uma conta com este e-mail. Use a aba Entrar.", 409);
        const sal = bytesParaHex(crypto.getRandomValues(new Uint8Array(16)));
        contas[v.dados.email] = { nome: v.dados.nome, sal, hash: await derivar(v.dados.senha, sal), criado: Date.now() };
        gravar("contas", contas);
        return iniciar({ id: v.dados.email, nome: v.dados.nome, email: v.dados.email, papel: "cliente", farmaciaId: null, telefone: "" });
      },
      entrar: corpo => entrarCom(corpo, "cliente"),
      entrarFarmacia: corpo => entrarCom(corpo, "farmacia"),
      async entrarVisitante() {
        const id = `visitante-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        return iniciar({ id, nome: "Visitante", email: "", papel: "visitante", farmaciaId: null, telefone: "" });
      },
      async sair() { remover("sessao"); },

      async endereco() {
        const u = exigir(["cliente", "visitante"]);
        return ler("enderecos", {})[u.id] || null;
      },
      async marcarLidas() {
        const u = exigir(["cliente", "visitante"]);
        const lidas = ler("lidas", {});
        lidas[u.id] = Date.now();
        gravar("lidas", lidas);
      },
      async meusPedidos() {
        const u = exigir(["cliente", "visitante"]);
        return {
          pedidos: pedidos().filter(p => p.clienteId === u.id).sort((a, b) => b.criado - a.criado),
          notificacoesLidas: ler("lidas", {})[u.id] || 0
        };
      },

      async criarPedido(corpo) {
        const u = exigir(["cliente", "visitante"]);
        const v = V.pedido(corpo);
        if (!v.ok) erro(v.erro);
        const agora = Date.now();
        const montado = R.montarPedido(v.dados, { farmacia: farmacia(v.dados.farmaciaId), medicamento, estoqueDe, agora });
        if (!montado.ok) erro(montado.erro, 422);
        const lista = pedidos();
        const pedido = {
          ...montado.pedido,
          id: Math.max(7842, ...lista.map(p => p.id)) + 1,
          clienteId: u.id,
          codigoRetirada: R.gerarCodigoRetirada(() => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32),
          motivo: null
        };
        lista.unshift(pedido);
        salvarPedidos(lista);

        const atualizado = { ...u, telefone: v.dados.telefone, nome: u.papel === "visitante" ? v.dados.nome : u.nome };
        iniciar(atualizado);
        if (v.dados.endereco) {
          const enderecos = ler("enderecos", {});
          enderecos[u.id] = v.dados.endereco;
          gravar("enderecos", enderecos);
        }
        return { pedido, usuario: atualizado };
      },

      async cancelarPedido(id) {
        const u = exigir(["cliente", "visitante"]);
        const { lista, p } = pedidoDoCliente(u, id);
        if (p.status !== "pendente") erro("A farmácia já confirmou este pedido. Para cancelar, ligue para a loja.", 409);
        p.status = "cancelado";
        p.motivo = "Cancelado por você.";
        p.historico.cancelado = Date.now();
        salvarPedidos(lista);
        return { pedido: p };
      },

      async versao() {
        processarFila();
        return ler("versao", 0);
      },

      async pedidosFarmacia() {
        const u = exigir(["farmacia"]);
        return pedidos().filter(p => p.farmaciaId === u.farmaciaId).sort((a, b) => b.criado - a.criado);
      },
      async avancarPedido(id) {
        const u = exigir(["farmacia"]);
        const { lista, p } = pedidoDaFarmacia(u, id);
        const r = aplicarAvanco(p, Date.now());
        if (!r.ok) erro(r.erro, 409);
        salvarPedidos(lista);
        return p;
      },
      async recusarPedido(id) {
        const u = exigir(["farmacia"]);
        const { lista, p } = pedidoDaFarmacia(u, id);
        if (p.status !== "pendente") erro("Só dá para recusar pedidos aguardando confirmação.", 409);
        p.status = "cancelado";
        p.motivo = "A farmácia não pôde atender este pedido.";
        p.historico.cancelado = Date.now();
        salvarPedidos(lista);
        return p;
      },
      async definirEstoque(medId, quantidade) {
        const u = exigir(["farmacia"]);
        if (!medicamento(medId)) erro("Medicamento não encontrado.", 404);
        const v = V.quantidadeEstoque(quantidade);
        if (!v.ok) erro(v.erro);
        definirEstoqueInterno(u.farmaciaId, Number(medId), v.dados);
        mudou();
        return { medId, quantidade: v.dados };
      },
      async adicionarMedicamento(corpo) {
        const u = exigir(["farmacia"]);
        const v = V.novoMedicamento(corpo, Dados.categorias.map(c => c.id));
        if (!v.ok) erro(v.erro);
        const ja = medicamentos().some(m => R.normalizar(m.nome) === R.normalizar(v.dados.nome) && R.normalizar(m.apresentacao) === R.normalizar(v.dados.apresentacao));
        if (ja) erro("Este medicamento já está no catálogo. Atualize a quantidade na lista.", 409);
        const extras = ler("extras", []);
        const novo = {
          id: Math.max(999, ...extras.map(m => m.id)) + 1,
          nome: v.dados.nome, apresentacao: v.dados.apresentacao, forma: "comprimido", categoria: v.dados.categoria,
          preco: Math.round(v.dados.preco / farmacia(u.farmaciaId).fator * 100) / 100, receita: v.dados.receita, generico: false
        };
        extras.push(novo);
        gravar("extras", extras);
        definirEstoqueInterno(u.farmaciaId, novo.id, v.dados.quantidade);
        mudou();
        return { medicamento: novo };
      },
      async salvarResponsavel(nome) {
        const u = exigir(["farmacia"]);
        const v = V.responsavel(nome);
        if (!v.ok) erro(v.erro);
        return iniciar({ ...u, nome: v.dados });
      },
      async reiniciar() {
        exigir(["farmacia"]);
        ["pedidos", "estoque", "extras", "lidas"].forEach(remover);
        mudou();
      }
    };
    return local;
  }

  /* ======================= escolha do modo ======================= */

  async function servidorDisponivel() {
    if (location.protocol === "file:") return false;
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), 2000);
    try {
      const r = await fetch("/api/saude", { signal: controle.signal, credentials: "same-origin" });
      return r.ok && (await r.json()).ok === true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  let instancia;
  async function iniciar() {
    instancia ??= (await servidorDisponivel()) ? criarServidor() : criarLocal();
    return instancia;
  }

  return { iniciar, ErroServico };
})();
