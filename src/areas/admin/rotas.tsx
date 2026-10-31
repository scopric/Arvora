import { Route } from "react-router"
import { EmConstrucao } from "../../componentes/EmConstrucao"

// Rotas da área admin (caminhos relativos a /:lang/admin). Para entregar uma tela: troque o element da rota
// pela sua tela (crie-a em src/areas/admin/telas/). Não edite App.tsx.
export function rotasAdmin() {
  return (
    <>
      <Route index element={<EmConstrucao titulo="admin.visaoGeral.titulo" />} />
      <Route path="aulas" element={<EmConstrucao titulo="admin.aulas.titulo" />} />
      <Route path="aulas/nova" element={<EmConstrucao titulo="admin.aulasNova.titulo" />} />
      <Route path="aulas/:id" element={<EmConstrucao titulo="admin.aula.titulo" />} />
      <Route path="cursos" element={<EmConstrucao titulo="admin.cursos.titulo" />} />
      <Route path="cursos/:id" element={<EmConstrucao titulo="admin.curso.titulo" />} />
      <Route path="verticais" element={<EmConstrucao titulo="admin.verticais.titulo" />} />
      <Route path="premiados" element={<EmConstrucao titulo="admin.premiados.titulo" />} />
      <Route path="premiados/:id" element={<EmConstrucao titulo="admin.premiado.titulo" />} />
      <Route path="edicoes" element={<EmConstrucao titulo="admin.edicoes.titulo" />} />
      <Route path="edicoes/:id" element={<EmConstrucao titulo="admin.edicao.titulo" />} />
      <Route path="empresas" element={<EmConstrucao titulo="admin.empresas.titulo" />} />
      <Route path="videos" element={<EmConstrucao titulo="admin.videos.titulo" />} />
      <Route path="temas" element={<EmConstrucao titulo="admin.temas.titulo" />} />
      <Route path="moderacao" element={<EmConstrucao titulo="admin.moderacao.titulo" />} />
      <Route path="correcao" element={<EmConstrucao titulo="admin.correcao.titulo" />} />
      <Route path="membros" element={<EmConstrucao titulo="admin.membros.titulo" />} />
      <Route path="membros/:id" element={<EmConstrucao titulo="admin.membro.titulo" />} />
      <Route path="pedidos-de-dados" element={<EmConstrucao titulo="admin.pedidosDeDados.titulo" />} />
      <Route path="relatorio-ciclo" element={<EmConstrucao titulo="admin.relatorioCiclo.titulo" />} />
      <Route path="equipe" element={<EmConstrucao titulo="admin.equipe.titulo" />} />
      <Route path="log" element={<EmConstrucao titulo="admin.log.titulo" />} />
      <Route path="ia" element={<EmConstrucao titulo="admin.ia.titulo" />} />
    </>
  )
}
