import { Route } from "react-router"
import { AulaForm } from "./telas/AulaForm"
import { Aulas } from "./telas/Aulas"
import { Correcao } from "./telas/Correcao"
import { Curso } from "./telas/Curso"
import { Cursos } from "./telas/Cursos"
import { Edicao } from "./telas/Edicao"
import { Edicoes } from "./telas/Edicoes"
import { Empresas } from "./telas/Empresas"
import { Equipe } from "./telas/Equipe"
import { Log } from "./telas/Log"
import { Membro } from "./telas/Membro"
import { Membros } from "./telas/Membros"
import { Moderacao } from "./telas/Moderacao"
import { PedidosDeDados } from "./telas/PedidosDeDados"
import { Premiado } from "./telas/Premiado"
import { Premiados } from "./telas/Premiados"
import { RelatorioCiclo } from "./telas/RelatorioCiclo"
import { RevisaoIA } from "./telas/RevisaoIA"
import { Temas } from "./telas/Temas"
import { Verticais } from "./telas/Verticais"
import { Videos } from "./telas/Videos"
import { VisaoGeral } from "./telas/VisaoGeral"

// Rotas da área admin (caminhos relativos a /:lang/admin). O LayoutAdmin já exige equipe e 2FA; cada tela esconde o que o papel não pode.
export function rotasAdmin() {
  return (
    <>
      <Route index element={<VisaoGeral />} />
      <Route path="aulas" element={<Aulas />} />
      <Route path="aulas/nova" element={<AulaForm />} />
      <Route path="aulas/:id" element={<AulaForm />} />
      <Route path="cursos" element={<Cursos />} />
      <Route path="cursos/:id" element={<Curso />} />
      <Route path="verticais" element={<Verticais />} />
      <Route path="premiados" element={<Premiados />} />
      <Route path="premiados/novo" element={<Premiado />} />
      <Route path="premiados/:id" element={<Premiado />} />
      <Route path="edicoes" element={<Edicoes />} />
      <Route path="edicoes/nova" element={<Edicao />} />
      <Route path="edicoes/:id" element={<Edicao />} />
      <Route path="empresas" element={<Empresas />} />
      <Route path="videos" element={<Videos />} />
      <Route path="temas" element={<Temas />} />
      <Route path="moderacao" element={<Moderacao />} />
      <Route path="correcao" element={<Correcao />} />
      <Route path="membros" element={<Membros />} />
      <Route path="membros/:id" element={<Membro />} />
      <Route path="pedidos-de-dados" element={<PedidosDeDados />} />
      <Route path="relatorio-ciclo" element={<RelatorioCiclo />} />
      <Route path="equipe" element={<Equipe />} />
      <Route path="log" element={<Log />} />
      <Route path="ia" element={<RevisaoIA />} />
    </>
  )
}
