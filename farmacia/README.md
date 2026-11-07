# Dose Certa · Portal da farmácia

Abra `farmacia.html` em um navegador atualizado. Os estilos estão em `farmacia.css` e o comportamento em `farmacia.js`, sem bibliotecas externas.

O painel segue a identidade visual de `../cliente`: vinho, tons claros, marca com coração, menu lateral e componentes responsivos. No celular, os medicamentos aparecem em cartões com quantidade editável.

## Estoque

- Cadastre medicamentos com nome, apresentação e quantidade.
- Edite as caixas disponíveis e clique em Salvar. Zero indica indisponibilidade.
- Busque por medicamento ou apresentação e filtre por disponibilidade.
- Os indicadores e o resumo acompanham as alterações.
- Confirmar um pedido reserva uma caixa. A confirmação é bloqueada quando o item está sem estoque.

Também há pedidos simulados, clientes, entregas, relatórios CSV/PDF e configurações. As alterações ficam no armazenamento local do navegador; se ele bloquear a gravação, o painel avisa. Reiniciar a demonstração pede confirmação e restaura os exemplos.

Este painel ainda não está conectado à área do cliente e não altera estoques reais. Cada navegador mantém seus próprios dados demonstrativos. Autenticação, sincronização entre usuários e estoque real precisam de um serviço no servidor.
