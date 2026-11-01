import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const DEV_PORT = 5174;
const DEFAULT_API_PROXY_TARGET = "http://localhost:3001";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: DEV_PORT,
      strictPort: true,
      proxy: {
        "/api": env.VITE_API_PROXY_TARGET || DEFAULT_API_PROXY_TARGET,
      },
    },
  };
});
