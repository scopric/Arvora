import { Route } from "react-router"
import { Assinatura } from "./telas/Assinatura"
import { Configuracoes } from "./telas/Configuracoes"
import { Dados } from "./telas/Dados"
import { Emails } from "./telas/Emails"
import { Notificacoes } from "./telas/Notificacoes"
import { Privacidade } from "./telas/Privacidade"

// Rotas da área conta (caminhos relativos a /:lang).
export function rotasConta() {
  return (
    <>
      <Route path="notificacoes" element={<Notificacoes />} />
      <Route path="configuracoes" element={<Configuracoes />} />
      <Route path="configuracoes/privacidade" element={<Privacidade />} />
      <Route path="configuracoes/emails" element={<Emails />} />
      <Route path="configuracoes/assinatura" element={<Assinatura />} />
      <Route path="configuracoes/dados" element={<Dados />} />
    </>
  )
}
