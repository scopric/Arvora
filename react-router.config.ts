import type { Config } from "@react-router/dev/config"
import premiados from "./src/dados/premiados-exemplo.json" with { type: "json" }

const idiomas = ["pt", "en"]

export default {
  appDirectory: "src",
  ssr: false,
  // Só as páginas públicas viram HTML no build; o resto é o SPA (src/rotas/spa.tsx).
  prerender: () =>
    idiomas.flatMap((l) => [
      `/${l}/hall-of-fame`,
      ...premiados.map((p) => `/${l}/hall-of-fame/${p.edicao}/${p.slug}`),
    ]),
} satisfies Config
