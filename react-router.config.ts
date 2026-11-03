import type { Config } from "@react-router/dev/config"

// Tudo é SPA: o Hall of Fame lê o banco no navegador (Decisão 67), então nada é pré-renderizado.
export default {
  appDirectory: "src",
  ssr: false,
} satisfies Config
