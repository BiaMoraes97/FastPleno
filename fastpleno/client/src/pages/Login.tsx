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

  return (
    <AuthLayout>
      <h1>Entrar no portal</h1>
      <p className="sub">Área restrita à equipe pedagógica.</p>

      <form onSubmit={handleSubmit}>
        <label>E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@colegio.com.br" required />
        </label>
        <label>Senha
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block btn-lg" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
      </form>

      <button type="button" className="btn btn-outline btn-block" onClick={() => setShowDemo(!showDemo)}>
        <Icon name="key" size={18} /> Contas de demonstração
      </button>
      {showDemo && (
        <div className="demo">
          {DEMO.map((d) => (
            <button key={d.email} type="button" onClick={() => { setEmail(d.email); setPassword(d.password); }}>
              <strong>{d.label}</strong> <span>{d.email}</span>
            </button>
          ))}
        </div>
      )}

      <p className="switch">Ainda não tem acesso? <Link to="/cadastro">Criar conta</Link></p>
    </AuthLayout>
  );
}
