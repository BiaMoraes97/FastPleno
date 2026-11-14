import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { AuthLayout } from "../components/AuthLayout";
import { Icon } from "../components/Icon";

// Contas criadas automaticamente pelo servidor (ENABLE_DEMO=true). Apague este bloco em produção.
const DEMO = [
  { label: "Professor(a)", email: "professor@fastpleno.demo", password: "demo123" },
  { label: "Direção", email: "direcao@fastpleno.demo", password: "demo123" },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  // Estados para o modal de "Esqueci a senha"
  const [showForgot, setShowForgot] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  if (user) return <Navigate to="/portal" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecoverySubmit(e: FormEvent) {
  e.preventDefault();
  if (!recoveryEmail.trim()) return;

  setRecoveryLoading(true);
  try {
    const response = await fetch("/api/forgot-password", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: recoveryEmail }),
});

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "Falha ao enviar o link.");
    }

    setRecoverySent(true);
  } catch (err) {
    alert(err instanceof Error ? err.message : "Erro ao enviar e-mail de recuperação.");
  } finally {
    setRecoveryLoading(false);
  }
}

  function closeForgotModal() {
    setShowForgot(false);
    setRecoverySent(false);
    setRecoveryEmail("");
  }

  return (
    <AuthLayout>
      <h1>Entrar no portal</h1>
      <p className="sub">Área restrita à equipe pedagógica.</p>

      <form onSubmit={handleSubmit}>
        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@fastpleno.com.br"
            required
          />
        </label>

        <label>
          Senha
          <input
            type="password"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {/* Link posicionado logo abaixo dos campos de E-mail e Senha */}
        <div className="forgot-row">
          <button
            type="button"
            className="forgot-link"
            onClick={() => {
              setShowForgot(true);
              setRecoverySent(false);
            }}
          >
            Esqueci a senha
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block btn-lg" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <button type="button" className="btn btn-outline btn-block" onClick={() => setShowDemo(!showDemo)}>
        <Icon name="key" size={18} /> Contas de demonstração
      </button>
      {showDemo && (
        <div className="demo">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => {
                setEmail(d.email);
                setPassword(d.password);
              }}
            >
              <strong>{d.label}</strong> <span>{d.email}</span>
            </button>
          ))}
        </div>
      )}

      <p className="switch">
        Ainda não tem acesso? <Link to="/cadastro">Criar conta</Link>
      </p>

      {/* Pop-up (Modal) centralizado na tela */}
      {showForgot && (
        <div className="modal-backdrop" onClick={closeForgotModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="forgot-header">
              <strong>Recuperar acesso</strong>
              <button type="button" className="forgot-close" onClick={closeForgotModal} aria-label="Fechar">
                ✕
              </button>
            </div>

            {!recoverySent ? (
              <form onSubmit={handleRecoverySubmit} className="forgot-form">
                <p>
                  Digite seu <strong>e-mail reserva</strong> abaixo. Enviaremos um link para você cadastrar uma nova senha.
                </p>
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="seuemailreserva@gmail.com"
                  autoFocus
                  required
                />
                <div className="modal-actions">
                  <button type="button" className="btn btn-ghost" onClick={closeForgotModal}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={recoveryLoading}>
                    {recoveryLoading ? "Enviando..." : "Enviar link"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="forgot-success">
                <p>
                  ✓ Link enviado para <strong>{recoveryEmail}</strong>! Verifique sua caixa de entrada (e o spam) para redefinir sua senha.
                </p>
                <button type="button" className="btn btn-primary btn-block" onClick={closeForgotModal}>
                  Entendi
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </AuthLayout>
  );
}