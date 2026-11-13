// Página inicial FIXA (sem busca de dados): para mudar qualquer texto, edite o objeto TEXT abaixo.
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Logo } from "../components/Logo";

const TEXT = {
  slogan: "Gestão e formatação inteligente de avaliações",
  title1: "FastPleno -",
  title2: "Prova pronta nunca foi tão fácil",
  intro:
    "Envie as questões, deixe a IA aplicar o modelo oficial do colégio e acompanhe cada prova até a impressão.",
  highlights: [
    { icon: "layout", text: "Formatação automática por IA" },
    { icon: "printer", text: "Acompanhamento até a impressão" },
  ],
  card: {
    kicker: "PORTAL DO PROFESSOR",
    title: "ENVIE AS PROVAS E A IA APLICA O MODELO DO COLÉGIO",
    text: "Área restrita à equipe pedagógica: o professor envia o arquivo das questões, a IA formata no padrão do colégio e a direção acompanha cada prova até a impressão.",
    steps: ["Envie o .docx das questões", "A IA organiza no modelo oficial", "A direção revisa, aprova e imprime"],
  },
  contact: "contato@fastpleno.com.br",
};

export default function Landing() {
  return (
    <div className="landing">
      <header className="site-header">
  <Logo />
  <nav>
    <Link to="/como-funciona">Como funciona?</Link>
  </nav>
</header>

      <section className="hero">
  <div>
    <p
  className="muted"
  style={{
    fontFamily: "'Libertinus Sans', sans-serif",
    fontSize: "0.875rem",
    marginBottom: "0.75rem",
  }}
>
  {TEXT.slogan}
</p>
    <h1>
      {TEXT.title1}
      <br />
      <span className="yellow">{TEXT.title2}</span>
    </h1>
          <p className="lead">{TEXT.intro}</p>
          <div className="actions">
            <Link to="/login" className="btn btn-primary btn-lg">Portal do Professor <Icon name="arrow" size={18} /></Link>
            <Link to="/cadastro" className="btn btn-ghost btn-lg">Criar conta</Link>
          </div>
          <ul className="highlights">
            {TEXT.highlights.map((h) => (
              <li key={h.text}><span className="yellow"><Icon name={h.icon} size={20} /></span>{h.text}</li>
            ))}
          </ul>
        </div>

        <aside className="hero-card" id="como-funciona">
          <p className="kicker yellow">{TEXT.card.kicker}</p>
          <h3>{TEXT.card.title}</h3>
          <p>{TEXT.card.text}</p>
          <ol>
            {TEXT.card.steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
          <Link to="/login" className="btn btn-dark btn-block">Entrar no portal</Link>
        </aside>
      </section>

      <footer id="contato">
        <span>© FastPleno — {TEXT.slogan}</span>
        <a href={`mailto:${TEXT.contact}`}>{TEXT.contact}</a>
      </footer>
    </div>
  );
}
