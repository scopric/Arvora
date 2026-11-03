import { describe, expect, it } from "vitest"
import { areaDe, destinoArea } from "./navegacao"

describe("navegação do membro", () => {
  it("destinoArea: o Clube entra em Aprender pelo Academy; o Grupo pelas Aulas; sem nível, a rota da área", () => {
    expect(destinoArea("/aulas", "clube")).toBe("/academy")
    expect(destinoArea("/aulas", "grupo")).toBe("/aulas")
    expect(destinoArea("/aulas", null)).toBe("/aulas")
    expect(destinoArea("/inicio", "clube")).toBe("/inicio")
    expect(destinoArea("/network", "clube")).toBe("/network")
  })
  it("destinoArea: área cuja rota não é seção fica onde está; sem nenhuma seção aberta, também", () => {
    expect(destinoArea("/awards", "clube")).toBe("/awards")
    expect(destinoArea("/awards", "grupo")).toBe("/awards")
    expect(destinoArea("/network", "visitante")).toBe("/network") // Rede sem seção aberta: a tela da área mostra o cadeado
    expect(destinoArea("/aulas", "visitante")).toBe("/aulas") // Academy também é do Clube para cima (PRD §17.3.5)
  })
  it("areaDe: as seções apontam para a área certa", () => {
    expect(areaDe("/academy")?.rota).toBe("/aulas")
    expect(areaDe("/conexoes")?.rota).toBe("/network")
    expect(areaDe("/hall-of-fame")?.rota).toBe("/awards")
  })
})
