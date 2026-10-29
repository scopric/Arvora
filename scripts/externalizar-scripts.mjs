// Move cada <script> inline dos HTML gerados para um arquivo .js ao lado, para a CSP
// `script-src 'self'` (sem 'unsafe-inline') continuar valendo. Ordem e tipo preservados.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"

const raiz = "build/client"
const achar = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const c = join(dir, n)
    return statSync(c).isDirectory() ? achar(c) : c.endsWith(".html") ? [c] : []
  })

let total = 0
for (const arq of achar(raiz)) {
  const nome = basename(arq, ".html")
  let n = 0
  const html = readFileSync(arq, "utf8").replace(
    /<script([^>]*)>([\s\S]*?)<\/script>/g,
    (todo, attrs0, corpo) => {
      let attrs = attrs0
      if (/\ssrc=/.test(attrs) || !corpo.trim()) return todo
      const arqJs = `${nome}.inline-${n++}.js`
      writeFileSync(join(dirname(arq), arqJs), corpo)
      total++
      // Sem `async`: o módulo de hidratação só roda depois que o parser terminou e os
      // scripts de streaming do React (agora externos) já executaram, senão a hidratação diverge.
      attrs = attrs.replace(/\sasync(="")?/, "")
      return `<script${attrs} src="${join("/", dirname(arq).slice(raiz.length), arqJs)}"></script>`
    },
  )
  // Se sobrar script inline (ex.: regex cortado por um "</script>" nos dados), o build falha à vista.
  if (/<script(?![^>]*\ssrc=)[^>]*>\s*\S/.test(html)) throw new Error(`Script inline restante em ${arq}`)
  writeFileSync(arq, html)
}
console.log(`${total} scripts inline externalizados`)
