import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const standalone = mode === "rowan";
  // The dev server also passes process.env to database/gate configuration.
  if (standalone) process.env.ROWAN_STANDALONE = "true";
  return {
    define: standalone ? { "process.env.ROWAN_STANDALONE": JSON.stringify("true") } : {},
    build: { outDir: standalone ? "dist-rowan" : "dist" },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        ...(standalone ? { srcDirectory: "apps/rowan" } : {}),
        server: { entry: standalone ? "../../src/server" : "index" },
        importProtection: {
          behavior: "error",
          client: {
            files: ["**/server/**"],
            specifiers: ["server-only"],
          },
        },
      }),
      react(),
    ],
    server: {
      host: "0.0.0.0",
      port: 5000,
      strictPort: true,
    },
    resolve: {
      alias: {
        "@": path.resolve(process.cwd(), "src"),
        "@shared": path.resolve(process.cwd(), "shared"),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
  };
});
