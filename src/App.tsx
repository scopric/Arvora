import { BrowserRouter, Navigate, Route, Routes } from "react-router"
import { AuthProvider } from "./lib/auth"
import { RotaProtegida } from "./RotaProtegida"
import { Cadastro } from "./telas/Cadastro"
import { EmBreve } from "./telas/EmBreve"
import { Entrar } from "./telas/Entrar"
import { Perfil } from "./telas/Perfil"
import { RecuperarSenha } from "./telas/RecuperarSenha"
import { RedefinirSenha } from "./telas/RedefinirSenha"

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<EmBreve />} />
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/recuperar-senha" element={<RecuperarSenha />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />
          <Route element={<RotaProtegida />}>
            <Route path="/perfil" element={<Perfil />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
