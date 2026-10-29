import { Links, Meta, Outlet, Scripts, ScrollRestoration, useParams } from "react-router"
import "./index.css"
import { IDIOMAS, LANG_HTML, type Idioma } from "./site"

export function Layout({ children }: { children: React.ReactNode }) {
  const { lang } = useParams()
  const idioma = IDIOMAS.find((l) => l === lang) as Idioma | undefined
  return (
    <html lang={idioma ? LANG_HTML[idioma] : "pt-BR"}>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#112019" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export function meta() {
  return [
    { title: "Grupo Árvora — em breve" },
    {
      name: "description",
      content:
        "Grupo Árvora: cursos, acompanhamento e comunidade para empreendedores brasileiros fora do Brasil. Em breve.",
    },
  ]
}

export default function Root() {
  return <Outlet />
}

// Mostrado enquanto o SPA hidrata (e no __spa-fallback.html).
export function HydrateFallback() {
  return <p role="status" className="p-12 text-creme/70">Carregando…</p>
}
