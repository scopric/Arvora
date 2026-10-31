import { ListaVideos } from "../componentes/ListaVideos"

export const Originals = () => (
  <ListaVideos tipo="original" base="/originals" titulo="publico.originals.titulo" apoio="publico.originals.apoio" vazio="publico.originals.vazio" comTemas={false} />
)
