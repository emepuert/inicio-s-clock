import { defineConfig } from "vite";

/** Chemins relatifs : fonctionne sur GitHub Pages (/repo/) sans dépendre du sous-chemin exact */
export default defineConfig({
  base: "./",
});
