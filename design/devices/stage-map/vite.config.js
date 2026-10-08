import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { target: "es2020", chunkSizeWarningLimit: 1500 },
  server: { port: 5201 },
  preview: { port: 5201, strictPort: true },
});
