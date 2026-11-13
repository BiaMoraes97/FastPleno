// Ponto de entrada do servidor: monta as rotas e (em produção) serve o front-end.
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { config } from "./config";
import { db, save, uid } from "./db";
import { authRouter } from "./auth";
import { examsRouter } from "./exams";
import { messagesRouter } from "./messages";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/exams", examsRouter);
app.use("/api/messages", messagesRouter);

// Em produção, o Node também entrega o site (pasta client/dist, gerada por "npm run build" no client).
const clientDist = path.resolve("../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

// Erros (ex.: arquivo inválido no upload) viram resposta JSON amigável.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(400).json({ error: err.message });
});

// Cria contas de demonstração na primeira execução (desligue com ENABLE_DEMO=false).
function seedDemoAccounts() {
  if (!config.enableDemo || db.users.length > 0) return;
  const passwordHash = bcrypt.hashSync("demo123", 10);
  db.users.push(
    { id: uid(), name: "Professora Demo", email: "professor@fastpleno.demo", passwordHash, role: "PROFESSOR" },
    { id: uid(), name: "Direção Demo", email: "direcao@fastpleno.demo", passwordHash, role: "DIRECAO" }
  );
  save();
}

seedDemoAccounts();
app.listen(config.port, () => console.log(`FastPleno rodando em http://localhost:${config.port}`));
