import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";


export default defineConfig(({ mode }) => ({
  base: "/environment-ingress",   // 👈 put it here, top-level
  server: {
    host: "::",
    port: 8080,
  },
  preview: {
    allowedHosts: ["infinitai.sifymdp.digital","aiplatform-uat.sifymdp.digital"],
    
  },
  plugins: [
    react()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
