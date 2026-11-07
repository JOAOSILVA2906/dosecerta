# Dose Certa

Protótipo de busca de medicamentos e simulação de retirada ou entrega.

## Executar

Abra `dose.html` em um navegador atualizado e mantenha os arquivos na mesma pasta. Sem instalação de bibliotecas ou servidor.

## Arquivos

- `dose.html`: estrutura, telas e ícones vetoriais.
- `dose.css`: estilos e responsividade.
- `dose.js`: busca, navegação e pedidos simulados.

O JavaScript carrega com `defer` e guarda o estado em escopo privado. A busca aceita termos em qualquer ordem, sem distinguir maiúsculas ou acentos.

## Limites

Dados e mapa fictícios. Sem pagamentos, consulta de estoque real ou envio de pedidos. Os pedidos ficam em memória e desaparecem ao recarregar ou fechar a página.

## Acesso demonstrativo

A entrada oferece login, cadastro e acesso como visitante. Para testar o login, use `demo@dosecerta.app` e a senha `Dose1234`. Cadastros fictícios ficam apenas na memória desta aba; as senhas são convertidas em um resumo SHA-256 e não são persistidas. Isso não substitui autenticação de produção. A recuperação de senha explica o acesso demo e não envia e-mails.

O perfil permite consultar os pedidos e sair. A saída apaga os pedidos e endereços da sessão. O sino mostra o estado atual dos pedidos simulados. Para produção, login e cadastro precisam de um serviço de autenticação e armazenamento no servidor.

## Layout responsivo

O mesmo `dose.html` adapta a interface à largura disponível. Celulares usam navegação inferior; tablets ganham mais espaço; a partir de 900 px, a entrada tem duas colunas e a área interna usa menu lateral, busca com atalhos ao lado e mapa junto da lista de farmácias. Não é necessário manter versões separadas do código.
