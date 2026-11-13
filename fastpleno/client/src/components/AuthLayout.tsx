// Moldura das telas de login e cadastro: painel à esquerda + formulário à direita.
import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import { Logo } from "./Logo";

const SIDE_STEPS = [
  { icon: "file", text: "O professor envia o .docx com as questões" },
  { icon: "layout", text: "A IA formata no modelo oficial do colégio" },
  { icon: "printer", text: "A direção revisa, aprova e imprime" },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <Logo />
        <div>
          <p className="kicker">FASTPLENO</p>
          <h2>Gestão e formatação inteligente de avaliações</h2>
          <ul className="side-list">
            {SIDE_STEPS.map((s) => (
              <li key={s.text}>
                <span className="ico"><Icon name={s.icon} size={18} /></span>
                {s.text}
              </li>
            ))}
          </ul>
        </div>
        <Link to="/" className="back"><Icon name="arrow-left" size={18} /> Voltar ao site</Link>
      </aside>
      <main className="auth-main">
        <div className="auth-form">{children}</div>
      </main>
    </div>
  );
}
