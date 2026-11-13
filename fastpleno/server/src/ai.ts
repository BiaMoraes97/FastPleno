// IA que LÊ a prova enviada pelo professor e devolve as questões organizadas (JSON).
// Depois o template.ts transforma esse JSON na prova no modelo do colégio.
import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import { config } from "./config";

export interface Question {
  number: number;
  type: "multipla_escolha" | "discursiva";
  statement: string; // enunciado
  options?: string[]; // alternativas (sem a letra)
  answerLines?: number; // linhas para resposta (discursiva)
  points?: number;
}

export interface ExamData {
  instructions?: string; // orientações gerais ao aluno
  questions: Question[];
}

// ===== INSTRUÇÕES DA IA — edite aqui para mudar o comportamento da formatação =====
const SYSTEM_PROMPT = `Você é o assistente de formatação de provas do FastPleno.
Você recebe as questões enviadas por um professor (texto de um .docx ou foto das folhas)
e deve organizá-las em JSON para o sistema montar a prova no modelo oficial do colégio.

REGRAS:
- Não invente, remova nem reordene questões. Não mude o conteúdo; corrija só erros evidentes de digitação.
- Questão com alternativas = "multipla_escolha". Coloque cada alternativa em "options" SEM a letra (sem "a)", "B." etc.).
- Questão sem alternativas = "discursiva". Estime "answerLines" (de 3 a 10) conforme o tamanho da resposta esperada.
- Se o professor indicou valor da questão, preencha "points". Se não, omita.
- Se houver orientações gerais para o aluno, coloque em "instructions". Se não, omita.
- Numere as questões a partir de 1.
- Responda SOMENTE com JSON válido, sem markdown e sem comentários, neste formato:
{"instructions":"...","questions":[{"number":1,"type":"multipla_escolha","statement":"...","options":["...","..."],"points":1},{"number":2,"type":"discursiva","statement":"...","answerLines":5}]}`;

// Prova de exemplo usada quando MOCK_AI=true (para testar sem gastar a API).
const MOCK_EXAM: ExamData = {
  instructions: "Leia com atenção. Use caneta azul ou preta. Não é permitido o uso de corretivo.",
  questions: [
    { number: 1, type: "multipla_escolha", statement: "Qual é o resultado de 7 x 8?", options: ["54", "56", "58", "64"], points: 1 },
    { number: 2, type: "discursiva", statement: "Explique com suas palavras o que é fotossíntese.", answerLines: 5, points: 2 },
  ],
};

export async function extractExam(filePath: string, originalName: string): Promise<ExamData> {
  if (config.mockAi) return MOCK_EXAM;
  if (!config.anthropicKey) throw new Error("Defina ANTHROPIC_API_KEY no arquivo .env do servidor.");

  const ext = path.extname(originalName).toLowerCase();
  const content: Anthropic.ContentBlockParam[] = [];

  if (ext === ".docx") {
    // .docx: extraímos o texto e enviamos para a IA.
    // (Figuras dentro do .docx não são extraídas nesta versão.)
    const { value } = await mammoth.extractRawText({ path: filePath });
    content.push({ type: "text", text: `Questões enviadas pelo professor:\n\n${value}` });
  } else {
    // Foto das folhas: a IA lê a imagem diretamente.
    const mediaType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: fs.readFileSync(filePath).toString("base64") },
    });
    content.push({ type: "text", text: "Estas são as folhas com as questões. Extraia e organize." });
  }

  const client = new Anthropic({ apiKey: config.anthropicKey });
  const response = await client.messages.create({
    model: config.model,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  return parseExam(text);
}

/** Converte a resposta da IA em ExamData (tolera ```json e textos antes/depois). */
function parseExam(text: string): ExamData {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("A IA não devolveu um formato válido. Tente formatar de novo.");
  const data = JSON.parse(text.slice(start, end + 1)) as ExamData;
  if (!Array.isArray(data.questions) || data.questions.length === 0)
    throw new Error("A IA não encontrou questões no arquivo enviado.");
  return data;
}
