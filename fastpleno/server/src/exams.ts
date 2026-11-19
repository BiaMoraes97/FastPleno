// Rotas das provas: enviar, listar, baixar, formatar (coordenação) e marcar como impressa.
// Fluxo: professor envia -> AGUARDANDO_FORMATACAO -> coordenação aciona IA -> PRONTA_PARA_IMPRESSAO -> direção imprime -> IMPRESSA
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { config } from "./config";
import { db, save, uid, Exam, User } from "./db";
import { requireAuth, requireRole } from "./auth";
import { extractExam } from "./ai";
import { buildExamDocx } from "./template";

const ALLOWED_EXTENSIONS = [".docx", ".png", ".jpg", ".jpeg", ".webp"];
const originalDir = path.join(config.uploadsDir, "original");
const formattedDir = path.join(config.uploadsDir, "formatted");
fs.mkdirSync(originalDir, { recursive: true });
fs.mkdirSync(formattedDir, { recursive: true });

// Trava em memória para evitar duas execuções simultâneas na mesma prova
const processingExams = new Set<string>();

// Upload: salva o arquivo em uploads/original com um nome único.
const upload = multer({
  storage: multer.diskStorage({
    destination: originalDir,
    filename: (_req, file, cb) => cb(null, uid() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) =>
    ALLOWED_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(new Error("Envie um arquivo .docx ou uma foto (.png, .jpg, .webp).")),
});

// Professor vê só as próprias provas; direção vê todas.
const canAccess = (user: User, exam: Exam) => user.role === "DIRECAO" || exam.teacherId === user.id;

/** Roda a IA e gera a prova formatada. Atualiza o status da prova no final. */
async function formatExam(examId: string) {
  if (processingExams.has(examId)) return;
  const exam = db.exams.find((e) => e.id === examId);
  if (!exam) return;

  processingExams.add(examId);
  try {
    const teacher = db.users.find((u) => u.id === exam.teacherId);
    const data = await extractExam(path.join(originalDir, exam.originalFile), exam.originalName);
    const buffer = await buildExamDocx(data, {
      title: exam.title,
      subject: exam.subject,
      className: exam.className,
      teacherName: exam.teacherName || teacher?.name || "",
      applicationMonthYear: exam.applicationMonthYear,
      neededByDate: exam.neededByDate,
    });
    exam.formattedFile = `${exam.id}.docx`;
    fs.writeFileSync(path.join(formattedDir, exam.formattedFile), buffer);
    exam.status = "PRONTA_PARA_IMPRESSAO";
    exam.errorMessage = undefined;
  } catch (e) {
    exam.status = "ERRO";
    const rawMsg = e instanceof Error ? e.message : "Falha ao formatar a prova.";
    if (rawMsg.includes("429") || rawMsg.includes("RESOURCE_EXHAUSTED")) {
      exam.errorMessage = "Limite de requisições por minuto da IA atingido. Aguarde 1 minuto e tente novamente.";
    } else if (
      rawMsg.includes("503") ||
      rawMsg.includes("UNAVAILABLE") ||
      rawMsg.includes("504") ||
      rawMsg.includes("DEADLINE_EXCEEDED")
    ) {
      exam.errorMessage = "O servidor da IA demorou mais que o esperado para responder. Clique novamente em Formatar com IA.";
    } else {
      exam.errorMessage = rawMsg;
    }
  } finally {
    processingExams.delete(examId);
  }
  exam.updatedAt = new Date().toISOString();
  save();
}

export const examsRouter = Router();

// Enviar prova (só professor). Vai direto para a fila da coordenação SEM acionar a IA.
examsRouter.post("/", requireAuth, requireRole("PROFESSOR"), upload.single("file"), (req, res) => {
  const { title, subject, className, teacherName, applicationMonthYear, neededByDate } = req.body ?? {};
  if (!req.file) return res.status(400).json({ error: "Anexe o arquivo .docx da prova." });
  if (!title || !subject || !className) {
    return res.status(400).json({ error: "Preencha título, disciplina e turma." });
  }

  const now = new Date().toISOString();
  const exam: Exam = {
    id: uid(),
    teacherId: req.user!.id,
    teacherName: teacherName?.trim() || req.user!.name,
    title: title.trim(),
    subject: subject.trim(),
    className: className.trim(),
    applicationMonthYear: applicationMonthYear?.trim() || "",
    neededByDate: neededByDate?.trim() || "",
    originalFile: req.file.filename,
    originalName: Buffer.from(req.file.originalname, "latin1").toString("utf8"),
    status: "AGUARDANDO_FORMATACAO",
    createdAt: now,
    updatedAt: now,
  };
  db.exams.push(exam);
  save();

  res.status(201).json(exam);
});

// Listar provas (mais recentes primeiro), já com o nome do professor.
examsRouter.get("/", requireAuth, (req, res) => {
  const list = db.exams
    .filter((e) => canAccess(req.user!, e))
    .map((e) => ({
      ...e,
      teacherName: e.teacherName || db.users.find((u) => u.id === e.teacherId)?.name || "",
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(list);
});

// Baixar arquivo: kind = "original" ou "formatted".
examsRouter.get("/:id/file/:kind", requireAuth, (req, res) => {
  const exam = db.exams.find((e) => e.id === req.params.id);
  if (!exam || !canAccess(req.user!, exam)) return res.status(404).json({ error: "Prova não encontrada." });

  const formatted = req.params.kind === "formatted";
  const file = formatted ? exam.formattedFile : exam.originalFile;
  if (!file) return res.status(404).json({ error: "Arquivo ainda não disponível." });

  const downloadName = `${exam.title}${formatted ? " - formatada" : ""}${path.extname(file)}`;
  res.download(path.join(formatted ? formattedDir : originalDir, file), downloadName);
});

// Coordenação/Direção aciona a IA para formatar (ou formatar de novo).
examsRouter.post("/:id/reformat", requireAuth, requireRole("DIRECAO"), (req, res) => {
  const exam = db.exams.find((e) => e.id === req.params.id);
  if (!exam) return res.status(404).json({ error: "Prova não encontrada." });
  if (exam.status === "IMPRESSA") return res.status(400).json({ error: "Esta prova já foi impressa." });
  if (processingExams.has(exam.id)) return res.status(409).json({ error: "Esta prova já está sendo formatada." });

  exam.status = "AGUARDANDO_FORMATACAO";
  exam.errorMessage = undefined;
  exam.updatedAt = new Date().toISOString();
  save();
  formatExam(exam.id);
  res.json(exam);
});

// Direção marca a prova como impressa.
examsRouter.patch("/:id/printed", requireAuth, requireRole("DIRECAO"), (req, res) => {
  const exam = db.exams.find((e) => e.id === req.params.id);
  if (!exam) return res.status(404).json({ error: "Prova não encontrada." });
  if (exam.status !== "PRONTA_PARA_IMPRESSAO") return res.status(400).json({ error: "A prova ainda não está pronta para impressão." });
  exam.status = "IMPRESSA";
  exam.updatedAt = new Date().toISOString();
  save();
  res.json(exam);
});