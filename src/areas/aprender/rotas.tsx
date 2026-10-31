import { Route } from "react-router"
import { EmConstrucao } from "../../componentes/EmConstrucao"

// Rotas da área aprender (caminhos relativos a /:lang). Para entregar uma tela: troque o element da rota
// pela sua tela (crie-a em src/areas/aprender/telas/). Não edite App.tsx.
export function rotasAprender() {
  return (
    <>
      <Route path="inicio" element={<EmConstrucao titulo="aprender.inicio.titulo" />} />
      <Route path="bem-vindo" element={<EmConstrucao titulo="aprender.bemVindo.titulo" />} />
      <Route path="aulas" element={<EmConstrucao titulo="aprender.aulas.titulo" />} />
      <Route path="aulas/:slug" element={<EmConstrucao titulo="aprender.aula.titulo" />} />
      <Route path="academy" element={<EmConstrucao titulo="aprender.academy.titulo" />} />
      <Route path="academy/:curso" element={<EmConstrucao titulo="aprender.curso.titulo" />} />
      <Route path="academy/:curso/:aula" element={<EmConstrucao titulo="aprender.cursoAula.titulo" />} />
      <Route path="tarefas" element={<EmConstrucao titulo="aprender.tarefas.titulo" />} />
      <Route path="tarefas/:id" element={<EmConstrucao titulo="aprender.tarefa.titulo" />} />
      <Route path="bem-estar" element={<EmConstrucao titulo="aprender.bemEstar.titulo" />} />
    </>
  )
}
