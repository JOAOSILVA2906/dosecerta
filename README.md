# Dose Certa — protótipo

> Busca de medicamentos em farmácias próximas, com retirada no balcão ou entrega. Protótipo acadêmico com duas interfaces: a **área do cliente** e o **portal da farmácia**.

Front-end feito com **HTML, CSS e JavaScript puro**, sem frameworks, bibliotecas ou back-end. Os dados são fictícios.

## Como abrir

Abra o [`index.html`](index.html) no navegador e escolha uma das áreas. Também dá pra abrir cada uma direto:

| Área | Arquivo | O que faz |
| --- | --- | --- |
| Cliente | [`cliente/dose.html`](cliente/dose.html) | Login/cadastro demo, busca de medicamentos, mapa de farmácias, retirada ou entrega e acompanhamento do pedido |
| Farmácia | [`farmacia/farmacia.html`](farmacia/farmacia.html) | Estoque, pedidos, clientes, entregas, relatório (CSV/PDF) e configurações |

Login de teste na área do cliente: `demo@dosecerta.app` · senha `Dose1234`.

Para servir localmente:

```bash
python -m http.server 8000
# depois abra http://localhost:8000
```

## Estrutura

```
dosecerta/
├── index.html            página inicial (escolha da área)
├── cliente/
│   ├── dose.html         telas e ícones
│   ├── dose.css          estilos e responsividade
│   ├── dose.js           busca, navegação e pedidos simulados
│   └── README.md
├── farmacia/
│   ├── farmacia.html     painel e diálogos
│   ├── farmacia.css      estilos e responsividade
│   ├── farmacia.js       estoque, pedidos e relatórios
│   └── README.md
├── LICENSE
└── README.md
```

Cada pasta tem um README com mais detalhes.

## Limites

- As duas áreas **não estão conectadas**: um pedido feito no cliente não aparece na farmácia.
- Cliente: pedidos e cadastros ficam só na memória da aba e somem ao recarregar.
- Farmácia: as alterações ficam no `localStorage` do navegador.
- Sem pagamentos, estoque real ou autenticação de verdade. Para produção seria preciso um serviço no servidor.

## Licença

MIT — veja [LICENSE](LICENSE).
