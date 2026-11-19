import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em desenvolvimento, chamadas para /api são encaminhadas ao servidor Node (porta 3001).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://localhost:3001" },
    watch: {
      ignored: ["**/public/prints/**"],
    },
  },
});
