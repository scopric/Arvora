import { useEffect } from "react"
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router"
import { ehIdioma, gravarIdioma, idiomaPreferido, useCaminho } from "./i18n"
import { AuthProvider } from "./lib/auth"
import { RotaProtegida } from "./RotaProtegida"
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

// Layout de /:lang: idioma inválido troca só o 1º segmento pelo preferido; válido ajusta <html lang> e lembra a escolha.
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
    return <Navigate to={`/${idiomaPreferido()}${pathname.replace(/^\/[^/]*/, "")}${search}${hash}`} replace />
  }
  return <Outlet />
}

function Inicio() {
  return <Navigate to={useCaminho()("/")} replace />
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
        <Route path="*" element={<Inicio />} />
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
