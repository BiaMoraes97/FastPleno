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
  const ext = path.extname(originalName).toLowerCase();
  const extractedImages: { buffer: Buffer; extension: string }[] = [];

  if (config.mockAi) {
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

  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const parts: Array<string | { inlineData: { data: string; mimeType: string } }> = [];

  if (ext === ".docx") {
    // Extrai o texto bruto e as imagens do .docx
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
  } else {
    // Caso o professor envie uma imagem (.png, .jpg, .webp)
    const base64 = fs.readFileSync(filePath).toString("base64");
    const mimeType =
      ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

    parts.push({ inlineData: { data: base64, mimeType } });
    parts.push("Transcreva e extraia todas as questões desta imagem seguindo o JSON especificado.");
  }

  // Descobre automaticamente os modelos disponíveis na chave atual que suportam generateContent
  let availableModels: string[] = [];
  try {
    const pager = await ai.models.list();
    for await (const m of pager) {
      const name = m.name?.replace(/^models\//, "") || "";
      if (
        name.includes("gemini") &&
        (m.supportedActions?.includes("generateContent") || !m.supportedActions)
      ) {
        availableModels.push(name);
      }
    }
  } catch {
    // Se falhar a listagem, usa os nomes padrão
  }

  const preferredOrder = [
    config.geminiModel && config.geminiModel !== "gemini-2.5-flash" ? config.geminiModel : "",
    "gemini-3.8-flash",
    "gemini-3.8-flash-lite",
    "gemini-3.8-pro",
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
  ].filter(Boolean);

  // Combina a ordem preferencial com qualquer modelo 'flash' ativo retornado pela API
  const dynamicFlash = availableModels.filter((m) => m.includes("flash") && !m.includes("image") && !m.includes("audio"));
  const modelsToTry = Array.from(
    new Set([
      ...(availableModels.length > 0
        ? preferredOrder.filter((m) => availableModels.includes(m))
        : preferredOrder),
      ...dynamicFlash,
    ])
  );

  let response;
  let lastError: unknown;

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: parts,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: "application/json",
          },
        });
        break;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isRetryable =
          msg.includes("503") ||
          msg.includes("UNAVAILABLE") ||
          msg.includes("404") ||
          msg.includes("NOT_FOUND") ||
          msg.includes("429");
        if (!isRetryable) throw err;
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
    if (response) break;
  }

  if (!response) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Nenhum modelo Gemini disponível respondeu no momento.");
  }

  let textOutput = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Lista de modelos em ordem de prioridade: se o principal estiver congestionado (503), troca automaticamente
  const primaryModel =
    !config.geminiModel || config.geminiModel === "gemini-2.5-flash"
      ? "gemini-3.8-flash"
      : config.geminiModel;

  const fallbackModels = Array.from(
    new Set([primaryModel, "gemini-3.8-flash-lite", "gemini-3.0-flash"])
  );

  let response;
  let lastError: unknown;

  for (const modelName of fallbackModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: parts,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: "application/json",
          },
        });
        break;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isRetryable =
          msg.includes("503") ||
          msg.includes("UNAVAILABLE") ||
          msg.includes("404") ||
          msg.includes("NOT_FOUND");
        if (!isRetryable) throw err;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    if (response) break;
  }

  if (!response) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Não foi possível obter resposta de nenhum modelo Gemini.");
  }
      textOutput = response.text || "";
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTemporary = msg.includes("503") || msg.includes("UNAVAILABLE");
      if (!isTemporary || attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }

  const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("A IA não retornou uma estrutura válida de questões.");
  }

  const parsed = JSON.parse(jsonMatch[0]) as { questions: ExtractedQuestion[] };
  return {
    questions: parsed.questions || [],
    images: extractedImages,
  };
}