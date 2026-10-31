import { Route } from "react-router"
import { EmConstrucao } from "../../componentes/EmConstrucao"

// Rotas da área publico (caminhos relativos a /:lang). Para entregar uma tela: troque o element da rota
// pela sua tela (crie-a em src/areas/publico/telas/). Não edite App.tsx.
export function rotasPublico() {
  return (
    <>
      <Route path="planos" element={<EmConstrucao titulo="publico.planos.titulo" />} />
      <Route path="checkout/sucesso" element={<EmConstrucao titulo="publico.checkoutSucesso.titulo" />} />
      <Route path="checkout/cancelado" element={<EmConstrucao titulo="publico.checkoutCancelado.titulo" />} />
      <Route path="suporte" element={<EmConstrucao titulo="publico.suporte.titulo" />} />
      <Route path="termos" element={<EmConstrucao titulo="publico.termos.titulo" />} />
      <Route path="privacidade" element={<EmConstrucao titulo="publico.privacidade.titulo" />} />
      <Route path="awards" element={<EmConstrucao titulo="publico.awards.titulo" />} />
      <Route path="biblioteca" element={<EmConstrucao titulo="publico.biblioteca.titulo" />} />
      <Route path="biblioteca/:slug" element={<EmConstrucao titulo="publico.bibliotecaVideo.titulo" />} />
      <Route path="originals" element={<EmConstrucao titulo="publico.originals.titulo" />} />
      <Route path="originals/:slug" element={<EmConstrucao titulo="publico.originalsEpisodio.titulo" />} />
      <Route path="directory" element={<EmConstrucao titulo="publico.directory.titulo" />} />
      <Route path="directory/:slug" element={<EmConstrucao titulo="publico.directoryEmpresa.titulo" />} />
      <Route path="cadastrar-empresa" element={<EmConstrucao titulo="publico.cadastrarEmpresa.titulo" />} />
      <Route path="evento/:edicao" element={<EmConstrucao titulo="publico.evento.titulo" />} />
    </>
  )
}
