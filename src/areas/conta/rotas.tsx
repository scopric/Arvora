import { Route } from "react-router"
import { EmConstrucao } from "../../componentes/EmConstrucao"

// Rotas da área conta (caminhos relativos a /:lang). Para entregar uma tela: troque o element da rota
// pela sua tela (crie-a em src/areas/conta/telas/). Não edite App.tsx.
export function rotasConta() {
  return (
    <>
      <Route path="notificacoes" element={<EmConstrucao titulo="conta.notificacoes.titulo" />} />
      <Route path="configuracoes" element={<EmConstrucao titulo="conta.configuracoes.titulo" />} />
      <Route path="configuracoes/privacidade" element={<EmConstrucao titulo="conta.privacidade.titulo" />} />
      <Route path="configuracoes/emails" element={<EmConstrucao titulo="conta.emails.titulo" />} />
      <Route path="configuracoes/assinatura" element={<EmConstrucao titulo="conta.assinatura.titulo" />} />
      <Route path="configuracoes/dados" element={<EmConstrucao titulo="conta.dados.titulo" />} />
    </>
  )
}
