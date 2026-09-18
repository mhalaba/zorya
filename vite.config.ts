import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const api = {
  "/api": { target: "http://127.0.0.1:8787", ws: true },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: api,
  },
  preview: {
    port: 5173,
    proxy: api,
  },
});
