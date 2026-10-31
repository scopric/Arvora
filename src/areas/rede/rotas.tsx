import { Route } from "react-router"
import { Comunidade } from "./telas/Comunidade"
import { Conexoes } from "./telas/Conexoes"
import { Match } from "./telas/Match"
import { MeuAward } from "./telas/MeuAward"
import { Network } from "./telas/Network"
import { NetworkPerfil } from "./telas/NetworkPerfil"

// Rotas da área rede (caminhos relativos a /:lang). Não edite App.tsx.
export function rotasRede() {
  return (
    <>
      <Route path="comunidade" element={<Comunidade />} />
      <Route path="network" element={<Network />} />
      <Route path="network/:perfil" element={<NetworkPerfil />} />
      <Route path="match" element={<Match />} />
      <Route path="conexoes" element={<Conexoes />} />
      <Route path="meu-award" element={<MeuAward />} />
    </>
  )
}
