import { cleanup, render } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, describe, expect, it } from "vitest"
import { simularDialog } from "../testeUtil"
import { Abas } from "./Abas"
import { Aviso } from "./Aviso"
import { Bloqueado } from "./Bloqueado"
import { Botao } from "./Botao"
import { Campo, Selecao } from "./Campo"
import { Cartao } from "./Cartao"
import { DialogoConfirmar } from "./DialogoConfirmar"
import { Erro } from "./Erro"
import { Esqueleto } from "./Esqueleto"
import { Marca } from "./Marca"
import { SeletorIdioma } from "./SeletorIdioma"
import { Selo } from "./Selo"
import { Tabela } from "./Tabela"
import { Vazio } from "./Vazio"

simularDialog()
afterEach(cleanup)

// Trava do redesenho (Decisão 54): fora do EscopoApp, o HTML dos componentes compartilhados tem de ficar byte a byte
// igual ao do site público aprovado. Se este teste quebrar, o público mudou: ou foi de propósito (atualize o snapshot
// e diga no commit), ou vazou.
const html = (ui: ReactNode) =>
  render(
    <MemoryRouter initialEntries={["/pt/x"]}>
      <Routes>
        <Route path="/:lang/*" element={ui} />
      </Routes>
    </MemoryRouter>,
  ).container.innerHTML

describe("público intacto", () => {
  it("Botao", () => {
    expect(html(<><Botao>a</Botao><Botao variante="contorno" ocupado>b</Botao><Botao disabled>c</Botao></>)).toMatchInlineSnapshot(`"<button class="inline-flex min-h-12 w-full items-center justify-center rounded-lg px-6 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado disabled:cursor-not-allowed disabled:opacity-60 bg-creme text-fundo hover:bg-white ">a</button><button disabled="" aria-busy="true" class="inline-flex min-h-12 w-full items-center justify-center rounded-lg px-6 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado disabled:cursor-not-allowed disabled:opacity-60 border border-creme/30 text-creme hover:border-creme/60 ">Aguarde…</button><button disabled="" class="inline-flex min-h-12 w-full items-center justify-center rounded-lg px-6 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado disabled:cursor-not-allowed disabled:opacity-60 bg-creme text-fundo hover:bg-white ">c</button>"`)
  })
  it("Cartao", () => {
    expect(html(<Cartao className="x">a</Cartao>)).toMatchInlineSnapshot(`"<div class="rounded-2xl border border-current/15 bg-superficie/25 p-6 x">a</div>"`)
  })
  it("Campo e Selecao", () => {
    expect(html(<><Campo rotulo="a" ajuda="b" /><Campo rotulo="c" erro="d" /><Selecao rotulo="e"><option>f</option></Selecao></>)).toMatchInlineSnapshot(`"<div><label for="_r_0_" class="mb-2 block text-sm font-semibold text-creme">a</label><input id="_r_0_" aria-describedby="_r_0_-ajuda" class="w-full rounded-lg border bg-transparent px-4 py-3 text-base text-creme placeholder:text-creme/40 outline-none transition-colors focus-visible:border-dourado focus-visible:ring-2 focus-visible:ring-dourado/40 border-creme/25 "><p id="_r_0_-ajuda" class="mt-2 text-sm text-creme/60">b</p></div><div><label for="_r_1_" class="mb-2 block text-sm font-semibold text-creme">c</label><input id="_r_1_" aria-invalid="true" aria-describedby="_r_1_-erro" class="w-full rounded-lg border bg-transparent px-4 py-3 text-base text-creme placeholder:text-creme/40 outline-none transition-colors focus-visible:border-dourado focus-visible:ring-2 focus-visible:ring-dourado/40 border-red-300 "><p id="_r_1_-erro" role="alert" class="mt-2 text-sm text-red-300">d</p></div><div><label for="_r_2_" class="mb-2 block text-sm font-semibold text-creme">e</label><select id="_r_2_" class="w-full rounded-lg border bg-transparent px-4 py-3 text-base text-creme placeholder:text-creme/40 outline-none transition-colors focus-visible:border-dourado focus-visible:ring-2 focus-visible:ring-dourado/40 border-creme/25 "><option>f</option></select></div>"`)
  })
  it("Tabela", () => {
    expect(html(<Tabela colunas={[{ chave: "a", titulo: "A", celula: (l: { a: string }) => l.a }]} linhas={[{ a: "1" }]} id={(l) => l.a} legenda="t" />)).toMatchInlineSnapshot(`"<div role="region" aria-label="t. Tabela com rolagem lateral" tabindex="0" class="overflow-x-auto rounded-xl border border-current/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"><table class="w-full min-w-max text-left text-sm"><caption class="sr-only">t</caption><thead class="border-b border-current/15 bg-current/5"><tr><th scope="col" class="px-4 py-3 font-semibold">A</th></tr></thead><tbody class="divide-y divide-current/10"><tr><td class="px-4 py-3">1</td></tr></tbody></table></div>"`)
  })
  it("Abas", () => {
    expect(html(<Abas rotulo="r" abas={[{ chave: "a", rotulo: "A", conteudo: "1" }, { chave: "b", rotulo: "B", conteudo: "2" }]} />)).toMatchInlineSnapshot(`"<div><div role="tablist" aria-label="r" class="flex gap-1 overflow-x-auto border-b border-current/15"><button id="_r_3_-aba-a" type="button" role="tab" aria-selected="true" aria-controls="_r_3_-painel-a" tabindex="0" class="min-h-11 shrink-0 border-b-2 border-transparent px-4 font-semibold opacity-70 transition-colors hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado aria-selected:border-destaque aria-selected:opacity-100">A</button><button id="_r_3_-aba-b" type="button" role="tab" aria-selected="false" aria-controls="_r_3_-painel-b" tabindex="-1" class="min-h-11 shrink-0 border-b-2 border-transparent px-4 font-semibold opacity-70 transition-colors hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado aria-selected:border-destaque aria-selected:opacity-100">B</button></div><div id="_r_3_-painel-a" role="tabpanel" aria-labelledby="_r_3_-aba-a" class="pt-6">1</div><div id="_r_3_-painel-b" role="tabpanel" aria-labelledby="_r_3_-aba-b" hidden="" class="pt-6"></div></div>"`)
  })
  it("Selo", () => {
    expect(html(<><Selo>a</Selo><Selo tom="destaque">b</Selo><Selo tom="dourado">c</Selo><Selo tom="alerta">d</Selo></>)).toMatchInlineSnapshot(`"<span class="inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold tracking-wide border-current/30">a</span><span class="inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold tracking-wide border-destaque text-destaque">b</span><span class="inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold tracking-wide border-dourado text-dourado">c</span><span class="inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold tracking-wide border-red-300/60 text-red-200">d</span>"`)
  })
  it("Aviso", () => {
    expect(html(<><Aviso tipo="erro">a</Aviso><Aviso tipo="ok">b</Aviso></>)).toMatchInlineSnapshot(`"<p role="alert" class="rounded-lg border px-4 py-3 text-sm border-red-300/60 text-red-200">a</p><p role="status" class="rounded-lg border px-4 py-3 text-sm border-destaque/60 text-destaque">b</p>"`)
  })
  it("Erro", () => {
    expect(html(<Erro aoTentar={() => {}}>a</Erro>)).toMatchInlineSnapshot(`"<div role="alert" class="rounded-2xl border border-red-300/60 px-6 py-8"><p class="max-w-prose">a</p><button class="inline-flex min-h-12 w-full items-center justify-center rounded-lg px-6 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado disabled:cursor-not-allowed disabled:opacity-60 border border-creme/30 text-creme hover:border-creme/60 mt-5 sm:w-auto">Tentar de novo</button></div>"`)
  })
  it("Esqueleto", () => {
    expect(html(<Esqueleto linhas={2} />)).toMatchInlineSnapshot(`"<div role="status" aria-busy="true" aria-label="Carregando o conteúdo" class="space-y-3 "><div aria-hidden="true" class="h-5 animate-pulse rounded-lg bg-current/15 motion-reduce:animate-none w-full"></div><div aria-hidden="true" class="h-5 animate-pulse rounded-lg bg-current/15 motion-reduce:animate-none w-2/3"></div></div>"`)
  })
  it("Vazio", () => {
    expect(html(<Vazio titulo="t" acao={<a href="/x">x</a>}>a</Vazio>)).toMatchInlineSnapshot(`"<div class="rounded-2xl border border-current/15 px-6 py-12 text-center"><h2 class="font-titulo text-3xl font-bold uppercase">t</h2><p class="mx-auto max-w-prose opacity-75 mt-3">a</p><div class="mt-6 flex justify-center"><a href="/x">x</a></div></div>"`)
  })
  it("Bloqueado", () => {
    expect(html(<><Bloqueado frase="a" /><Bloqueado frase="b" minimo="clube" previa={<p>p</p>} /></>)).toMatchInlineSnapshot(`"<section aria-label="Bloqueado: parte do Grupo Árvora" class="relative overflow-hidden rounded-2xl border border-current/15"><div class="flex flex-col items-start gap-4 p-6 "><p class="flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.2em] text-destaque uppercase"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="size-4"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 018 0v4"></path></svg>Bloqueado: parte do Grupo Árvora</p><p class="max-w-prose text-lg">a</p><a class="inline-flex min-h-12 items-center justify-center rounded-lg bg-creme px-6 font-semibold text-fundo transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado" href="/pt/planos" data-discover="true">Conhecer o Grupo</a></div></section><section aria-label="Bloqueado: parte do Clube" class="relative overflow-hidden rounded-2xl border border-current/15"><div aria-hidden="true" inert="" class="pointer-events-none max-h-72 overflow-hidden p-6 blur-sm select-none"><p>p</p></div><div class="flex flex-col items-start gap-4 p-6 absolute inset-0 justify-end bg-gradient-to-t from-fundo via-fundo/80 to-transparent"><p class="flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.2em] text-destaque uppercase"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="size-4"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 018 0v4"></path></svg>Bloqueado: parte do Clube</p><p class="max-w-prose text-lg">b</p><a class="inline-flex min-h-12 items-center justify-center rounded-lg bg-creme px-6 font-semibold text-fundo transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado" href="/pt/planos" data-discover="true">Conhecer os planos</a></div></section>"`)
  })
  it("DialogoConfirmar", () => {
    expect(html(<DialogoConfirmar aberto titulo="t" texto="x" perigo aoConfirmar={() => {}} aoCancelar={() => {}} />)).toMatchInlineSnapshot(`"<dialog aria-labelledby="_r_4_" class="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-creme/20 bg-painel p-6 text-creme backdrop:bg-black/60" open=""><h2 id="_r_4_" class="font-titulo text-3xl font-bold uppercase">t</h2><p class="mt-3 opacity-80">x</p><div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button class="inline-flex min-h-12 w-full items-center justify-center rounded-lg px-6 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado disabled:cursor-not-allowed disabled:opacity-60 border border-creme/30 text-creme hover:border-creme/60 sm:w-auto">Cancelar</button><button class="inline-flex min-h-12 w-full items-center justify-center rounded-lg px-6 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado disabled:cursor-not-allowed disabled:opacity-60 bg-creme text-fundo hover:bg-white sm:w-auto bg-red-200 text-red-950 hover:bg-red-100">Confirmar</button></div></dialog>"`)
  })
  it("Marca e SeletorIdioma", () => {
    expect(html(<><Marca to="/pt" /><Marca /><SeletorIdioma className="c" /></>)).toMatchInlineSnapshot(`"<a class="inline-flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado " href="/pt" data-discover="true"><img alt="" width="354" height="287" class="h-8 w-auto" src="/logo-simbolo.png"><span class="text-xs font-semibold tracking-[0.3em] text-destaque uppercase">Grupo Árvora</span></a><p class="inline-flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado "><img alt="" width="354" height="287" class="h-8 w-auto" src="/logo-simbolo.png"><span class="text-xs font-semibold tracking-[0.3em] text-destaque uppercase">Grupo Árvora</span></p><nav aria-label="Idioma" class="flex items-center rounded-full border border-creme/15 p-0.5 c"><a hreflang="pt" lang="pt-BR" aria-label="Português" title="Português" aria-current="true" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 font-mono text-xs font-semibold tracking-[0.15em] text-creme/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado aria-[current=true]:bg-creme/12 aria-[current=true]:text-white" href="/pt/x" data-discover="true">PT</a><a hreflang="en" lang="en" aria-label="English" title="English" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 font-mono text-xs font-semibold tracking-[0.15em] text-creme/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado aria-[current=true]:bg-creme/12 aria-[current=true]:text-white" href="/en/x" data-discover="true">EN</a></nav>"`)
  })
})
