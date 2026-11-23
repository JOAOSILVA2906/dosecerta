# Dose Certa

Site para encontrar medicamentos nas farmácias do Distrito Federal, comparar preços e escolher entre retirar na loja ou receber em casa. Tem duas partes: o app do cliente e o portal da farmácia, que funcionam juntos.

**Acesse online:** https://joaosilva2906.github.io/dosecerta/

## Páginas

| Página | O que tem |
| --- | --- |
| [`index.html`](index.html) | Página inicial com busca, como funciona e mapa das farmácias parceiras |
| [`cliente.html`](cliente.html) | Login e cadastro, catálogo com 45 medicamentos, mapa das farmácias, compra com retirada ou entrega, acompanhamento do pedido |
| [`farmacia.html`](farmacia.html) | Pedidos em tempo real, estoque, clientes, mapa de entregas, relatório do dia (CSV/PDF) e configurações |

Conta de teste do cliente: `demo@dosecerta.app` · senha `Dose1234` (também dá para criar uma conta ou entrar sem cadastro).

## Como testar o fluxo completo

1. Abra `cliente.html` em uma aba e `farmacia.html` em outra.
2. No cliente, busque um medicamento, escolha a farmácia **Farmácia Central** e finalize o pedido.
3. O pedido aparece na hora no portal da farmácia. Clique em **Confirmar pedido** e depois em **Despachar entrega** ou **Liberar para retirada**.
4. A tela de acompanhamento do cliente atualiza sozinha, com o entregador andando no mapa.

Se ninguém mexer no portal, a farmácia avança o pedido automaticamente depois de alguns segundos.

## Funcionalidades

- Mapa real (OpenStreetMap) com as farmácias, distância calculada a partir da sua localização e link de rota no Google Maps
- Preço e estoque diferentes em cada farmácia, horário de funcionamento (aberta/fechada agora) e avaliação
- Busca sem diferenciar acentos, filtro por categoria e ordenação por distância, preço ou avaliação
- CEP preenche o endereço sozinho (ViaCEP) e a taxa de entrega é calculada pela distância
- Envio de receita para medicamentos de tarja vermelha e antibióticos
- Pagamento por Pix, cartão ou dinheiro com troco
- Código de retirada, notificações e histórico de pedidos
- Portal: baixa automática do estoque ao confirmar pedido, cadastro de medicamentos (aparece na busca do cliente), mapa das entregas e relatório exportável
- Layout responsivo para celular, tablet e computador

## Estrutura

```
dosecerta/
├── index.html        página inicial
├── cliente.html      app do cliente
├── farmacia.html     portal da farmácia
├── css/
│   ├── inicio.css
│   ├── cliente.css
│   ├── farmacia.css
│   └── mapa.css      marcadores do mapa (usado pelas três páginas)
├── js/
│   ├── dados.js      catálogo, farmácias, estoque e pedidos (compartilhado)
│   ├── mapa.js       funções do mapa
│   ├── inicio.js
│   ├── cliente.js
│   └── farmacia.js
└── img/
    └── favicon.svg
```

## Tecnologias

HTML, CSS e JavaScript puro. Bibliotecas e serviços externos:

- [Leaflet](https://leafletjs.com/) para os mapas, com mapas do [OpenStreetMap](https://www.openstreetmap.org/)
- [ViaCEP](https://viacep.com.br/) para buscar o endereço pelo CEP
- [Nominatim](https://nominatim.org/) para localizar o endereço no mapa

Os mapas e o CEP precisam de internet. O resto funciona offline.

## Rodar no computador

Basta abrir o `index.html` no navegador. Para a localização funcionar, é melhor servir os arquivos:

```bash
python -m http.server 8000
# depois abra http://localhost:8000
```

## Observações

Não existe servidor: contas, pedidos e estoque ficam salvos no `localStorage` do navegador. Por isso o cliente e a farmácia só se enxergam no mesmo navegador. Para voltar ao estado inicial, use **Configurações → Restaurar dados iniciais** no portal da farmácia.

## Licença

MIT. Veja [LICENSE](LICENSE).
