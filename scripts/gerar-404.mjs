// Copia o index.html da SPA para 404.html: a Vercel serve o 404.html com status 404 quando nenhum arquivo nem rewrite
// do vercel.json casa (os rewrites só cobrem as rotas do app). O roteador carrega e mostra a tela 404 normal.
// Roda depois do externalizar-scripts, então os <script src> do index.html já valem para a cópia.
import { copyFileSync } from "node:fs"
import { join } from "node:path"

const raiz = process.env.RAIZ_BUILD ?? "build/client"
copyFileSync(join(raiz, "index.html"), join(raiz, "404.html"))
