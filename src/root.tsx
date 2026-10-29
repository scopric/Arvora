import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useParams } from "react-router"
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

// Sem stack na tela. Em páginas pré-renderizadas o status HTTP continua 200 (limite do ssr:false).
export function ErrorBoundary({ error }: { error: unknown }) {
  const naoEncontrada = isRouteErrorResponse(error) && error.status === 404
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="font-titulo text-4xl">
        {naoEncontrada ? "Página não encontrada" : "Algo deu errado"}
      </h1>
      <a href="/" className="mt-8 inline-block underline">Voltar ao início</a>
    </main>
  )
}
