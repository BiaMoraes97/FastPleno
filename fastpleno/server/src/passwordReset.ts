import { Router, Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import nodemailer, { type Transporter } from "nodemailer";
import { db, save } from "./db";

const router = Router();
const resetTokens = new Map<string, { userId: string; expiresAt: number }>();

// Guarda a conexão de teste em cache para não criar uma conta nova a cada envio
let cachedTransporter: Transporter | null = null;

async function getMailer() {
  if (cachedTransporter) return cachedTransporter;

  // Se já tiver SMTP configurado no .env, usa ele; senão, cria uma conta de teste Ethereal
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log("📧 Conta de e-mail de teste Ethereal criada:", testAccount.user);
  }

  return cachedTransporter;
}

// ROTA 1: Recebe o e-mail reserva e envia o link
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Informe um e-mail válido." });
    }

    const user = db.users.find((candidate) => candidate.email.toLowerCase() === email);

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = Date.now() + 30 * 60 * 1000;

      resetTokens.set(token, { userId: user.id, expiresAt });

      const resetLink = `${process.env.APP_URL || "http://localhost:5173"}/redefinir-senha?token=${token}`;
      const mailer = await getMailer();

      const info = await mailer.sendMail({
        from: '"FastPleno" <no-reply@fastpleno.com.br>',
        to: email,
        subject: "Redefinição de senha — FastPleno",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0e0c20; color: #ffffff; border-radius: 12px;">
            <h2 style="color: #ffe01b; margin-top: 0;">Recuperação de acesso</h2>
            <p>Olá! Recebemos uma solicitação para redefinir a senha da sua conta no <strong>FastPleno</strong>.</p>
            <p>Clique no botão abaixo para criar uma nova senha (o link expira em 30 minutos):</p>
            <p style="margin: 28px 0;">
              <a href="${resetLink}" style="background: #7b2a96; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">
                Redefinir minha senha
              </a>
            </p>
            <p style="font-size: 12px; color: #9a9fb5;">Se você não solicitou essa alteração, basta ignorar este e-mail.</p>
          </div>
        `,
      });

      // Mostra no terminal do servidor o link para abrir o e-mail de teste no navegador
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log("🔗 Visualize o e-mail enviado aqui:", previewUrl);
      }
    }

    return res.json({ message: "Se o e-mail estiver cadastrado, o link foi enviado." });
  } catch (err) {
    console.error("Erro ao enviar e-mail de recuperação:", err);
    return res.status(500).json({ message: "Erro interno ao processar a solicitação." });
  }
});

// ROTA 2: Recebe o token e a nova senha para efetivar a troca
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body ?? {};

    if (typeof token !== "string" || typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ message: "Token inválido ou senha muito curta (mínimo 6 caracteres)." });
    }

    const record = resetTokens.get(token);
    if (!record || record.expiresAt < Date.now()) {
      resetTokens.delete(token);
      return res.status(400).json({ message: "Este link expirou ou já foi utilizado. Solicite um novo." });
    }

    const user = db.users.find((candidate) => candidate.id === record.userId);
    if (!user) {
      resetTokens.delete(token);
      return res.status(400).json({ message: "Este link expirou ou já foi utilizado. Solicite um novo." });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const previousPasswordHash = user.passwordHash;
    user.passwordHash = passwordHash;
    try {
      save();
    } catch (error) {
      user.passwordHash = previousPasswordHash;
      throw error;
    }

    resetTokens.delete(token);
    return res.json({ message: "Senha alterada com sucesso!" });
  } catch (err) {
    console.error("Erro ao redefinir senha:", err);
    return res.status(500).json({ message: "Não foi possível redefinir a senha." });
  }
});

export default router;