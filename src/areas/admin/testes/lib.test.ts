import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("../../../lib/supabase", async () => ({ supabase: (await import("./mockSupabase")).supabase }))
import { useCarga } from "../lib/consulta"
import { paraCarga, paraValores, type CampoDef } from "../lib/campos"
import { cicloAnterior, cicloDe, cicloFim, decimalParaCentavos, isoParaLocal, localParaIso, slugificar } from "../lib/formato"
import { camposParaRedes, diasAte, estadoAula, faseDe } from "../lib/regras"

describe("hora de Dublin", () => {
  it("inverno (GMT) e verão (IST) viram o instante UTC certo", () => {
    expect(localParaIso("2026-10-31T20:00")).toBe("2026-10-31T20:00:00.000Z")
    expect(localParaIso("2026-07-01T12:00")).toBe("2026-07-01T11:00:00.000Z")
  })
  it("ida e volta devolve o mesmo texto", () => {
    for (const l of ["2026-03-29T00:30", "2026-03-29T03:00", "2026-10-25T01:30", "2026-12-24T09:15"]) expect(isoParaLocal(localParaIso(l))).toBe(l)
  })
})

describe("Ciclo de dia 10 a dia 9", () => {
  it("acha o Ciclo da data, o anterior e o fim", () => {
    expect(cicloDe("2026-10-31")).toBe("2026-10-10")
    expect(cicloDe("2026-11-09")).toBe("2026-10-10")
    expect(cicloDe("2026-11-10")).toBe("2026-11-10")
    expect(cicloDe("2026-01-05")).toBe("2025-12-10")
    expect(cicloAnterior("2026-01-10")).toBe("2025-12-10")
    expect(cicloFim("2026-10-10")).toBe("2026-11-09")
    expect(cicloFim("2026-12-10")).toBe("2027-01-09")
  })
})

describe("textos e números", () => {
  it("valor em reais/euros vira centavos; lixo vira null", () => {
    expect(decimalParaCentavos("150,00")).toBe(15000)
    expect(decimalParaCentavos("0.29")).toBe(29)
    expect(decimalParaCentavos("12,5")).toBe(1250)
    expect(decimalParaCentavos("12,555")).toBeNull()
    expect(decimalParaCentavos("abc")).toBeNull()
  })
  it("slug sem acento", () => expect(slugificar("Empreendedor do Ano — Inovação!")).toBe("empreendedor-do-ano-inovacao"))
  it("prazo em dias", () => expect(diasAte("2026-11-05", "2026-10-31")).toBe(5))
})

describe("regras das telas", () => {
  it("estado da aula e fase da edição", () => {
    expect(estadoAula({ agendada_em: null, materiais_publicados_em: null })).toBe("rascunho")
    expect(estadoAula({ agendada_em: "2026-01-01", materiais_publicados_em: null })).toBe("agendada")
    expect(estadoAula({ agendada_em: "2026-01-01", materiais_publicados_em: "2026-01-02" })).toBe("publicados")
    const e = { durante_inicio: "2026-05-10T00:00:00Z", durante_fim: "2026-05-11T00:00:00Z" }
    expect(faseDe(e, Date.parse("2026-05-01T00:00:00Z"))).toBe("antes")
    expect(faseDe(e, Date.parse("2026-05-10T12:00:00Z"))).toBe("durante")
    expect(faseDe(e, Date.parse("2026-06-01T00:00:00Z"))).toBe("depois")
  })
  it("redes preserva chaves desconhecidas e tira as vazias", () => {
    expect(camposParaRedes({ redes_instagram: "@a", redes_linkedin: "", redes_site: "" }, { linkedin: "x", tiktok: "t" })).toEqual({ instagram: "@a", tiktok: "t" })
  })
})

describe("formulário genérico", () => {
  const campos: CampoDef[] = [
    { chave: "nome", rotulo: "admin.comum.nome", tipo: "texto", obrigatorio: true },
    { chave: "slug", rotulo: "admin.comum.slug", tipo: "texto", slugDe: "nome" },
    { chave: "ordem", rotulo: "admin.comum.ordem", tipo: "numero" },
    { chave: "inicio", rotulo: "admin.comum.nome", tipo: "dataHora" },
    { chave: "publicado_em", rotulo: "admin.comum.publicar", tipo: "publicado" },
    { chave: "convite", rotulo: "admin.comum.email", tipo: "email", soEscrita: true },
  ]
  it("obrigatório vazio e número inválido dão erro por campo", () => {
    const { erros } = paraCarga(campos, { nome: " ", slug: "", ordem: "x", inicio: "", publicado_em: false, convite: "" }, null)
    expect(erros).toEqual({ nome: "obrigatorio", ordem: "numero" })
  })
  it("slug sai do nome, vazio vira null, soEscrita em branco não entra, publicado mantém a data antiga", () => {
    const v = paraValores(campos, { nome: "Ana", publicado_em: "2026-01-01T00:00:00Z", convite: "segredo@x.invalid" })
    expect(v.convite).toBe("")
    const { carga, erros } = paraCarga(campos, { ...v, nome: "Árvore Nova", inicio: "2026-07-01T12:00" }, { publicado_em: "2026-01-01T00:00:00Z" })
    expect(erros).toEqual({})
    expect(carga).toMatchObject({ nome: "Árvore Nova", slug: "arvore-nova", inicio: "2026-07-01T11:00:00.000Z", publicado_em: "2026-01-01T00:00:00Z" })
    expect("convite" in carga).toBe(false)
  })
  it("ordem vazia não entra na carga (o banco usa 0 ou mantém o valor); preenchida entra como número", () => {
    const base = { nome: "Ana", slug: "", inicio: "", publicado_em: false, convite: "" }
    expect("ordem" in paraCarga(campos, { ...base, ordem: " " }, null).carga).toBe(false)
    expect(paraCarga(campos, { ...base, ordem: "3" }, null).carga.ordem).toBe(3)
  })
})

describe("useCarga", () => {
  it("recarregar mantém os dados na tela (sem voltar a 'carregando'); trocar as deps volta a carregar", async () => {
    let n = 0
    const { result, rerender } = renderHook(({ dep }) => useCarga(async () => ++n, [dep]), { initialProps: { dep: "a" } })
    expect(result.current.fase).toBe("carregando")
    await waitFor(() => expect(result.current.fase).toBe("pronto"))
    act(() => result.current.recarregar())
    expect(result.current).toMatchObject({ fase: "pronto", dados: 1, recarregando: true })
    await waitFor(() => expect(result.current).toMatchObject({ fase: "pronto", dados: 2 }))
    rerender({ dep: "b" })
    expect(result.current.fase).toBe("carregando")
  })
})
