// Área logada: duas abas, "Provas" e "Mensagens".
import { useState } from "react";
import { useAuth } from "../auth";
import { Chat } from "../components/Chat";
import { Exams } from "../components/Exams";
import { Icon } from "../components/Icon";
import { Logo } from "../components/Logo";

export default function Portal() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<"provas" | "mensagens">("provas");
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

      <nav className="tabs">
        <button className={tab === "provas" ? "active" : ""} onClick={() => setTab("provas")}><Icon name="file" size={18} /> Provas</button>
        <button className={tab === "mensagens" ? "active" : ""} onClick={() => setTab("mensagens")}><Icon name="message" size={18} /> Mensagens</button>
      </nav>

      <main>{tab === "provas" ? <Exams /> : <Chat />}</main>
    </div>
  );
}
