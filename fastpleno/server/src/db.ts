// Banco de dados SIMPLES: um arquivo JSON carregado na memória.
// Ótimo para começar. Para produção, troque este arquivo por MySQL/PostgreSQL
// (Prisma, TypeORM...) mantendo as mesmas funções usadas nas rotas.
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { config } from "./config";

export type Role = "PROFESSOR" | "DIRECAO";

// As 3 etapas da prova (+ ERRO quando a IA falha):
export type ExamStatus = "AGUARDANDO_FORMATACAO" | "PRONTA_PARA_IMPRESSAO" | "IMPRESSA" | "ERRO";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}

export interface Exam {
  id: string;
  teacherId: string;
  title: string;
  subject: string;
  className: string;
  originalFile: string; // nome do arquivo salvo em uploads/original
  originalName: string; // nome que o professor enviou
  formattedFile?: string; // nome do arquivo salvo em uploads/formatted
  status: ExamStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// Cada professor tem UMA conversa privada com a direção (professorId identifica a conversa).
export interface Message {
  id: string;
  professorId: string;
  senderId: string;
  senderRole: Role;
  text: string;
  createdAt: string;
}

interface Data {
  users: User[];
  exams: Exam[];
  messages: Message[];
}

function load(): Data {
  if (!fs.existsSync(config.dataFile)) return { users: [], exams: [], messages: [] };
  return JSON.parse(fs.readFileSync(config.dataFile, "utf8"));
}

export const db: Data = load();

/** Grava o estado atual no arquivo. Chame depois de qualquer alteração. */
export function save() {
  fs.mkdirSync(path.dirname(config.dataFile), { recursive: true });
  fs.writeFileSync(config.dataFile, JSON.stringify(db, null, 2));
}

export const uid = () => randomUUID();
