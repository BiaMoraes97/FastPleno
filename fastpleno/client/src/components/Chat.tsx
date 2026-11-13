// Chat privado professor <-> direção. Atualiza sozinho a cada 4 s.
import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Conversation, Message } from "../types";

export function Chat() {
  const { user } = useAuth();
  const isDirection = user?.role === "DIRECAO";
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string>(""); // professorId da conversa aberta (só a direção escolhe)
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  // Direção: carrega a lista de professores.
  useEffect(() => {
    if (!isDirection) return;
    const load = () => api.conversations().then(setConversations).catch(() => {});
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [isDirection]);

  // Carrega as mensagens da conversa aberta.
  useEffect(() => {
    if (isDirection && !selected) return setMessages([]);
    const load = () => api.messages(selected).then(setMessages).catch(() => {});
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [isDirection, selected]);

  // Rola para a última mensagem.
  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await api.sendMessage(text, selected || undefined);
      setText("");
      setMessages(await api.messages(selected));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar.");
    }
  }

  const canWrite = !isDirection || selected;

  return (
    <div className="chat">
      {isDirection && (
        <aside className="chat-list">
          <h3>Professores</h3>
          {conversations.map((c) => (
            <button key={c.professorId} className={selected === c.professorId ? "active" : ""} onClick={() => setSelected(c.professorId)}>
              <strong>{c.professorName}</strong>
              <small>{c.lastMessage ?? "Sem mensagens"}</small>
            </button>
          ))}
          {conversations.length === 0 && <p className="empty">Nenhum professor cadastrado.</p>}
        </aside>
      )}

      <section className="chat-thread">
        <div className="chat-messages">
          {!canWrite && <p className="empty">Escolha um professor para ver a conversa.</p>}
          {canWrite && messages.length === 0 && (
            <p className="empty">{isDirection ? "Nenhuma mensagem ainda." : "Tire dúvidas sobre suas provas com a direção. Escreva abaixo."}</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.senderId === user?.id ? "mine" : ""}`}>
              <small>{m.senderRole === "DIRECAO" ? "Direção" : "Professor(a)"} · {new Date(m.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</small>
              <p>{m.text}</p>
            </div>
          ))}
          <div ref={bottom} />
        </div>
        {error && <p className="error">{error}</p>}
        <form className="chat-form" onSubmit={send}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva sua mensagem" disabled={!canWrite} />
          <button className="btn btn-primary" disabled={!canWrite}>Enviar</button>
        </form>
      </section>
    </div>
  );
}
