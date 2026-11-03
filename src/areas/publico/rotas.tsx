import { Route } from "react-router"
import { Awards } from "./telas/Awards"
import { Biblioteca } from "./telas/Biblioteca"
import { BibliotecaVideo } from "./telas/BibliotecaVideo"
import { CadastrarEmpresa } from "./telas/CadastrarEmpresa"
import { CheckoutCancelado } from "./telas/CheckoutCancelado"
import { CheckoutSucesso } from "./telas/CheckoutSucesso"
import { Directory } from "./telas/Directory"
import { DirectoryEmpresa } from "./telas/DirectoryEmpresa"
import { Evento, EventoAtual } from "./telas/Evento"
import { HallOfFame, Premiado } from "./telas/HallOfFame"
import { Legal } from "./telas/Legal"
import { Originals } from "./telas/Originals"
import { OriginalsEpisodio } from "./telas/OriginalsEpisodio"
import { Planos } from "./telas/Planos"
import { Suporte } from "./telas/Suporte"

// Rotas da área publico (caminhos relativos a /:lang).
export function rotasPublico() {
  return (
    <>
      <Route path="planos" element={<Planos />} />
      <Route path="checkout/sucesso" element={<CheckoutSucesso />} />
      <Route path="checkout/cancelado" element={<CheckoutCancelado />} />
      <Route path="suporte" element={<Suporte />} />
      <Route path="termos" element={<Legal tipo="termos" titulo="publico.termos.titulo" />} />
      <Route path="privacidade" element={<Legal tipo="privacidade" titulo="publico.privacidade.titulo" />} />
      <Route path="awards" element={<Awards />} />
      <Route path="biblioteca" element={<Biblioteca />} />
      <Route path="biblioteca/:slug" element={<BibliotecaVideo />} />
      <Route path="originals" element={<Originals />} />
      <Route path="originals/:slug" element={<OriginalsEpisodio />} />
      <Route path="directory" element={<Directory />} />
      <Route path="directory/:slug" element={<DirectoryEmpresa />} />
      <Route path="cadastrar-empresa" element={<CadastrarEmpresa />} />
      <Route path="hall-of-fame" element={<HallOfFame />} />
      <Route path="hall-of-fame/:edicao/:slug" element={<Premiado />} />
      <Route path="evento" element={<EventoAtual />} />
      <Route path="evento/:edicao" element={<Evento />} />
    </>
  )
}
