// Gera robots.txt e sitemap.xml em build/client a partir das páginas que o pré-render realmente criou
// (build/client/{pt,en}/**/index.html), sem repetir a lista de react-router.config.ts.
// Precisa do domínio (VITE_SITE_URL, o mesmo do canonical); sem ele não há sitemap válido, então só sai o robots.
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const raiz = process.env.RAIZ_BUILD ?? "build/client"
const site = process.env.VITE_SITE_URL?.replace(/\/+$/, "")
const idiomas = ["pt", "en"]

// Sem Disallow de propósito: as telas privadas já mandam noindex (vercel.json); bloquear aqui impediria o robô de ler o noindex.
let robots = "User-agent: *\nAllow: /\n"

// Caminhos (sem o idioma) de cada pasta com index.html, ex.: "/hall-of-fame/2025/fulano".
const achar = (dir, rel = "") =>
  readdirSync(dir).flatMap((n) => {
    const c = join(dir, n)
    if (statSync(c).isDirectory()) return achar(c, `${rel}/${n}`)
    return n === "index.html" && rel ? [rel] : []
  })

if (site) {
  const caminhos = achar(join(raiz, idiomas[0]))
  if (!caminhos.length) throw new Error("gerar-robots-sitemap: nenhuma página pré-renderizada encontrada")
  for (const l of idiomas)
    for (const c of caminhos)
      if (!existsSync(join(raiz, l, c, "index.html"))) throw new Error(`gerar-robots-sitemap: falta /${l}${c}`)

  // Cada segmento codificado para URL e depois escapado para XML.
  const xml = (s) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)
  const url = (l, c) => xml(`${site}/${l}${c.split("/").map(encodeURIComponent).join("/")}`)
  const urls = caminhos.flatMap((c) =>
    idiomas.map((l) => {
      const alternativas = idiomas
        .map((a) => `    <xhtml:link rel="alternate" hreflang="${a}" href="${url(a, c)}"/>`)
        .join("\n")
      return `  <url>\n    <loc>${url(l, c)}</loc>\n${alternativas}\n  </url>`
    }),
  )
  writeFileSync(
    `${raiz}/sitemap.xml`,
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`,
  )
  robots += `\nSitemap: ${xml(site)}/sitemap.xml\n`
} else {
  console.warn("gerar-robots-sitemap: VITE_SITE_URL ausente; sitemap.xml não gerado")
}
writeFileSync(`${raiz}/robots.txt`, robots)
