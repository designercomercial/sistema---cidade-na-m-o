# Cidade na Mão · Monitoramento (demonstração)

Sistema da prefeitura para acompanhar, em tempo real, as solicitações que os cidadãos fazem pelo app.

## Como iniciar

1. Dê dois cliques em **iniciar.bat**. O sistema abre em `http://localhost:3000` na tela de login (demonstração: qualquer e-mail e senha entram; **Sair** fica no fim do menu).
2. Para mostrar uma solicitação chegando ao vivo, abra o app em `http://<ip-do-computador>:3000/app.html` num celular na mesma rede Wi-Fi (ou em outra janela do computador) e use **Solicitar serviço**. A solicitação aparece no sistema destacada, com aviso e som.

Requisito: Node.js 18 ou mais recente. Não precisa instalar pacotes.

## Módulos

| Menu | O que mostra |
|---|---|
| Painel | Recebidas hoje, aguardando, em andamento, resolvidas, cidadãos com o app; gráfico por mês; rankings por secretaria e bairro; últimas solicitações |
| Solicitações | Todas as solicitações com busca, filtros (secretaria, bairro, tipo, situação), ordenação, exportação e detalhe |
| Cidadãos | Cidadãos cadastrados no app |
| Configurações | Município, tema, som, simulação e reinício da demonstração |

O sistema só visualiza: a situação das solicitações é atualizada pelas secretarias, fora deste painel.
Os dados (bairros, cidadãos e solicitações) são fictícios.
