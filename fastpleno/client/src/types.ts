// Tipos compartilhados pelo front-end (espelham os do servidor).
export type Role = "PROFESSOR" | "DIRECAO";
export type ExamStatus = "AGUARDANDO_FORMATACAO" | "PRONTA_PARA_IMPRESSAO" | "IMPRESSA" | "ERRO";

export interface User { id: string; name: string; email: string; role: Role }

export interface Exam {
  id: string;
  title: string;
  subject: string;
  className: string;
  teacherName: string;
  originalName: string;
  formattedFile?: string;
  status: ExamStatus;
  errorMessage?: string;
  createdAt: string;
}