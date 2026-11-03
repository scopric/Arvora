import { describe, expect, it } from "vitest"

// Fechamento do redesenho (Decisão 70): os apelidos do sistema anterior saíram do @theme. Este teste barra a volta deles
// em qualquer arquivo de src/ (classe Tailwind, com ou sem variante, e variável CSS). Lê os fontes pelo Vite (sem API de node: o
// tsconfig do app só tem os tipos do navegador).
// Casa a classe Tailwind (com ou sem variante) e a variável CSS; não casa a palavra solta ("bruma" num texto).
const ANTIGO = /\b(?:[a-z-]+:)*(?:bg|text|border(?:-[tblrxyse])?|ring(?:-offset)?|inset-ring|inset-shadow|divide|outline|fill|stroke|from|via|to|decoration|placeholder|shadow|accent|caret)-(?:obsidiana|grafite|nevoa|bruma|osso|flutuante)\b|--(?:color-(?:obsidiana|grafite|nevoa|bruma|osso)|shadow-flutuante)\b/g
const fontes = import.meta.glob<string>("./**/*.{ts,tsx,css}", { query: "?raw", import: "default", eager: true })

describe("tokens antigos", () => {
  it("nenhum apelido do sistema anterior aparece em src/", () => {
    const achados: string[] = []
    for (const [arquivo, texto] of Object.entries(fontes)) {
      if (arquivo.endsWith("tokens-antigos.test.ts")) continue
      for (const m of texto.matchAll(ANTIGO)) achados.push(`${arquivo}: ${m[0]}`)
    }
    expect(Object.keys(fontes).length).toBeGreaterThan(100)
    expect(achados).toEqual([])
  })
})
