import { describe, expect, it } from "vitest"
import fonte from "./index.css?raw"

// Trava do contrato do vidro (Decisões 70 e 71, fechamento de 03/11/2026). No fluxo, `vidro` (cartão) e `vidro-fundo`
// (bloco escuro) não desfocam; só o que fica por cima de conteúdo que rola tem backdrop-filter (`vidro-barra`,
// `vidro-flutuante`); o fallback de prefers-reduced-transparency mora dentro de cada utility (em @layer base perderia
// sempre); e vidro dentro de vidro vira caixa de ardósia por uma regra fora de camada. Lê o CSS pelo Vite (?raw, com
// `test.css.include` no vite.config.ts): o tsconfig do app só tem os tipos do navegador, sem node:fs.

// Sem comentários: eles citam `backdrop-filter` e `vidro` ao lado dos blocos e enganariam as regex.
const css = fonte.replace(/\/\*[\s\S]*?\*\//g, "")

// Corpo de cada bloco cujo cabeçalho casa com a regex (flag g, terminando no `{`). Conta chaves para atravessar os
// @media/@supports aninhados dentro da utility.
function blocos(texto: string, cabecalho: RegExp): string[] {
  const corpos: string[] = []
  for (const m of texto.matchAll(cabecalho)) {
    const inicio = m.index + m[0].length
    let i = inicio
    let nivel = 1
    while (nivel > 0 && i < texto.length) {
      if (texto[i] === "{") nivel++
      else if (texto[i] === "}") nivel--
      i++
    }
    corpos.push(texto.slice(inicio, i - 1))
  }
  return corpos
}
const utility = (nome: string): string | undefined => blocos(css, new RegExp(`@utility\\s+${nome}\\s*\\{`, "g"))[0]

const REDUZIDA = /@media\s*\(\s*prefers-reduced-transparency\s*:\s*reduce\s*\)\s*\{/g
const SEM_SUPORTE = /@supports\s+not\s*\(\s*backdrop-filter\s*:[^{]*\{/g
// Declaração completa (termina em `;`), não a condição do @supports: não pode vir logo depois de `(`.
const DESFOQUE = /(?<![(\w-])backdrop-filter\s*:[^;{}]*\bblur\([^;{}]*;/
const ANINHADO = /:is\(\s*\.vidro\s*,\s*\.vidro-fundo\s*,\s*\.vidro-barra\s*,\s*\.vidro-flutuante\b[^{]*\{/g

describe("contrato do vidro (index.css)", () => {
  it("o CSS chegou ao teste (sem `test.css.include`, o vitest entrega texto vazio)", () => {
    expect(css).toContain("@utility vidro")
    expect(blocos(css, /@layer\s+base\s*\{/g)).not.toHaveLength(0)
  })

  it.each(["vidro", "vidro-fundo"])("`%s` (no fluxo) existe e não desfoca", (nome) => {
    const corpo = utility(nome)
    expect(corpo).toBeDefined()
    expect(corpo).not.toMatch(/backdrop-filter/)
  })

  it.each(["vidro-barra", "vidro-flutuante"])("`%s` (por cima do conteúdo) desfoca e fica opaco sem suporte a backdrop-filter", (nome) => {
    const corpo = utility(nome)
    expect(corpo).toBeDefined()
    expect(corpo).toMatch(DESFOQUE)
    const [semSuporte] = blocos(corpo ?? "", SEM_SUPORTE)
    expect(semSuporte).toMatch(/background-color\s*:\s*var\(--color-[a-z-]+\)/)
  })

  it.each(["vidro", "vidro-fundo", "vidro-barra", "vidro-flutuante"])("`%s` tem o fallback de prefers-reduced-transparency dentro da própria utility", (nome) => {
    const corpo = utility(nome)
    expect(corpo).toBeDefined()
    const [fallback] = blocos(corpo ?? "", REDUZIDA)
    expect(fallback).toBeDefined()
    expect(fallback).toMatch(/background-color\s*:\s*var\(--color-[a-z-]+\)/)
    if (nome === "vidro-barra" || nome === "vidro-flutuante") expect(fallback).toMatch(/backdrop-filter\s*:\s*none\b/)
  })

  it("só a barra, a tab bar e os flutuantes usam as utilities que desfocam; a barra superior leva o vidro no ::before", () => {
    const fontes = import.meta.glob<string>("./**/*.tsx", { query: "?raw", import: "default", eager: true })
    const usos = (re: RegExp) => Object.entries(fontes).filter(([, t]) => re.test(t)).map(([a]) => a).sort()
    // Sem prefixo de variante: a utility direto no elemento.
    expect(usos(/(?<![:\w-])vidro-barra\b/)).toEqual(["./componentes/LayoutMembro.tsx"])
    // Comunidade: o menu "⋯" do post (popover na camada de cima; o cartão em volta é `vidro`, sem desfoque próprio).
    expect(usos(/(?<![:\w-])vidro-flutuante\b/)).toEqual(["./areas/rede/componentes.tsx", "./areas/rede/telas/Comunidade.tsx", "./componentes/DialogoConfirmar.tsx", "./componentes/LayoutMembro.tsx"])
    const layout = fontes["./componentes/LayoutMembro.tsx"]
    expect(layout).toMatch(/before:vidro-barra/)
    // A barra superior (pai do popover) não pode ter backdrop-filter próprio: vira "backdrop root" e o popover não desfoca a página.
    expect(layout).not.toMatch(/<div className="[^"]*(?<![:\w-])vidro-barra[^"]*">\s*\n?\s*<Marca/)
  })

  it("vidro aninhado é neutralizado por uma regra fora de camada; a variante conta como ancestral e, em lg, como descendente", () => {
    const posicao = css.search(ANINHADO)
    expect(posicao).toBeGreaterThanOrEqual(0)
    // Fora de camada: nenhuma chave fica aberta antes do seletor.
    const antes = css.slice(0, posicao)
    expect(antes.match(/\{/g)?.length ?? 0).toBe(antes.match(/\}/g)?.length ?? 0)
    const seletor = css.slice(posicao, css.indexOf("{", posicao))
    expect(seletor).toMatch(/\[class\*=":vidro"\]\s*\)\s*:is\(/)
    expect(seletor).not.toMatch(/\)\s*:is\([^)]*vidro-flutuante/)
    // `lg:vidro-fundo` como descendente: só a partir de lg (abaixo disso ele não é vidro).
    const [lg] = blocos(css, /@media\s*\(\s*width\s*>=\s*64rem\s*\)\s*\{/g).filter((c) => c.includes("lg\\:vidro-fundo"))
    expect(lg).toMatch(/\.lg\\:vidro-fundo\s*\{[^}]*var\(--color-ardosia\)/)
    const [corpo] = blocos(css, ANINHADO)
    expect(corpo).toMatch(/backdrop-filter\s*:\s*none\b/)
    expect(corpo).toMatch(/var\(--color-ardosia\)/)
  })

  it("nenhum @layer base contém .vidro", () => {
    for (const base of blocos(css, /@layer\s+base\s*\{/g)) expect(base).not.toMatch(/\.vidro\b/)
  })
})
