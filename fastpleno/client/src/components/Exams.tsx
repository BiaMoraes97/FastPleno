// Quadro de provas em 3 colunas (uma por etapa) + formulário de envio para professores.
import { FormEvent, useEffect, useState } from "react";
import { api, downloadFile } from "../api";
import { useAuth } from "../auth";
import { Exam, ExamStatus } from "../types";
import { Icon } from "./Icon";

// As etapas do quadro. Para criar/renomear etapas, mexa aqui (e em ExamStatus no servidor).
const COLUMNS: { statuses: ExamStatus[]; title: string; empty: string }[] = [
  { statuses: ["AGUARDANDO_FORMATACAO", "ERRO"], title: "Aguardando formatação", empty: "Nenhuma prova sendo formatada." },
  { statuses: ["PRONTA_PARA_IMPRESSAO"], title: "Prontas para impressão", empty: "Nenhuma prova pronta ainda." },
  { statuses: ["IMPRESSA"], title: "Impressas", empty: "Nenhuma prova impressa ainda." },
];

export function Exams() {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [error, setError] = useState("");

  const load = () => api.listExams().then(setExams).catch((e) => setError(e.message));

  // Carrega ao abrir e atualiza a cada 5 s (assim a prova "sobe de coluna" quando a IA termina).
  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  // Executa uma ação (botão) e recarrega a lista.
  const run = (action: () => Promise<unknown>) => action().then(load).catch((e) => setError(e.message));

  return (
    <>
      {user?.role === "PROFESSOR" && <UploadForm onDone={load} onError={setError} />}
      {error && <p className="error">{error}</p>}

      <div className="board">
        {COLUMNS.map((col) => {
          const items = exams.filter((e) => col.statuses.includes(e.status));
          return (
            <section key={col.title} className="column">
              <h3>{col.title} <span className="count">{items.length}</span></h3>
              {items.length === 0 && <p className="empty">{col.empty}</p>}
              {items.map((exam) => (
                <ExamCard key={exam.id} exam={exam} isDirection={user?.role === "DIRECAO"} run={run} onError={setError} />
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Formulário: título, disciplina, turma e arquivo. */
function UploadForm({ onDone, onError }: { onDone: () => void; onError: (m: string) => void }) {
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setSending(true);
    onError("");
    try {
      await api.uploadExam(new FormData(form)); // os campos têm name="title", "subject", "className" e "file"
      form.reset();
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Não foi possível enviar a prova.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="upload" onSubmit={handleSubmit}>
      <h3><Icon name="upload" size={18} /> Enviar nova prova</h3>
      <div className="upload-grid">
        <input name="title" placeholder="Título (ex.: Prova do 2º bimestre)" required />
        <input name="subject" placeholder="Disciplina" required />
        <input name="className" placeholder="Turma (ex.: 8º ano A)" required />
        <input name="file" type="file" accept=".docx,.png,.jpg,.jpeg,.webp" required />
        <button className="btn btn-primary" disabled={sending}>{sending ? "Enviando..." : "Enviar para formatação"}</button>
      </div>
    </form>
  );
}

function ExamCard({ exam, isDirection, run, onError }: {
  exam: Exam;
  isDirection: boolean;
  run: (action: () => Promise<unknown>) => void;
  onError: (m: string) => void;
}) {
  const download = (kind: "original" | "formatted", name: string) =>
    downloadFile(exam.id, kind, name).catch((e) => onError(e.message));

  return (
    <article className="exam">
      <strong>{exam.title}</strong>
      <small>{exam.subject} · {exam.className}</small>
      {isDirection && <small>Prof(a). {exam.teacherName}</small>}
      <small>{new Date(exam.createdAt).toLocaleDateString("pt-BR")}</small>

      {exam.status === "AGUARDANDO_FORMATACAO" && <span className="badge working">Formatando com IA…</span>}
      {exam.status === "ERRO" && <span className="badge error-badge">{exam.errorMessage}</span>}

      <div className="exam-actions">
        <button onClick={() => download("original", exam.originalName)}>Original</button>
        {exam.formattedFile && <button onClick={() => download("formatted", `${exam.title}.docx`)}>Formatada</button>}
        {(exam.status === "ERRO" || exam.status === "PRONTA_PARA_IMPRESSAO") && (
          <button onClick={() => run(() => api.reformat(exam.id))}>Formatar de novo</button>
        )}
        {isDirection && exam.status === "PRONTA_PARA_IMPRESSAO" && (
          <button className="primary" onClick={() => run(() => api.markPrinted(exam.id))}>Marcar como impressa</button>
        )}
      </div>
    </article>
  );
}
