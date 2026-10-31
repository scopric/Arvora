import { describe, expect, it } from "vitest"
// @ts-expect-error módulo .mjs sem tipos
import { faltando } from "./checar-ambiente.mjs"

describe("checar-ambiente", () => {
  it("aponta o que falta e ignora valor vazio", () => {
    expect(faltando({})).toEqual(["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"])
    expect(faltando({ VITE_SUPABASE_URL: "http://x", VITE_SUPABASE_PUBLISHABLE_KEY: " " })).toEqual(["VITE_SUPABASE_PUBLISHABLE_KEY"])
    expect(faltando({ VITE_SUPABASE_URL: "http://x", VITE_SUPABASE_PUBLISHABLE_KEY: "k" })).toEqual([])
  })
})
