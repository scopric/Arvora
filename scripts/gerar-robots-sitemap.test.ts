import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const SCRIPT = "scripts/gerar-robots-sitemap.mjs"

function build(paginas: string[]) {
  const raiz = mkdtempSync(join(tmpdir(), "sitemap-"))
  for (const p of paginas) {
    mkdirSync(join(raiz, p), { recursive: true })
    writeFileSync(join(raiz, p, "index.html"), "")
  }
  return raiz
}
const rodar = (raiz: string, env: Record<string, string>) =>
  execFileSync("node", [SCRIPT], { env: { PATH: process.env.PATH ?? "", RAIZ_BUILD: raiz, ...env }, stdio: "pipe" })

describe("robots.txt e sitemap.xml", () => {
  it("lista cada página pré-renderizada nos dois idiomas, com hreflang e escape", () => {
    const raiz = build(["pt/hall-of-fame", "en/hall-of-fame", "pt/hall-of-fame/2025/a&b", "en/hall-of-fame/2025/a&b"])
    rodar(raiz, { VITE_SITE_URL: "https://x.test/" })
    const xml = readFileSync(join(raiz, "sitemap.xml"), "utf8")
    expect(xml.match(/<loc>/g)).toHaveLength(4)
    expect(xml).toContain("<loc>https://x.test/en/hall-of-fame/2025/a%26b</loc>")
    expect(xml).not.toContain("a&b")
    expect(readFileSync(join(raiz, "robots.txt"), "utf8")).toContain("Sitemap: https://x.test/sitemap.xml")
  })

  it("falha se uma página existe só em um idioma", () => {
    const raiz = build(["pt/hall-of-fame"])
    expect(() => rodar(raiz, { VITE_SITE_URL: "https://x.test" })).toThrow()
  })

  it("sem domínio: só robots, sem sitemap", () => {
    const raiz = build(["pt/hall-of-fame", "en/hall-of-fame"])
    rodar(raiz, {})
    expect(existsSync(join(raiz, "sitemap.xml"))).toBe(false)
    expect(readFileSync(join(raiz, "robots.txt"), "utf8")).not.toContain("Sitemap")
  })

  it("o rewrite do vercel.json deixa robots.txt e sitemap.xml passarem", () => {
    const fonte = JSON.parse(readFileSync("vercel.json", "utf8")).rewrites[0].source as string
    const re = new RegExp(`^${fonte}$`)
    expect(re.test("/robots.txt")).toBe(false)
    expect(re.test("/sitemap.xml")).toBe(false)
    expect(re.test("/pt/entrar")).toBe(true)
  })
})
