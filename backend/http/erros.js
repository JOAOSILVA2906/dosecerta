// Erro com código HTTP. A mensagem é mostrada ao usuário, então nunca coloque detalhes internos nela.
class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

const falha = (status, mensagem) => {
  throw new ErroHttp(status, mensagem);
};

module.exports = { ErroHttp, falha };
