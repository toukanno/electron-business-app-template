import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { execSync } from "node:child_process";

const rootDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(rootDir, "..");
const rendererDist = resolve(projectRoot, "dist", "renderer");

mkdirSync(rendererDist, { recursive: true });

await build({
  bundle: true,
  entryPoints: [resolve(projectRoot, "src", "renderer", "main.tsx")],
  format: "iife",
  outfile: resolve(rendererDist, "main.js"),
  platform: "browser",
  sourcemap: false,
  target: "es2022",
  jsx: "automatic"
});

copyFileSync(resolve(projectRoot, "src", "renderer", "index.html"), resolve(rendererDist, "index.html"));
const tailwindBinary = resolve(projectRoot, "node_modules", ".bin", process.platform === "win32" ? "tailwindcss.cmd" : "tailwindcss");
const inputCss = resolve(projectRoot, "src", "renderer", "styles.css");
const outputCss = resolve(rendererDist, "styles.css");

execSync(`"${tailwindBinary}" -i "${inputCss}" -o "${outputCss}"`, { stdio: "inherit" });
