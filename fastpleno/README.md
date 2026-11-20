# FastPleno

Sistema interno do **Colégio Pleno** para envio, formatação automatizada com Inteligência Artificial (Google Gemini) e gerenciamento de provas escolares no padrão visual da instituição.

## Funcionalidades

- **Envio de provas:** Professores enviam arquivos `.docx` ou imagens com os metadados da avaliação (disciplina, série, unidade/bimestre e data de aplicação).
- **Extração inteligente com IA:** Leitura automática das questões, alternativas e imagens embutidas via Google Gemini, preservando o conteúdo e a quantidade exata de questões.
- **Diagramação automática (`.docx`):** Geração do documento pronto para impressão com:
  - Cabeçalho oficial com a logo do Colégio Pleno, identificação do professor, série, campo de nota com divisória, nome do aluno e data.
  - Layout em 2 colunas com linha divisória vertical.
  - Fonte **Arial 10pt** (com ajuste automático para **9pt** quando há quebra de poucas linhas em página ímpar) e margens padronizadas (`0.1"` no topo da 1ª página e `0.5"` nas demais).
- **Fluxo de impressão:** Acompanhamento de status (*Aguardando formatação*, *Formatadas/Aguardando Análise* e *Impressas*).

## Tecnologias Utilizadas

- **Front-end:** React, TypeScript, Vite
- **Back-end:** Node.js, Express, TypeScript
- **IA & Documentos:** `@google/genai` (Google Gemini), `mammoth`, `docx`

## Como Executar Localmente

### 1. Configurar variáveis de ambiente
Na pasta `fastpleno/server`, copie o arquivo `.env.example` para `.env` e preencha sua chave da API do Gemini:

```env
GEMINI_API_KEY=sua_chave_aqui