// Todas as chamadas ao servidor ficam aqui. Se mudar uma rota no back-end, ajuste só este arquivo.
import { Conversation, Exam, Message, User } from "./types";

const TOKEN_KEY = "fastpleno_token";
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Faz a requisição já enviando o token de login e tratando erros. */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const res = await fetch(`/api${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Algo deu errado. Tente novamente.");
  }
  return res.json();
}

const json = (data: unknown) => JSON.stringify(data);

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/login", { method: "POST", body: json({ email, password }) }),
  register: (data: { name: string; email: string; password: string; directionCode?: string }) =>
    request<{ token: string; user: User }>("/auth/register", { method: "POST", body: json(data) }),
  me: () => request<{ user: User }>("/auth/me"),

  listExams: () => request<Exam[]>("/exams"),
  uploadExam: (form: FormData) => request<Exam>("/exams", { method: "POST", body: form }),
  reformat: (id: string) => request<Exam>(`/exams/${id}/reformat`, { method: "POST" }),
  markPrinted: (id: string) => request<Exam>(`/exams/${id}/printed`, { method: "PATCH" }),

  conversations: () => request<Conversation[]>("/messages/conversations"),
  messages: (professorId?: string) => request<Message[]>(`/messages?professorId=${professorId ?? ""}`),
  sendMessage: (text: string, professorId?: string) =>
    request<Message>("/messages", { method: "POST", body: json({ text, professorId }) }),
};

/** Baixa um arquivo protegido (precisa do token, por isso não é um link simples). */
export async function downloadFile(examId: string, kind: "original" | "formatted", fileName: string) {
  const res = await fetch(`/api/exams/${examId}/file/${kind}`, { headers: { Authorization: `Bearer ${tokenStore.get()}` } });
  if (!res.ok) throw new Error("Não foi possível baixar o arquivo.");
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
