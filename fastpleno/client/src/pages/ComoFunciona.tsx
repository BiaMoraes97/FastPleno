import { useState, type SyntheticEvent } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Logo } from "../components/Logo";

type GuideStep = {
  number: string;
  title: string;
  description: string;
  tip: string;
  image: string;
  imageAlt: string;
};

type GuideSection = {
  badge: string;
  title: string;
  subtitle: string;
  steps: GuideStep[];
};

const GUIDES: Record<"professor" | "coordenador", GuideSection> = {
  professor: {
    badge: "FLUXO DO PROFESSOR",
    title: "Envie suas questões brutas e acompanhe o status",
    subtitle:
      "Você não precisa formatar nada: basta preencher os dados da avaliação, enviar o arquivo com as questões e acompanhar a liberação pela coordenação.",
    steps: [
      {
        number: "01",
        title: "Acesse o Portal e preencha os dados da prova",
        description:
          "Entre com seu login institucional (ou crie sua conta) e preencha as informações básicas da avaliação: seu nome, série, disciplina, título da prova, além do mês e ano da aplicação.",
        tip: "Dica: Confira o título e a série antes de enviar para agilizar a triagem da coordenação.",
        image: "/prints/prof-passo1.png",
        imageAlt: "Formulário de envio com dados da avaliação preenchidos pelo professor",
      },
      {
        number: "02",
        title: "Anexe o arquivo (.docx) com as questões brutas",
        description:
          "Faça o upload do documento do Word (.docx) contendo apenas o texto, imagens ou tabelas das suas questões — sem precisar se preocupar com cabeçalho, margens ou numeração oficial.",
        tip: "O formato .docx garante que gráficos, tabelas e fórmulas cheguem intactos para a coordenação.",
        image: "/prints/prof-passo2.png",
        imageAlt: "Área de seleção e envio do arquivo DOCX bruto",
      },
      {
        number: "03",
        title: "Envio direto para a fila da coordenação",
        description:
          "Ao concluir o envio, sua prova cai instantaneamente no painel da coordenação, que ficará responsável por acionar a IA para aplicar o padrão do colégio, revisar e liberar o arquivo para a impressão.",
        tip: "Você não precisa acionar a IA nem ajustar o layout: a equipe pedagógica cuida dessa etapa.",
        image: "/prints/prof-passo3.png",
        imageAlt: "Confirmação de envio da prova para a coordenação",
      },
      {
        number: "04",
        title: "Acompanhe o fluxo até a impressão",
        description:
          "Na aba 'Provas anteriores', você acompanha em tempo real em qual etapa sua avaliação está (enviada, em formatação/revisão pela coordenação ou impressa).",
        tip: "Use o chat integrado caso a coordenação solicite alguma correção no conteúdo das questões.",
        image: "/prints/prof-passo4.png",
        imageAlt: "Aba Provas anteriores mostrando o status do fluxo de impressão",
      },
    ],
  },
  coordenador: {
    badge: "FLUXO DA COORDENAÇÃO",
    title: "Acione a IA para formatar, revise, aprove e imprima",
    subtitle:
      "Receba os arquivos brutos dos professores, aplique o modelo oficial do colégio com um clique e controle toda a fila até a impressão das provas.",
    steps: [
      {
        number: "01",
        title: "Receba as provas brutas no painel geral",
        description:
          "Todas as avaliações enviadas pelos professores aparecem organizadas por status no painel da coordenação: Não Formatadas, Em Revisão e Prontas para Impressão.",
        tip: "Filtre rapidamente as avaliações por prioridade ou data de aplicação.",
        image: "/prints/coord-passo1.png",
        imageAlt: "Painel da coordenação mostrando as provas recebidas por status",
      },
      {
        number: "02",
        title: "Envie para a IA aplicar o modelo oficial",
        description:
          "Nos arquivos recém-chegados, clique para encaminhar à IA. Em segundos, o sistema estrutura as questões no padrão do colégio com cabeçalho, fontes, colunas e quebras de página.",
        tip: "O card avança automaticamente para a etapa de revisão assim que a IA conclui a formatação.",
        image: "/prints/coord-passo2.png",
        imageAlt: "Botão de formatação por IA no card da avaliação",
      },
      {
        number: "03",
        title: "Revise o resultado ou solicite ajustes à IA",
        description:
          "Abra a pré-visualização da prova formatada para conferir a estrutura. Se precisar de alguma correção nas questões, fale direto com à IA pelo chat do card; se estiver tudo certo, aprove.",
        tip: "Todo o histórico de mensagens fica registrado na própria avaliação.",
        image: "/prints/coord-passo3.png",
        imageAlt: "Pré-visualização da prova formatada e chat com o professor",
      },
      {
        number: "04",
        title: "Exporte e finalize a impressão",
        description:
          "As provas aprovadas ficam reunidas na coluna final com o arquivo pronto para reprografia. Após imprimir, marque como concluída para atualizar o status para o professor.",
        tip: "Assim que o status é atualizado, o professor visualiza que a prova já seguiu para impressão.",
        image: "/prints/coord-passo4.png",
        imageAlt: "Coluna de provas aprovadas prontas para impressão",
      },
    ],
  },
};

export default function ComoFunciona() {
  const [role, setRole] = useState<keyof typeof GUIDES>("professor");
  const current = GUIDES[role];

  return (
    <div className="guide-page">
      <header className="site-header">
        <Logo />
        <nav style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          <Link to="/">Início</Link>
          <Link to="/login" className="btn btn-primary">
            Entrar no portal
          </Link>
        </nav>
      </header>

      <main className="guide-container">
        <div className="guide-hero">
          <p className="kicker yellow">GUIA DA PLATAFORMA</p>
          <h1>Como funciona o FastPleno?</h1>
          <p className="lead" style={{ margin: "0 auto" }}>
            Escolha seu perfil abaixo para ver como funciona cada etapa, desde o envio das questões brutas até a impressão oficial.
          </p>

          {/* Seletor Professor / Coordenador */}
          <div className="role-switch" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={role === "professor"}
              className={role === "professor" ? "active" : ""}
              onClick={() => setRole("professor")}
            >
              Sou Professor(a)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={role === "coordenador"}
              className={role === "coordenador" ? "active" : ""}
              onClick={() => setRole("coordenador")}
            >
              Sou Coordenador(a)
            </button>
          </div>
        </div>

        <section className="guide-section">
          <div className="guide-section-header">
            <span className="kicker yellow">{current.badge}</span>
            <h2>{current.title}</h2>
            <p className="muted">{current.subtitle}</p>
          </div>

          <div className="steps-list">
            {current.steps.map((step: GuideStep) => (
              <article key={step.number} className="step-card">
                <div className="step-content">
                  <span className="step-number">Passo {step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  <div className="step-tip">
                    <span className="yellow">✦</span>
                    <span>{step.tip}</span>
                  </div>
                </div>

                <div className="step-media">
                  <img
                    src={step.image}
                    alt={step.imageAlt}
                    onError={(e: SyntheticEvent<HTMLImageElement>) => {
                      const target = e.currentTarget;
                      target.style.display = "none";

                      const fallback = target.nextElementSibling as HTMLElement | null;
                      if (fallback) {
                        fallback.style.display = "flex";
                      }
                    }}
                  />
                  {/* Fallback visual enquanto você ainda não adicionou os prints reais */}
                  <div className="step-placeholder" style={{ display: "none" }}>
                    <span>Imagem ilustrativa — {step.imageAlt}</span>
                    <small>Salve seu print em: public{step.image}</small>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Chamada final para ação */}
        <section className="guide-cta">
          <h2>Pronto para começar?</h2>
          <p className="muted">Acesse agora o portal com sua conta institucional ou crie seu cadastro.</p>
          <div className="actions" style={{ justifyContent: "center", marginBottom: 0 }}>
            <Link to="/login" className="btn btn-primary btn-lg">
              Acessar Portal <Icon name="arrow" size={18} />
            </Link>
            <Link to="/cadastro" className="btn btn-ghost btn-lg">
              Criar conta
            </Link>
          </div>
        </section>
      </main>

      <footer>
        <span>© FastPleno — Gestão e formatação inteligente de avaliações</span>
        <a href="mailto:contato@fastpleno.com.br">contato@fastpleno.com.br</a>
      </footer>
    </div>
  );
}