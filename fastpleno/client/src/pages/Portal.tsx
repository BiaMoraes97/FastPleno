import { useAuth } from "../auth";
import { Exams } from "../components/Exams";
import { Logo } from "../components/Logo";

export default function Portal() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="portal">
      <header className="portal-header">
        <Logo />
        <div className="who">
          <div>
            <strong>{user.name}</strong>
            <small>{user.role === "DIRECAO" ? "Direção" : "Professor(a)"}</small>
          </div>
          <button className="btn btn-outline" onClick={logout}>Sair</button>
        </div>
      </header>

      <main><Exams /></main>
    </div>
  );
}
