// Tipos compartilhados pelo front-end (espelham os do servidor).
export type Role = "PROFESSOR" | "DIRECAO";
export type ExamStatus = "AGUARDANDO_FORMATACAO" | "PRONTA_PARA_IMPRESSAO" | "IMPRESSA" | "ERRO";

export interface User { id: string; name: string; email: string; role: Role }

export interface Exam {
  id: string;
  teacherId: string;
  teacherName?: string;
  title: string;
  subject: string;
  className: string;
  applicationMonthYear?: string; // Ex.: "11/2026"
  neededByDate?: string;         // Data da aplicação / quando precisa impressa
  originalFile: string;
  originalName: string;
  formattedFile?: string;
  status: ExamStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}