import { defineConfig } from "vite";

/** GitHub Pages projet : https://emepuert.github.io/inicio-s-clock/ */
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/inicio-s-clock/" : "/",
}));
