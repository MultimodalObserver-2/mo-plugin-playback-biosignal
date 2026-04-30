import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { viteReactHostImportAdapter } from "mo-sdk/vite-plugins";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
    plugins: [
        react(),
        viteReactHostImportAdapter(),
        viteStaticCopy({
            targets: [
                {
                    src: "src/assets/*",
                    dest: "assets",
                },
                {
                    src: "src/metadata.json",
                    dest: ".",
                },
            ],
        }),
    ],
    build: {
        lib: {
            entry: {
                main: path.resolve(__dirname, "src", "main.tsx"),
                properties: path.resolve(__dirname, "src", "properties.ts"),
            },
            formats: ["es"],
        },
        rollupOptions: {
            external: ["react", "react-dom", "react/jsx-runtime", "mo-sdk"],
        },
        emptyOutDir: true,
        minify: false,
        outDir: path.resolve(__dirname, "dist"),
    },
});