import { Link } from "react-router"
import { Icone } from "./Icone"
import { focoApp } from "./menuApp"

// Link "voltar" acima do título (molde Linear): seta + rótulo em névoa, 36px de altura (44 no toque).
// Um só desenho para as duas molduras: PaginaApp (membro) e Pagina (admin).
export function LinkVoltar({ para, rotulo }: { para: string; rotulo: string }) {
  return (
    <Link to={para} className={`mb-4 inline-flex min-h-9 items-center gap-1 rounded-sm text-legenda font-medium text-nevoa transition-colors pointer-coarse:min-h-11 hover:text-creme ${focoApp}`}>
      <Icone nome="seta" className="size-4" />
      {rotulo}
    </Link>
  )
}
