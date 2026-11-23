# Dose Certa

Site para encontrar medicamentos nas farmácias do Distrito Federal, comparar preços e escolher entre retirar na loja ou receber em casa. Tem o app do cliente, o portal da farmácia e um back-end com banco de dados.

**Acesse online:** https://joaosilva2906.github.io/dosecerta/

Conta de teste do cliente: `demo@dosecerta.app` · senha `Dose1234`
Contas de teste das farmácias na API: `farmacia1@dosecerta.app` até `farmacia8@dosecerta.app` · senha `Farma1234`

> **Situação atual:** o back-end, o banco e a API estão prontos e testados. As telas ainda salvam os dados no navegador; a ligação delas com a API está em andamento (camada `frontend/js/servico.js`).

## Arquitetura

O projeto é dividido em três partes:

```
dosecerta/
├── frontend/          o que roda no navegador (telas)
│   ├── index.html       página inicial
│   ├── cliente.html     app do cliente
│   ├── farmacia.html    portal da farmácia
│   ├── css/             estilos (um arquivo por página + mapa + acessibilidade)
│   ├── js/              comportamento das telas, mapa e painel de acessibilidade
│   └── img/
├── compartilhado/     regras de negócio usadas pelo navegador E pelo servidor
│   ├── regras.js        preço, frete, horário, etapas do pedido
│   ├── validacao.js     validação de tudo que o usuário envia
│   └── dados-iniciais.js catálogo, farmácias e dados de exemplo
├── backend/           servidor (Node.js) e banco de dados (SQLite)
│   ├── servidor.js      ponto de entrada: API + arquivos do front-end
│   ├── rotas.js         endereços da API e quem pode acessar cada um
│   ├── servicos/        regras do servidor: contas, pedidos, estoque
│   ├── banco/           schema.sql, repositório (SQL) e dados iniciais
│   ├── seguranca/       senhas, sessões, limite de tentativas, cabeçalhos
│   ├── http/            leitura de JSON, arquivos estáticos, erros
│   └── scripts/         resetar-banco.js
├── package.json
└── .env.example       configurações do servidor
```

Camadas do back-end: **rotas** (HTTP e permissão) → **serviços** (regras de negócio) → **repositório** (SQL) → **banco SQLite**.

A pasta `compartilhado/` garante que o cálculo de preço, frete e a validação sejam os mesmos na tela e no servidor. O servidor nunca aceita preço ou total vindo do navegador: recalcula tudo.

## Como rodar

**Só o site (sem servidor):** abra `frontend/index.html` no navegador, ou use o link do GitHub Pages. Os dados ficam salvos no próprio navegador.

**Com back-end e banco de dados** (precisa do Node.js 22.13 ou mais novo, sem instalar pacotes):

```bash
npm start
# abra http://localhost:3000
```

O banco é criado sozinho em `backend/dados/dosecerta.db` na primeira vez. Outros comandos:

```bash
npm run resetar   # apaga o banco e recria com os dados iniciais
```

## API

| Método | Endereço | Quem pode |
| --- | --- | --- |
| GET | `/api/catalogo` | todos |
| POST | `/api/conta/cadastro`, `/api/conta/entrar`, `/api/conta/visitante`, `/api/conta/sair` | todos |
| GET | `/api/pedidos` · POST `/api/pedidos` · POST `/api/pedidos/:id/cancelar` | cliente (só os próprios pedidos) |
| POST | `/api/farmacia/entrar` | todos |
| GET | `/api/farmacia/pedidos` · POST `/api/farmacia/pedidos/:id/avancar` e `/recusar` | farmácia (só pedidos da sua unidade) |
| PUT | `/api/farmacia/estoque/:id` · POST `/api/farmacia/medicamentos` | farmácia |

## Segurança

- **Senhas** guardadas com scrypt e sal aleatório (nunca em texto). Comparação em tempo constante.
- **Sessão** por cookie `HttpOnly` (JavaScript não lê) e `SameSite=Strict`. No banco fica só o hash do token.
- **Permissões** checadas no servidor: cliente só vê e cancela os próprios pedidos; farmácia só mexe nos pedidos e no estoque da própria unidade. Pedido de outra pessoa responde "não encontrado".
- **Preços e totais** sempre recalculados no servidor; estoque baixado na mesma transação que confirma o pedido.
- **SQL injection:** todas as consultas usam parâmetros.
- **Validação** de tipo, tamanho e formato de todos os campos (`compartilhado/validacao.js`), com restrições também no banco (`CHECK`, chaves estrangeiras).
- **Força bruta:** limite de tentativas de login por IP e por e-mail, limite de cadastros e de pedidos.
- **CSRF:** alterações só aceitas em JSON e vindas do próprio site.
- **Cabeçalhos:** Content-Security-Policy, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy.
- **Arquivos:** o servidor só entrega `frontend/` e `compartilhado/`; bloqueia `..` e arquivos ocultos.
- **Erros** técnicos só aparecem no terminal, nunca na resposta.
- **Nada sensível no Git:** o banco e o `.env` estão no `.gitignore`. As contas de teste são públicas de propósito; em produção use `CONTAS_TESTE=0` e `COOKIE_SEGURO=1` com HTTPS.

## Acessibilidade

O botão azul no canto da tela (ou **Alt + A**) abre o painel de acessibilidade, em todas as páginas:

| Opção | Ajuda quem |
| --- | --- |
| Tamanho do texto (até 150%) | baixa visão, pessoas idosas |
| Alto contraste · Modo escuro | baixa visão, sensibilidade à luz |
| Tons de cinza | daltonismo, sensibilidade a cores |
| Fonte legível · Mais espaçamento | dislexia, baixa visão |
| Destacar links e botões | baixa visão, dificuldade cognitiva |
| Botões maiores · Cursor grande | tremores, Parkinson, artrite, pessoas idosas |
| Guia de leitura · Modo simplificado | dislexia, TDAH, dificuldade de concentração |
| Parar animações | epilepsia fotossensível, enjoo de movimento, TDAH |
| Leitura em voz alta · Ler esta tela | baixa visão, cegueira, dificuldade de leitura |
| Tradutor de Libras (VLibras, do Governo Federal) | pessoas surdas |

Também há link "Pular para o conteúdo", navegação completa por teclado, textos alternativos e marcação para leitores de tela. As escolhas ficam salvas no aparelho.

## Serviços externos

[Leaflet](https://leafletjs.com/) (mapas), mapas da Esri e do [OpenStreetMap](https://www.openstreetmap.org/), [ViaCEP](https://viacep.com.br/) (endereço pelo CEP), [Nominatim](https://nominatim.org/) (localizar endereço) e [VLibras](https://www.gov.br/governodigital/pt-br/vlibras) (Libras).

## Licença

MIT. Veja [LICENSE](LICENSE).
