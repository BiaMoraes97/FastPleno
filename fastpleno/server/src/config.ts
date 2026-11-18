// Todas as configurações do servidor ficam aqui (valores vêm do arquivo .env).
import "dotenv/config";
import path from "path";

export const config = {
  port: Number(process.env.PORT) || 3001,
  jwtSecret: process.env.JWT_SECRET || "troque-este-segredo",
  directionCode: process.env.DIRECTION_CODE || "FASTPLENO-DIRECAO-2026",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  mockAi: process.env.MOCK_AI === "true",
  enableDemo: process.env.ENABLE_DEMO === "true",
  dataFile: path.resolve(__dirname, "../data/db.json"),
  uploadsDir: path.resolve(__dirname, "../uploads"),
};