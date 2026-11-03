import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const ler = (arq: string) => readFileSync(arq, "utf8")
const caminhos = (fonte: string) => [...fonte.matchAll(/path="([^"]+)"/g)].map((m) => m[1])

describe("404 de verdade", () => {
  it("o build copia o index.html para 404.html", () => {
    const raiz = mkdtempSync(join(tmpdir(), "404-"))
    writeFileSync(join(raiz, "index.html"), "<html>spa</html>")
    execFileSync("node", ["scripts/gerar-404.mjs"], { env: { PATH: process.env.PATH ?? "", RAIZ_BUILD: raiz } })
    expect(ler(join(raiz, "404.html"))).toBe("<html>spa</html>")
  })

  it("o build roda gerar-404 depois de externalizar-scripts (404.html sem script inline, que a CSP bloquearia)", () => {
    expect(JSON.parse(ler("package.json")).scripts.build).toMatch(/externalizar-scripts\.mjs.*gerar-404\.mjs/)
  })

  // Aqui a fonte do rewrite roda como RegExp do JavaScript, não pelo path-to-regexp da Vercel; os dois
  // já discordaram ("/" casava aqui e não lá). Ao mudar a fonte, conferir também com @vercel/routing-utils
  // (ou trocar por path-to-regexp aqui se ele entrar como devDependency).

  const re = new RegExp(`^${JSON.parse(ler("vercel.json")).rewrites[0].source}$`)
  const app = ler("src/App.tsx")
  const areas = readdirSync("src/areas").filter((a) => a !== "admin" && existsSync(`src/areas/${a}/rotas.tsx`))
  const membro = [...caminhos(app), ...areas.flatMap((a) => caminhos(ler(`src/areas/${a}/rotas.tsx`)))].filter(
    (p) => p !== "/:lang" && p !== "*",
  )
  const admin = caminhos(ler("src/areas/admin/rotas.tsx"))
  const semPrefixo = JSON.parse(app.match(/\{(\[\s*"\/[^\]]*\])\.map/)![1]) as string[]
  // Exemplo de valor para cada parâmetro (":slug" → "x").
  const url = (p: string) => p.replace(/:[^/]+/g, "x")

  it("as rotas são todas declaradas com path literal (senão o teste abaixo não as enxerga)", () => {
    for (const a of [...areas, "admin"]) expect(ler(`src/areas/${a}/rotas.tsx`)).not.toMatch(/path=\{/)
    expect(membro.length).toBeGreaterThan(30)
    expect(semPrefixo).toContain("/entrar")
  })

  it("o rewrite do vercel.json cobre toda rota do app, nos dois idiomas", () => {
    for (const p of ["/", ...semPrefixo]) expect(re.test(p), p).toBe(true)
    for (const l of ["pt", "en"]) {
      expect(re.test(`/${l}`)).toBe(true)
      expect(re.test(`/${l}/`)).toBe(true)
      for (const p of membro) {
        expect(re.test(`/${l}/${url(p)}`), `/${l}/${p}`).toBe(true)
        expect(re.test(`/${l}/${url(p)}/`), `/${l}/${p}/`).toBe(true)
      }
      for (const p of admin) expect(re.test(`/${l}/admin/${url(p)}`), `/${l}/admin/${p}`).toBe(true)
    }
  })

  it("caminho que não é rota do app não casa (cai no 404.html, status 404)", () => {
    for (const p of ["/pt/nao-existe-xyz", "/xx/abc", "/sobre", "/pt/entrarx", "/ptx/entrar", "/assets/a.js", "/robots.txt", "/404.html"])
      expect(re.test(p), p).toBe(false)
  })
})
