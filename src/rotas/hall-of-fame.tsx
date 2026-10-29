import { Link, useLoaderData } from "react-router"
import premiados from "../dados/premiados-exemplo.json" with { type: "json" }
import { idiomaValido, linksIdioma } from "../site"
import type { Route } from "./+types/hall-of-fame"

const textos = {
  pt: { titulo: "Hall of Fame", aviso: "Exemplo: dados fictícios do piloto, não são premiados reais." },
  en: { titulo: "Hall of Fame", aviso: "Example: fictional pilot data, not real award winners." },
}

export function loader({ params }: Route.LoaderArgs) {
  const lang = idiomaValido(params.lang)
  return { lang, premiados }
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `${textos[loaderData.lang].titulo} — Árvora (exemplo)` },
    ...linksIdioma(loaderData.lang, "/hall-of-fame").map((l) => ({ tagName: "link" as const, ...l })),
  ]
}

export default function HallOfFame() {
  const { lang, premiados } = useLoaderData<typeof loader>()
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-titulo text-5xl">{textos[lang].titulo}</h1>
      <p className="mt-4 inline-block rounded border border-dourado px-3 py-1 text-sm text-dourado">
        {textos[lang].aviso}
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-3">
        {premiados.map((p) => (
          <li key={p.slug} className="rounded-lg bg-painel p-5">
            <Link to={`/${lang}/hall-of-fame/${p.edicao}/${p.slug}`} className="font-titulo text-xl underline">
              {p.nome}
            </Link>
            <p className="mt-2 text-sm text-creme/75">{p.categoria[lang]}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}
