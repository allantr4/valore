# Valore - Regras de Desenvolvimento

## Plano Detalhado de Implementação
Em toda e qualquer solicitação do usuário, você DEVE OBRIGATORIAMENTE gerar primeiro um plano detalhado de implementação para aprovação do usuário antes de executar quaisquer alterações definitivas no código.

## Atualização Automática do Instalador
Sempre que qualquer alteração de código, correção de bug, ajuste visual ou nova funcionalidade for finalizada no projeto do Valore, você DEVE OBRIGATORIAMENTE atualizar o Instalador oficial do aplicativo localizado em:
`E:\Gestor Financeiro\Instalador\Instalador Valore Financeiro.exe`

## Paridade e Sincronização Obrigatória com o Mobile Android
A partir de agora, qualquer alteração, correção ou nova funcionalidade criada para o desktop deve ser automaticamente aplicada e sincronizada no projeto mobile Android em:
`E:\Gestor Financeiro\Android`

## Geração Obrigatória do Arquivo .APK para Instalação Direta
Sempre disponibilizar o arquivo `.apk` oficial em:
- `E:\Gestor Financeiro\Android\Valore.apk`
- `E:\Gestor Financeiro\Instalador\Valore.apk`

## Análise Contínua e Testes de Enquadramento (Mobile & Desktop)
Em qualquer ajuste visual, criação ou refatoração de telas, componentes, formulários, modais, tabelas ou carrosséis, você DEVE OBRIGATORIAMENTE realizar uma análise e validação minuciosa de enquadramento e responsividade nos dois ambientes:
1. **Mobile Vertical (360px a 430px)**: Garantir que nenhum elemento estoure horizontalmente (`overflow-x: hidden`), botões de ação e rodapés fiquem 100% visíveis e confortáveis ao toque (ergonomia do polegar), e modais caibam na altura da tela respeitando safe areas e barras do sistema Android sem cortar ações primárias.
2. **Desktop & Modo Janela (800px a 1920px)**: Manter proporções harmoniosas, alinhamento flexível e ausência de scrolls horizontais acidentais ou quebras visuais desconexas.

