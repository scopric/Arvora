import { Route } from "react-router"
import { EmConstrucao } from "../../componentes/EmConstrucao"

// Rotas da área rede (caminhos relativos a /:lang). Para entregar uma tela: troque o element da rota
// pela sua tela (crie-a em src/areas/rede/telas/). Não edite App.tsx.
export function rotasRede() {
  return (
    <>
      <Route path="comunidade" element={<EmConstrucao titulo="rede.comunidade.titulo" />} />
      <Route path="network" element={<EmConstrucao titulo="rede.network.titulo" />} />
      <Route path="network/:perfil" element={<EmConstrucao titulo="rede.networkPerfil.titulo" />} />
      <Route path="match" element={<EmConstrucao titulo="rede.match.titulo" />} />
      <Route path="conexoes" element={<EmConstrucao titulo="rede.conexoes.titulo" />} />
      <Route path="meu-award" element={<EmConstrucao titulo="rede.meuAward.titulo" />} />
    </>
  )
}
