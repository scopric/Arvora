import { isoParaLocal, localParaIso, slugificar } from "./formato"
import type { Chave } from "../../../i18n"

export type OpcaoSel = { valor: string; texto: string }
export type CampoDef = {
  chave: string
  rotulo: Chave
  tipo: "texto" | "email" | "url" | "numero" | "area" | "data" | "dataHora" | "checkbox" | "publicado" | "selecao" | "imagem"
  obrigatorio?: boolean
  opcoes?: OpcaoSel[]
  // selecao opcional: texto da opção em branco
  vazio?: Chave
  ajuda?: Chave
  // imagem: pasta dentro do bucket `imagens`
  pasta?: string
  // slug: se ficar em branco, sai do texto deste outro campo
  slugDe?: string
  // coluna que o banco não deixa ler (ex.: convite_email do indicado): não vem preenchida e, em branco, não entra na gravação
  soEscrita?: boolean
  naTabela?: boolean
}
export type Valores = Record<string, string | boolean>
export type Linha = Record<string, unknown>

// Linha do banco → valores do formulário (tudo texto, menos as caixas). dataHora entra como hora de Dublin.
export function paraValores(campos: CampoDef[], linha: Linha | null): Valores {
  const v: Valores = {}
  for (const c of campos) {
    const x = linha?.[c.chave]
    if (c.soEscrita) v[c.chave] = ""
    else if (c.tipo === "checkbox") v[c.chave] = x === true
    else if (c.tipo === "publicado") v[c.chave] = x !== null && x !== undefined
    else if (c.tipo === "dataHora") v[c.chave] = isoParaLocal(x as string | null)
    else v[c.chave] = x === null || x === undefined ? "" : String(x)
  }
  return v
}

// Valores do formulário → carga para o banco. Vazio vira null; "publicado" mantém a data antiga ou usa agora.
// Devolve `erros` por campo (obrigatório vazio, número inválido, URL que não é https absoluta) e não monta carga se houver erro.
export function paraCarga(campos: CampoDef[], v: Valores, anterior: Linha | null): { carga: Linha; erros: Record<string, "obrigatorio" | "numero" | "url"> } {
  const carga: Linha = {}
  const erros: Record<string, "obrigatorio" | "numero" | "url"> = {}
  for (const c of campos) {
    const x = v[c.chave]
    if (c.tipo === "checkbox") carga[c.chave] = x === true
    else if (c.tipo === "publicado") carga[c.chave] = x === true ? ((anterior?.[c.chave] as string | null | undefined) ?? new Date().toISOString()) : null
    else {
      let texto = String(x ?? "").trim()
      if (texto === "" && c.slugDe) texto = slugificar(String(v[c.slugDe] ?? ""))
      if (texto === "" && c.soEscrita) continue
      if (texto === "") {
        if (c.obrigatorio) erros[c.chave] = "obrigatorio"
        // `ordem` vazia: a coluna é `not null default 0`; omitir deixa o banco usar 0 (insert) ou manter o valor (update)
        if (c.chave === "ordem" && !c.obrigatorio) continue
        carga[c.chave] = null
      } else if (c.tipo === "numero") {
        if (Number.isNaN(Number(texto))) erros[c.chave] = "numero"
        carga[c.chave] = Number(texto)
      } else if (c.tipo === "url") {
        // o form tem noValidate: sem isto passaria "javascript:..." ou texto solto
        if (!ehUrlHttps(texto)) erros[c.chave] = "url"
        carga[c.chave] = texto
      } else if (c.tipo === "dataHora") carga[c.chave] = localParaIso(texto)
      else carga[c.chave] = texto
    }
  }
  return { carga, erros }
}


export const ehUrlHttps = (texto: string) => URL.canParse(texto) && new URL(texto).protocol === "https:"
