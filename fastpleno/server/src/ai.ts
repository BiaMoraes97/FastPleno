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
  imageIndex?: number | null;
  alternatives?: string[];
  options?: { letter: string; text: string }[];
  linesForAnswer?: number;
}

export interface ExtractedExamData {
  questions: ExtractedQuestion[];
  images: { buffer: Buffer; contentType: string; extension: string }[];
}

const SYSTEM_PROMPT = `Você é um extrator fiel de provas escolares do Colégio Pleno.
Sua ÚNICA tarefa é extrair EXATAMENTE as questões presentes no documento enviado e retornar um JSON válido.

REGRAS CRÍTICAS (OBRIGATÓRIO SEGUIR):
1. NÃO INVENTE, NÃO ADICIONE E NÃO COMPLETE QUESTÕES. Se o documento tem 8 questões, o array "questions" deve ter EXATAMENTE 8 itens. Nunca crie questões novas.
2. NÃO altere números, enunciados ou alternativas das questões originais; apenas corrija erros óbvios de digitação ou espaçamento colado.
3. IMAGENS: No texto extraído, as imagens do documento original aparecem marcadas como [IMAGEM 0], [IMAGEM 1], etc. Quando uma questão possuir um marcador [IMAGEM X] associado ao seu enunciado, preencha "imageIndex" com o número X correspondente (ex: 0, 1, 2) e remova a tag "[IMAGEM X]" do texto do enunciado. Se a questão não tiver imagem, use null.
4. Se o documento original já vier com um cabeçalho de prova (nome da escola, professor, série, data), IGNORE esse cabeçalho e extraia APENAS as questões.
5. Retorne APENAS JSON válido no formato:
{
  "questions": [
    {
      "number": 1,
      "supportTitle": "",
      "supportText": "",
      "statement": "Enunciado completo da questão",
      "imageIndex": null,
      "alternatives": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."],
      "linesForAnswer": 0
    }
  ]
}`;

export async function extractExam(filePath: string, originalName: string): Promise<ExtractedExamData> {
  console.log("[IA] Iniciando extração do arquivo.");
  console.log("[IA] Lendo arquivo:", filePath);

  const ext = path.extname(originalName).toLowerCase();
  const extractedImages: { buffer: Buffer; contentType: string; extension: string }[] = [];

  if (config.mockAi) {
    console.log("[IA] Modo mock ativo; ignorando chamada à IA.");
    return {
      questions: [
        {
          number: 1,
          supportTitle: "TEXTO DE EXEMPLO (MODO MOCK)",
          supportText: "Este é um texto gerado em modo de simulação porque MOCK_AI=true.",
          statement: "Assinale a alternativa correta:",
          imageIndex: null,
          alternatives: [
            "A) Primeira alternativa limpa sem marca-texto.",
            "B) Segunda alternativa limpa.",
            "C) Terceira alternativa limpa.",
            "D) Quarta alternativa limpa.",
          ],
          linesForAnswer: 0,
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
    const htmlResult = await mammoth.convertToHtml(
      { path: filePath },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          const buffer = await image.read();
          const contentType = image.contentType || "image/png";
          const imgExt = contentType.split("/")[1] || "png";
          const idx = extractedImages.length;
          extractedImages.push({ buffer, contentType, extension: imgExt });
          return { src: `img_${idx}` };
        }),
      }
    );

    // Converte o HTML mantendo [IMAGEM X] na posição exata de cada figura no texto
    const textWithMarkers = htmlResult.value
      .replace(/<img[^>]*src="img_(\d+)"[^>]*>/gi, "\n[IMAGEM $1]\n")
      .replace(/<\/p>|<\/div>|<\/tr>|<br\s*\/?>/gi, "\n")
      .replace(/<\/td>|<\/th>/gi, " | ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    parts.push(`Extraia EXATAMENTE as questões deste documento:\n\n${textWithMarkers}`);

    extractedImages.forEach((img, idx) => {
      parts.push(`Imagem ${idx}:`);
      parts.push({
        inlineData: {
          data: img.buffer.toString("base64"),
          mimeType: img.contentType,
        },
      });
    });

    console.log(
      `[IA] Documento processado: ${textWithMarkers.length} caracteres e ${extractedImages.length} imagens.`
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

  // Normaliza alternativas caso a IA retorne no formato antigo "options" ou no novo "alternatives"
  const normalizedQuestions = (parsed.questions || []).map((q, idx) => {
    const alts =
      q.alternatives && q.alternatives.length > 0
        ? q.alternatives
        : q.options && q.options.length > 0
        ? q.options.map((o) => `${o.letter}) ${o.text}`)
        : [];

    return {
      ...q,
      number: q.number || idx + 1,
      imageIndex: typeof q.imageIndex === "number" ? q.imageIndex : null,
      alternatives: alts,
    };
  });

  console.log(`[IA] Extração concluída: ${normalizedQuestions.length} questões encontradas.`);
  return {
    questions: normalizedQuestions,
    images: extractedImages,
  };
}