// Cadastro, login e proteção das rotas (JWT + perfis PROFESSOR / DIRECAO).
import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "./config";
import { db, save, uid, User, Role } from "./db";

// Permite usar req.user nas rotas protegidas.
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const signToken = (user: User) => jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: "7d" });

// Nunca devolvemos o hash da senha para o front-end.
const publicUser = ({ passwordHash, ...rest }: User) => rest;

/** Middleware: exige login. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Faça login para continuar." });
  try {
    const { sub } = jwt.verify(token, config.jwtSecret) as { sub: string };
    const user = db.users.find((u) => u.id === sub);
    if (!user) throw new Error("usuário não existe");
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Sessão expirada. Entre novamente." });
  }
}

/** Middleware: exige um perfil específico (use depois do requireAuth). */
export const requireRole = (role: Role) => (req: Request, res: Response, next: NextFunction) =>
  req.user?.role === role ? next() : res.status(403).json({ error: "Você não tem permissão para isso." });

export const authRouter = Router();

authRouter.post("/register", (req, res) => {
  const { name, email, password, directionCode } = req.body ?? {};
  if (!name || !email || !password) return res.status(400).json({ error: "Preencha nome, e-mail e senha." });
  if (String(password).length < 6) return res.status(400).json({ error: "A senha precisa ter pelo menos 6 caracteres." });
  if (db.users.some((u) => u.email === String(email).toLowerCase()))
    return res.status(409).json({ error: "Este e-mail já está cadastrado." });

  // Quem digitar o código da direção vira DIREÇÃO; os demais são PROFESSOR.
  let role: Role = "PROFESSOR";
  if (directionCode) {
    if (directionCode !== config.directionCode) return res.status(400).json({ error: "Código da direção inválido." });
    role = "DIRECAO";
  }

  const user: User = {
    id: uid(),
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    passwordHash: bcrypt.hashSync(String(password), 10),
    role,
  };
  db.users.push(user);
  save();
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

authRouter.post("/login", (req, res) => {
  const { email, password } = req.body ?? {};
  const user = db.users.find((u) => u.email === String(email ?? "").toLowerCase().trim());
  if (!user || !bcrypt.compareSync(String(password ?? ""), user.passwordHash))
    return res.status(401).json({ error: "E-mail ou senha incorretos." });
  res.json({ token: signToken(user), user: publicUser(user) });
});

authRouter.get("/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user!) }));
