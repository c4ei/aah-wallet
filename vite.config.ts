import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri 개발 서버에서 사용할 고정 포트입니다.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] }
  }
});
