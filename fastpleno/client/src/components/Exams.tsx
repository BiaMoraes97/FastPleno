// Visão do Professor: Formulário de envio para coordenação + aba "Provas Anteriores".
// Visão da Coordenação: Quadro de provas em 3 colunas com acionamento da IA e controle de impressão.
import { FormEvent, useEffect, useState } from "react";
import { api, downloadFile } from "../api";
import { useAuth } from "../auth";
import { Exam, ExamStatus } from "../types";
import { Icon } from "./Icon";

const COLUMNS: { statuses: ExamStatus[]; title: string; empty: string }[] = [
  { statuses: ["AGUARDANDO_FORMATACAO", "ERRO"], title: "Aguardando formatação", empty: "Nenhuma prova aguardando formatação." },
  { statuses: ["PRONTA_PARA_IMPRESSAO"], title: "Formatadas/Aguardando Análise", empty: "Nenhuma prova pronta ainda." },
  { statuses: ["IMPRESSA"], title: "Impressas", empty: "Nenhuma prova impressa ainda." },
];

function formatDateBR(isoDate?: string) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return d && m && y ? `${d}/${m}/${y}` : isoDate;
}

export function Exams() {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [error, setError] = useState("");
  const [profTab, setProfTab] = useState<"enviar" | "anteriores">("enviar");

  const load = () => api.listExams().then(setExams).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const run = (action: () => Promise<unknown>) => action().then(load).catch((e) => setError(e.message));

  // =========================================================================
  // TELA DO PROFESSOR
  // =========================================================================
  if (user?.role === "PROFESSOR") {
    return (
      <div className="portal-content">
        <div className="prof-nav-tabs">
          <button
            type="button"
            className={`prof-tab-btn ${profTab === "enviar" ? "active" : ""}`}
            onClick={() => setProfTab("enviar")}
          >
            <Icon name="upload" size={16} /> Enviar nova prova
          </button>
          <button
            type="button"
            className={`prof-tab-btn ${profTab === "anteriores" ? "active" : ""}`}
            onClick={() => setProfTab("anteriores")}
          >
            Provas Anteriores <span className="tab-count">{exams.length}</span>
          </button>
        </div>

        {error && <p className="error" style={{ marginBottom: "16px" }}>{error}</p>}

        {profTab === "enviar" ? (
          <UploadForm
            defaultTeacherName={user.name}
            onDone={() => {
              load();
            }}
            onGoHistory={() => setProfTab("anteriores")}
            onError={setError}
          />
        ) : (
          <PreviousExamsList exams={exams} onNewClick={() => setProfTab("enviar")} onError={setError} />
        )}
      </div>
    );
  }

  // =========================================================================
  // TELA DA COORDENAÇÃO / DIREÇÃO
  // =========================================================================
  return (
    <>
      {error && <p className="error">{error}</p>}

      <div className="board">
        {COLUMNS.map((col) => {
          const items = exams.filter((e) => col.statuses.includes(e.status));
          return (
            <section key={col.title} className="column">
              <h3>
                {col.title} <span className="count">{items.length}</span>
              </h3>
              {items.length === 0 && <p className="empty">{col.empty}</p>}
              {items.map((exam) => (
                <ExamCard key={exam.id} exam={exam} run={run} onError={setError} />
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Formulário do Professor: envia direto para a coordenação sem acionar IA */
function UploadForm({
  defaultTeacherName,
  onDone,
  onGoHistory,
  onError,
}: {
  defaultTeacherName: string;
  onDone: () => void;
  onGoHistory: () => void;
  onError: (m: string) => void;
}) {
  const [sending, setSending] = useState(false);
  const [fileName, setFileName] = useState("");
  const [sentSuccess, setSentSuccess] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setSending(true);
    setSentSuccess(false);
    onError("");
    try {
      await api.uploadExam(new FormData(form));
      form.reset();
      setFileName("");
      setSentSuccess(true);
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Não foi possível enviar a prova.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="exam-panel" onSubmit={handleSubmit}>
      <div className="panel-head">
        <h3>
          <Icon name="upload" size={18} /> Enviar prova / ficha para a coordenação
        </h3>
        <p className="muted">
          Anexe o arquivo <strong>.docx</strong> com as questões brutas. A coordenação receberá o material para formatar no padrão do colégio e imprimir.
        </p>
      </div>

      <div className="prof-exam-form">
        <div className="form-grid-3">
          <label>
            Título
            <input name="title" placeholder="Ex.: Prova do 2º bimestre" required />
          </label>
          <label>
            Disciplina
            <input name="subject" placeholder="Ex.: Matemática" required />
          </label>
          <label>
            Turma
            <input name="className" placeholder="Ex.: 8º ano A" required />
          </label>
        </div>

        <div className="form-grid-2">
          <label>
            Professor(a)
            <input name="teacherName" defaultValue={defaultTeacherName} placeholder="Seu nome" required />
          </label>
          <label>
            Mês e ano da aplicação
            <input name="applicationMonthYear" placeholder="Ex.: 11/2026" required />
          </label>
        </div>

        {/* Box a parte para o prazo / data da aplicação */}
        <div className="deadline-box">
          <div className="deadline-info">
            <strong>Data da aplicação (Prazo para impressão)</strong>
            <span>Informe para quando você precisa da prova ou ficha já impressa.</span>
          </div>
          <input name="neededByDate" type="date" required />
        </div>

        <div className="upload-submit-row">
          <div className="custom-file-wrapper">
            <input
              id="docx-file-input"
              name="file"
              type="file"
              accept=".docx,.png,.jpg,.jpeg,.webp"
              className="hidden-file-input"
              onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
              required
            />
            <label htmlFor="docx-file-input" className="btn-choose-purple">
              <Icon name="file" size={16} />
              {fileName ? "Trocar arquivo" : "Escolher arquivo .docx"}
            </label>
            <span className="file-chosen-name">{fileName || "Nenhum arquivo selecionado"}</span>
          </div>

          <button className="btn btn-primary btn-lg" disabled={sending}>
            {sending ? "Enviando..." : "Enviar para a coordenação"}
          </button>
        </div>

        {sentSuccess && (
          <div className="feedback-banner ok">
            <span>✓ Prova enviada para o quadro da coordenação!</span>
            <button type="button" className="btn-link-inline" onClick={onGoHistory}>
              Acompanhar em Provas Anteriores →
            </button>
          </div>
        )}
      </div>
    </form>
  );
}

/** Aba "Provas Anteriores" do Professor */
function PreviousExamsList({
  exams,
  onNewClick,
  onError,
}: {
  exams: Exam[];
  onNewClick: () => void;
  onError: (m: string) => void;
}) {
  const download = (exam: Exam, kind: "original" | "formatted", name: string) =>
    downloadFile(exam.id, kind, name).catch((e) => onError(e.message));

  function getStatusLabel(status: ExamStatus) {
    if (status === "AGUARDANDO_FORMATACAO" || status === "ERRO") {
      return <span className="status-pill status-wait">Recebida pela coordenação</span>;
    }
    if (status === "PRONTA_PARA_IMPRESSAO") {
      return <span className="status-pill status-ready">Formatada / Pronta para impressão</span>;
    }
    return <span className="status-pill status-printed">Impressa</span>;
  }

  return (
    <section className="exam-panel">
      <div className="panel-head-row">
        <div>
          <h3>Provas Anteriores</h3>
          <p className="muted">Acompanhe o status e o andamento das avaliações enviadas.</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={onNewClick}>
          + Novo envio
        </button>
      </div>

      {exams.length === 0 ? (
        <p className="empty">Você ainda não enviou nenhuma prova.</p>
      ) : (
        <div className="history-list">
          {exams.map((exam) => (
            <article key={exam.id} className="history-card">
              <div className="history-main">
                <div className="history-title-row">
                  <strong>{exam.title}</strong>
                  {getStatusLabel(exam.status)}
                </div>
                <p className="history-meta">
                  {exam.subject} · {exam.className} {exam.teacherName ? `· Prof(a). ${exam.teacherName}` : ""}
                </p>
                <p className="history-dates">
                  {exam.applicationMonthYear && <span>Mês/Ano: <strong>{exam.applicationMonthYear}</strong></span>}
                  {exam.neededByDate && (
                    <span> · Aplicação até: <strong>{formatDateBR(exam.neededByDate)}</strong></span>
                  )}
                  <span> · Enviada em {new Date(exam.createdAt).toLocaleDateString("pt-BR")}</span>
                </p>
              </div>

              <div className="history-progress">
                <span className="step-dot done">1. Enviada</span>
                <span className={`step-dot ${exam.status === "PRONTA_PARA_IMPRESSAO" || exam.status === "IMPRESSA" ? "done" : ""}`}>
                  2. Formatada
                </span>
                <span className={`step-dot ${exam.status === "IMPRESSA" ? "done" : ""}`}>
                  3. Impressa
                </span>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => download(exam, "original", exam.originalName)}
                >
                  Baixar enviada
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/** Card do Quadro da Coordenação */
function ExamCard({
  exam,
  run,
  onError,
}: {
  exam: Exam;
  run: (action: () => Promise<unknown>) => void;
  onError: (m: string) => void;
}) {
  const [formatting, setFormatting] = useState(false);

  const download = (kind: "original" | "formatted", name: string) =>
    downloadFile(exam.id, kind, name).catch((e) => onError(e.message));

  async function handleFormat() {
    setFormatting(true);
    try {
      await api.reformat(exam.id);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Erro ao formatar");
    } finally {
      setFormatting(false);
    }
  }

  return (
    <article className="exam">
      <strong>{exam.title}</strong>
      <small>{exam.subject} · {exam.className}</small>
      <small>Prof(a). {exam.teacherName}</small>
      {exam.applicationMonthYear && <small>Mês/Ano: {exam.applicationMonthYear}</small>}
      {exam.neededByDate && <small className="yellow">Aplicação: {formatDateBR(exam.neededByDate)}</small>}
      <small>Enviado em {new Date(exam.createdAt).toLocaleDateString("pt-BR")}</small>

      {exam.status === "ERRO" && <span className="badge error-badge">{exam.errorMessage}</span>}

      <div className="exam-actions">
        <button onClick={() => download("original", exam.originalName)}>Original (.docx)</button>

        {exam.formattedFile && (
          <button onClick={() => download("formatted", `${exam.title}.docx`)}>Formatada</button>
        )}

        {(exam.status === "AGUARDANDO_FORMATACAO" || exam.status === "ERRO") && (
          <button className="primary" disabled={formatting} onClick={handleFormat}>
            {formatting ? "Formatando com IA..." : "Formatar com IA"}
          </button>
        )}

        {exam.status === "PRONTA_PARA_IMPRESSAO" && (
          <>
            <button onClick={() => run(() => api.reformat(exam.id))}>Formatar de novo</button>
            <button className="primary" onClick={() => run(() => api.markPrinted(exam.id))}>
              Marcar como impressa
            </button>
          </>
        )}
      </div>
    </article>
  );
}