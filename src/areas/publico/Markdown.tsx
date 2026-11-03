import type { ReactNode } from "react"

// Markdown simples, sem biblioteca e sem innerHTML: tudo vira elemento React, então HTML dentro do texto aparece como texto (escape).
// Suporta títulos, parágrafos, listas (- * 1.), **negrito**, *itálico* e [link](url). Link só https, mailto ou caminho do próprio site.
const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g
// Barra invertida em qualquer posição é recusada: o navegador a trata como "/" e "/\\evil.com" viraria link para outro site.
const linkSeguro = (url: string) => !url.includes("\\") && (/^(https:\/\/|mailto:)/i.test(url) || /^\/(?![/\\])/.test(url))

// Entidades comuns viram o caractere (como texto: nunca HTML). Uma passada só, então "&amp;lt;" vira "&lt;", não "<".
const ENTIDADES: Record<string, string> = { "&amp;": "&", "&nbsp;": "\u00a0", "&lt;": "<", "&gt;": ">", "&quot;": '"' }
const decodificar = (t: string) => t.replace(/&(?:amp|nbsp|lt|gt|quot);/g, (e) => ENTIDADES[e])

function inline(texto: string): ReactNode[] {
  const saida: ReactNode[] = []
  let ate = 0
  for (const m of texto.matchAll(INLINE)) {
    if (m.index > ate) saida.push(decodificar(texto.slice(ate, m.index)))
    if (m[1]) saida.push(<strong key={m.index}>{inline(m[1])}</strong>)
    else if (m[2]) saida.push(<em key={m.index}>{inline(m[2])}</em>)
    else if (linkSeguro(m[4])) {
      saida.push(
        <a key={m.index} href={m[4]} rel="noopener noreferrer" className="underline decoration-dourado underline-offset-4">
          {decodificar(m[3])}
        </a>,
      )
    } else saida.push(decodificar(m[3]))
    ate = m.index + m[0].length
  }
  if (ate < texto.length) saida.push(decodificar(texto.slice(ate)))
  return saida
}

const TITULO = /^(#{1,6})\s+(.*)$/
const ITEM = /^\s*([-*]|\d+[.)])\s+(.*)$/
const ESTILO_TITULO = ["", "text-3xl", "text-2xl", "text-xl", "text-lg", "text-lg", "text-base"]

// O título da página já é o <h1>: `#` do texto vira <h2>, `##` vira <h3> etc. (máximo h6).
export function Markdown({ texto }: { texto: string }) {
  const blocos: ReactNode[] = []
  let paragrafo: string[] = []
  let lista: { ordenada: boolean; inicio: number; itens: string[] } | null = null
  const fechar = () => {
    if (paragrafo.length) blocos.push(<p key={blocos.length}>{inline(paragrafo.join(" "))}</p>)
    if (lista) {
      const Tag = lista.ordenada ? "ol" : "ul"
      blocos.push(
        <Tag key={blocos.length} start={lista.ordenada ? lista.inicio : undefined} className={`ml-6 space-y-1 ${lista.ordenada ? "list-decimal" : "list-disc"}`}>
          {lista.itens.map((i, n) => (
            <li key={n}>{inline(i)}</li>
          ))}
        </Tag>,
      )
    }
    paragrafo = []
    lista = null
  }
  for (const linha of texto.replace(/\r\n?/g, "\n").split("\n")) {
    const titulo = TITULO.exec(linha)
    const item = ITEM.exec(linha)
    if (titulo) {
      fechar()
      const nivel = Math.min(titulo[1].length + 1, 6)
      const Tag = `h${nivel}` as "h2"
      blocos.push(
        <Tag key={blocos.length} className={`mt-8 font-titulo font-normal ${ESTILO_TITULO[nivel - 1]}`}>
          {inline(titulo[2])}
        </Tag>,
      )
    } else if (item) {
      const ordenada = /\d/.test(item[1])
      // Linha em branco entre itens do mesmo tipo não fecha a lista; tipo diferente fecha.
      if (lista && lista.ordenada !== ordenada) fechar()
      if (paragrafo.length) fechar()
      lista ??= { ordenada, inicio: ordenada ? Number.parseInt(item[1], 10) : 1, itens: [] }
      lista.itens.push(item[2])
    } else if (!linha.trim()) {
      // Em branco dentro de lista não a fecha: a lista só termina em linha de outro tipo.
      if (!lista) fechar()
    } else if (lista && /^\s+/.test(linha)) {
      // Linha indentada continua o item anterior.
      lista.itens[lista.itens.length - 1] += ` ${linha.trim()}`
    } else {
      if (lista) fechar()
      paragrafo.push(linha.trim())
    }
  }
  fechar()
  return <div className="max-w-prose space-y-4 leading-relaxed">{blocos}</div>
}
