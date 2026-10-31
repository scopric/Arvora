import { describe, expect, it } from "vitest"
// @ts-expect-error módulo .mjs sem tipos
import { faltando, hostForaDaCsp } from "./checar-ambiente.mjs"

describe("checar-ambiente", () => {
  it("aponta o que falta e ignora valor vazio", () => {
    expect(faltando({})).toEqual(["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"])
    expect(faltando({ VITE_SUPABASE_URL: "http://x", VITE_SUPABASE_PUBLISHABLE_KEY: " " })).toEqual(["VITE_SUPABASE_PUBLISHABLE_KEY"])
    expect(faltando({ VITE_SUPABASE_URL: "http://x", VITE_SUPABASE_PUBLISHABLE_KEY: "k" })).toEqual([])
  })

  it("host remoto fora da CSP é apontado; dentro da CSP e host local passam", () => {
    const csp = "connect-src 'self' https://abc.supabase.co"
    expect(hostForaDaCsp("https://abc.supabase.co", csp)).toBe(false)
    expect(hostForaDaCsp("https://outro.supabase.co", csp)).toBe(true)
    expect(hostForaDaCsp("http://127.0.0.1:55321", csp)).toBe(false)
  })
})
