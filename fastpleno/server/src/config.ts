// Todas as configurações do servidor ficam aqui (valores vêm do arquivo .env).
import "dotenv/config";
import path from "path";

export const config = {
  port: Number(process.env.PORT) || 3001,
  jwtSecret: process.env.JWT_SECRET || "troque-este-segredo",
  directionCode: process.env.DIRECTION_CODE || "FASTPLENO-DIRECAO-2026",
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
  mockAi: process.env.MOCK_AI === "true",
  enableDemo: process.env.ENABLE_DEMO !== "false",
  uploadsDir: path.resolve("uploads"), // onde ficam os arquivos enviados e formatados
  dataFile: path.resolve("data/db.json"), // "banco de dados" (arquivo JSON)
};
