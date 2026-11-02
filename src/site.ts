// Domínio final ainda indefinido: o padrão é provisório. Quando sair, definir VITE_SITE_URL no build (Vercel), sem mexer no código.
// Barra final fora: os endereços são comparados com location.origin.
const semBarra = (u: string) => u.replace(/\/+$/, "")
export const SITE_URL = semBarra(import.meta.env.VITE_SITE_URL || "https://piloto.example")
// Área do membro e painel em endereços próprios (Decisão 66). Sem a variável, ficam no mesmo endereço do site (local e prévias).
export const APP_URL = semBarra(import.meta.env.VITE_APP_URL || SITE_URL)
export const ADMIN_URL = semBarra(import.meta.env.VITE_ADMIN_URL || APP_URL)
export const IDIOMAS = ["pt", "en"] as const
export type Idioma = (typeof IDIOMAS)[number]
export const LANG_HTML: Record<Idioma, string> = { pt: "pt-BR", en: "en" }

export function idiomaValido(valor: string | undefined): Idioma {
  if (valor === "pt" || valor === "en") return valor
  throw new Response("Idioma não encontrado", { status: 404 })
}

// canonical e hreflang apontam para a mesma página nos dois idiomas.
export function linksIdioma(lang: Idioma, caminho: string) {
  return [
    { rel: "canonical", href: `${SITE_URL}/${lang}${caminho}` },
    ...IDIOMAS.map((l) => ({
      rel: "alternate",
      hrefLang: l,
      href: `${SITE_URL}/${l}${caminho}`,
    })),
  ]
}
