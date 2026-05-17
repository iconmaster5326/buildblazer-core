/// <reference types="vitest" />
import path from "path";
import { defineConfig } from "vite";
import packageJson from "./package.json";
import dts from "unplugin-dts/vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "./build/dist/",
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      formats: ["es", "umd"],
      fileName: "index",
      name: packageJson.name,
    },
  },
  test: {
    watch: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@@": path.resolve(__dirname),
    },
  },
  plugins: [dts({ bundleTypes: true })],
});
