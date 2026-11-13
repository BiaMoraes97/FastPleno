# FastPleno — Gestão e formatação inteligente de avaliações

Professores enviam as questões (.docx ou foto das folhas), a IA formata no modelo do colégio e a
direção revisa, aprova e imprime. Tem chat privado professor ↔ direção.

**Stack:** React + TypeScript (Vite) no `client/` · Node.js + Express + TypeScript no `server/`.

## Como rodar

Você precisa do Node.js 18+ instalado. Abra **dois terminais**:

```bash
# Terminal 1 — servidor (porta 3001)
cd server
npm install
cp .env.example .env      # no Windows: copy .env.example .env
npm run dev

# Terminal 2 — site (porta 5173)
cd client
npm install
npm run dev
```

Abra http://localhost:5173. Contas de teste (botão "Contas de demonstração" no login):
`professor@fastpleno.demo` e `direcao@fastpleno.demo`, senha `demo123`.

## IA de formatação

1. Crie uma chave em https://console.anthropic.com e coloque em `server/.env` → `ANTHROPIC_API_KEY=`.
2. Sem chave? Use `MOCK_AI=true` no `.env`: o sistema gera uma prova de exemplo para você testar o fluxo.

Como funciona: `ai.ts` lê o arquivo e pede à IA um JSON com as questões → `template.ts` monta o .docx.

## Onde mexer para alterar cada coisa

| Quero mudar...                         | Arquivo                                   |
|----------------------------------------|-------------------------------------------|
| Textos da página inicial               | `client/src/pages/Landing.tsx` (objeto `TEXT`) |
| Cores e visual                         | `client/src/styles.css` (bloco `:root`)   |
| Modelo da prova (cabeçalho, fonte...)  | `server/src/template.ts` (objeto `MODEL`) |
| Regras/instruções da IA                | `server/src/ai.ts` (`SYSTEM_PROMPT`)      |
| Etapas do quadro de provas             | `client/src/components/Exams.tsx` (`COLUMNS`) e `server/src/db.ts` (`ExamStatus`) |
| Código da direção, chave da IA, modelo | `server/.env`                             |

## Limitações desta versão (e próximos passos)

- **Banco de dados em arquivo JSON** (`server/data/db.json`): simples para começar. Para uso real, migre para MySQL/PostgreSQL.
- **Figuras dentro do .docx** não são extraídas; só o texto. Fotos das folhas são lidas pela IA normalmente.
- **Chat por atualização a cada 4 s** (polling). Para tempo real, use Socket.IO.
- Antes de publicar: `ENABLE_DEMO=false`, troque `JWT_SECRET` e `DIRECTION_CODE`, use HTTPS.
- Publicar: `cd client && npm run build`; depois, em `server`, `npm run build && npm start` — o Node serve o site também.
