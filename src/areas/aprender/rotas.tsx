import { Route } from "react-router"
import { Academy } from "./telas/Academy"
import { Aula } from "./telas/Aula"
import { Aulas, BemEstar } from "./telas/Aulas"
import { BemVindo } from "./telas/BemVindo"
import { Curso } from "./telas/Curso"
import { CursoAula } from "./telas/CursoAula"
import { Inicio } from "./telas/Inicio"
import { Tarefa } from "./telas/Tarefa"
import { Tarefas } from "./telas/Tarefas"

// Rotas da área aprender (caminhos relativos a /:lang).
export function rotasAprender() {
  return (
    <>
      <Route path="inicio" element={<Inicio />} />
      <Route path="bem-vindo" element={<BemVindo />} />
      <Route path="aulas" element={<Aulas />} />
      <Route path="aulas/:slug" element={<Aula />} />
      <Route path="academy" element={<Academy />} />
      <Route path="academy/:curso" element={<Curso />} />
      <Route path="academy/:curso/:aula" element={<CursoAula />} />
      <Route path="tarefas" element={<Tarefas />} />
      <Route path="tarefas/:id" element={<Tarefa />} />
      <Route path="bem-estar" element={<BemEstar />} />
    </>
  )
}
