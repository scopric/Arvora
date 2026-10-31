import { useEffect } from "react"
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router"
import { ehIdioma, gravarIdioma, idiomaPreferido } from "./i18n"
import { AuthProvider } from "./lib/auth"
import { RotaProtegida } from "./RotaProtegida"
import { NaoEncontrada } from "./componentes/NaoEncontrada"
import { LANG_HTML } from "./site"
import { Cadastro } from "./telas/Cadastro"
import { Confirmar } from "./telas/Confirmar"
import { EmBreve } from "./telas/EmBreve"
import { Entrar } from "./telas/Entrar"
import { Perfil } from "./telas/Perfil"
import { RecuperarSenha } from "./telas/RecuperarSenha"
import { RedefinirSenha } from "./telas/RedefinirSenha"

// Caminho sem prefixo de idioma: manda para /{idioma}{caminho}, conservando busca e hash
// (o link de recuperação de senha do Supabase chega com #access_token=...).
function SemPrefixo() {
  const { pathname, search, hash } = useLocation()
  return <Navigate to={`/${idiomaPreferido()}${pathname === "/" ? "" : pathname}${search}${hash}`} replace />
}

// Layout de /:lang: 1º segmento com cara de código de idioma ("xx") é trocado pelo preferido; qualquer outro ("sobre") é caminho sem prefixo e vai para o 404; válido ajusta <html lang> e lembra a escolha.
function LayoutIdioma() {
  const { lang } = useParams()
  const { pathname, search, hash } = useLocation()
  const valido = ehIdioma(lang)
  useEffect(() => {
    if (!ehIdioma(lang)) return
    document.documentElement.lang = LANG_HTML[lang]
    gravarIdioma(lang)
  }, [lang])
  if (!valido) {
    const resto = /^[a-z]{2}(-[a-z]{2})?$/i.test(lang ?? "") ? pathname.replace(/^\/[^/]*/, "") : pathname
    return <Navigate to={`/${idiomaPreferido()}${resto}${search}${hash}`} replace />
  }
  return <Outlet />
}

export function Rotas() {
  return (
    <Routes>
      {["/", "/entrar", "/cadastro", "/confirmar", "/recuperar-senha", "/redefinir-senha", "/perfil"].map((p) => (
        <Route key={p} path={p} element={<SemPrefixo />} />
      ))}
      <Route path="/:lang" element={<LayoutIdioma />}>
        <Route index element={<EmBreve />} />
        <Route path="entrar" element={<Entrar />} />
        <Route path="cadastro" element={<Cadastro />} />
        <Route path="confirmar" element={<Confirmar />} />
        <Route path="recuperar-senha" element={<RecuperarSenha />} />
        <Route path="redefinir-senha" element={<RedefinirSenha />} />
        <Route element={<RotaProtegida />}>
          <Route path="perfil" element={<Perfil />} />
        </Route>
        <Route path="*" element={<NaoEncontrada />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Rotas />
    </AuthProvider>
  )
}
