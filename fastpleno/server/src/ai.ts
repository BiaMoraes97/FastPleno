import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import { config } from "./config";

export interface ExtractedQuestion {
  number: number;
  supportTitle?: string;
  supportText?: string;
  statement: string;
  options?: { letter: string; text: string }[]; // A, B, C, D, E sem marca-texto
  imageIndex?: number;
}

export interface ExtractedExamData {
  questions: ExtractedQuestion[];
  images: { buffer: Buffer; extension: string }[];
}

const SYSTEM_PROMPT = `Você é um diagramador pedagógico especialista em avaliações escolares.
Extraia todas as questões do documento enviado e retorne APENAS um JSON válido no formato:
{
  "questions": [
    {
      "number": 1,
      "supportTitle": "Título opcional do texto base",
      "supportText": "Texto base opcional antes do enunciado",
      "statement": "Enunciado da questão",
      "options": [
        { "letter": "A", "text": "Texto da alternativa A" },
        { "letter": "B", "text": "Texto da alternativa B" }
      ],
      "imageIndex": 0
    }
  ]
}

REGRAS OBRIGATÓRIAS:
1. REMOVA TOTALMENTE qualquer indicação de gabarito: se alguma alternativa (A a E) tiver marca-texto, cor diferente, "(correta)", "X", asterisco ou negrito indicando a resposta certa, remova a marcação e deixe apenas o texto limpo da alternativa.
2. Remova também listas de "Gabarito:" no final do documento.
3. Preserve integralmente o texto das questões, acentuação, pontuação e numeração.`;

export async function extractExam(filePath: string, originalName: string): Promise<ExtractedExamData> {
  console.log("[IA] Iniciando extração do arquivo.");
  console.log("[IA] Lendo arquivo:", filePath);

  const ext = path.extname(originalName).toLowerCase();
  const extractedImages: { buffer: Buffer; extension: string }[] = [];

  if (config.mockAi) {
    console.log("[IA] Modo mock ativo; ignorando chamada à IA.");
    return {
      questions: [
        {
          number: 1,
          supportTitle: "TEXTO DE EXEMPLO (MODO MOCK)",
          supportText: "Este é um texto gerado em modo de simulação porque MOCK_AI=true.",
          statement: "Assinale a alternativa correta:",
          options: [
            { letter: "A", text: "Primeira alternativa limpa sem marca-texto." },
            { letter: "B", text: "Segunda alternativa limpa." },
            { letter: "C", text: "Terceira alternativa limpa." },
            { letter: "D", text: "Quarta alternativa limpa." },
          ],
        },
      ],
      images: [],
    };
  }

  if (!config.geminiApiKey) {
    throw new Error("Defina GEMINI_API_KEY no arquivo .env do servidor.");
  }

  const ai = new GoogleGenAI({
    apiKey: config.geminiApiKey,
    httpOptions: { timeout: 60_000 },
  });
  const parts: Array<string | { inlineData: { data: string; mimeType: string } }> = [];

  if (ext === ".docx") {
    console.log("[IA] Extraindo texto e imagens do documento DOCX...");
    const rawTextResult = await mammoth.extractRawText({ path: filePath });
    await mammoth.convertToHtml(
      { path: filePath },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          const buffer = await image.read();
          const imgExt = image.contentType.split("/")[1] || "png";
          extractedImages.push({ buffer, extension: imgExt });
          return { src: `img_${extractedImages.length - 1}` };
        }),
      }
    );

    parts.push(`Extraia as questões deste documento:\n\n${rawTextResult.value}`);
    console.log(
      `[IA] Documento processado: ${rawTextResult.value.length} caracteres e ${extractedImages.length} imagens.`
    );
  } else {
    console.log("[IA] Carregando imagem para extração...");
    const base64 = fs.readFileSync(filePath).toString("base64");
    const mimeType =
      ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

    parts.push({ inlineData: { data: base64, mimeType } });
    parts.push("Transcreva e extraia todas as questões desta imagem seguindo o JSON especificado.");
    console.log(`[IA] Imagem carregada (${mimeType}).`);
  }

  let activeModels: string[] = [];
  try {
    const pager = await ai.models.list();
    for await (const m of pager) {
      const name = m.name?.replace(/^models\//, "") || "";
      if (
        name.includes("gemini") &&
        !name.includes("image") &&
        !name.includes("audio") &&
        !name.includes("tts") &&
        !name.includes("embedding")
      ) {
        activeModels.push(name);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[IA] Não foi possível consultar os modelos ativos:", msg);
    activeModels = ["gemini-3.8-flash"];
  }

  const candidates = Array.from(
    new Set([
      "gemini-3.8-flash",
      ...activeModels.filter((m) => m.includes("flash")),
      ...activeModels.filter((m) => m.includes("pro")),
    ])
  ).filter((m) => activeModels.length === 0 || activeModels.includes(m));

  console.log("[IA] Modelos disponíveis para tentativa:", candidates);

  let response;
  let lastError: unknown;

  for (const modelName of candidates) {
    try {
      console.log(`[IA] Tentando formatar com ${modelName}...`);
      response = await ai.models.generateContent({
        model: modelName,
        contents: parts,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
        },
      });
      console.log(`[IA] Sucesso com ${modelName}!`);
      break;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[IA] Falha com ${modelName}:`, msg);
      const isTemporary =
        msg.includes("503") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("504") ||
        msg.includes("DEADLINE_EXCEEDED") ||
        msg.includes("429") ||
        msg.includes("404");
      if (!isTemporary) throw err;
    }
  }

  if (!response) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Todos os modelos disponíveis estão congestionados no momento.");
  }

  const textOutput = response.text || "";
  console.log("[IA] Validando resposta JSON...");
  const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("A IA não retornou uma estrutura válida de questões.");
  }

  const parsed = JSON.parse(jsonMatch[0]) as { questions: ExtractedQuestion[] };
  console.log(`[IA] Extração concluída: ${parsed.questions?.length || 0} questões encontradas.`);
  return {
    questions: parsed.questions || [],
    images: extractedImages,
  };
}