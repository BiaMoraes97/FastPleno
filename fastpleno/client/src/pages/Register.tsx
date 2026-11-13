import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { AuthLayout } from "../components/AuthLayout";

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", directionCode: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/portal" replace />;

  // Atualiza um campo do formulário.
  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({ ...form, directionCode: form.directionCode || undefined });
      navigate("/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <h1>Criar conta</h1>
      <p className="sub">Cadastro da equipe pedagógica. Professores enviam provas; a direção revisa e imprime.</p>

      <form onSubmit={handleSubmit}>
        <label>Nome completo
          <input value={form.name} onChange={set("name")} placeholder="Ex.: Carla Ribeiro" required />
        </label>
        <label>E-mail
          <input type="email" value={form.email} onChange={set("email")} placeholder="nome@colegio.com.br" required />
        </label>
        <label>Senha
          <input type="password" value={form.password} onChange={set("password")} placeholder="Pelo menos 6 caracteres" minLength={6} required />
        </label>
        <label>Código da direção (opcional)
          <input value={form.directionCode} onChange={set("directionCode")} placeholder="Ex.: FASTPLENO-DIRECAO-2026" />
          <small>Preencha apenas se você faz parte da direção. O código é fornecido pela coordenação.</small>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block btn-lg" disabled={loading}>{loading ? "Criando..." : "Criar conta"}</button>
      </form>

      <p className="switch">Já tem acesso? <Link to="/login">Entrar</Link></p>
    </AuthLayout>
  );
}
