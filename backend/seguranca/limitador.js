// Limita quantas vezes algo pode acontecer numa janela de tempo (ex.: tentativas de login),
// para dificultar ataques de força bruta e abuso da API.
function criarLimitador({ maximo, janelaMs }) {
  const registros = new Map();

  function limpar(chave, agora) {
    const lista = (registros.get(chave) || []).filter(t => agora - t < janelaMs);
    if (lista.length) registros.set(chave, lista);
    else registros.delete(chave);
    return lista;
  }

  return {
    // true = pode continuar; false = passou do limite
    permitir(chave) {
      const agora = Date.now();
      const lista = limpar(chave, agora);
      if (lista.length >= maximo) return false;
      lista.push(agora);
      registros.set(chave, lista);
      return true;
    },
    bloqueado(chave) {
      return limpar(chave, Date.now()).length >= maximo;
    },
    registrar(chave) {
      const lista = limpar(chave, Date.now());
      lista.push(Date.now());
      registros.set(chave, lista);
    },
    zerar(chave) {
      registros.delete(chave);
    },
    // evita crescer para sempre na memória
    faxina() {
      const agora = Date.now();
      for (const chave of registros.keys()) limpar(chave, agora);
    }
  };
}

module.exports = { criarLimitador };
