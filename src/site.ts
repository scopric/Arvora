// Piloto: o domínio final ainda não existe (Decisões 29). Troque aqui quando houver.
export const SITE_URL = "https://piloto.example"
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
