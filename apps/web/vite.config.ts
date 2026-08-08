import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@edtemps/domain": path.resolve(__dirname, "../../packages/domain/src/index.ts"),
    },
  },
  server: { port: 5173, strictPort: true },
});
