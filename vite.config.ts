import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" so the build works from any folder or static host (the router uses the URL hash).
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { host: "127.0.0.1", port: 8017, strictPort: true },
});
