// Chat privado: cada professor tem uma conversa com a direção.
// O front consulta a cada poucos segundos (polling). Para tempo real de verdade, troque por WebSocket (Socket.IO).
import { Router } from "express";
import { db, save, uid, Message } from "./db";
import { requireAuth, requireRole } from "./auth";

export const messagesRouter = Router();

// Direção: lista de professores com a última mensagem de cada conversa.
messagesRouter.get("/conversations", requireAuth, requireRole("DIRECAO"), (_req, res) => {
  const list = db.users
    .filter((u) => u.role === "PROFESSOR")
    .map((p) => {
      const last = db.messages.filter((m) => m.professorId === p.id).at(-1);
      return { professorId: p.id, professorName: p.name, lastMessage: last?.text ?? null, lastAt: last?.createdAt ?? null };
    })
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
  res.json(list);
});

// Mensagens de uma conversa. Professor: a própria. Direção: informa ?professorId=
messagesRouter.get("/", requireAuth, (req, res) => {
  const professorId = req.user!.role === "PROFESSOR" ? req.user!.id : String(req.query.professorId ?? "");
  res.json(db.messages.filter((m) => m.professorId === professorId));
});

// Enviar mensagem.
messagesRouter.post("/", requireAuth, (req, res) => {
  const { text, professorId } = req.body ?? {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: "Escreva uma mensagem." });

  const convId = req.user!.role === "PROFESSOR" ? req.user!.id : professorId;
  if (!convId || !db.users.some((u) => u.id === convId && u.role === "PROFESSOR"))
    return res.status(400).json({ error: "Conversa não encontrada." });

  const message: Message = {
    id: uid(),
    professorId: convId,
    senderId: req.user!.id,
    senderRole: req.user!.role,
    text: String(text).trim(),
    createdAt: new Date().toISOString(),
  };
  db.messages.push(message);
  save();
  res.status(201).json(message);
});
