import { useIdioma, useT } from "../i18n"
import { CODIGOS_PAISES, paisesOrdenados } from "../lib/paises"
import { Selecao } from "./Campo"

// País como lista (não texto livre): quem digitava "Irlanda" gravava "IR" (Irã).
export function SelecaoPais({ valor, erro }: { valor: string | null; erro?: string }) {
  const t = useT()
  const idioma = useIdioma()
  // Código antigo fora da lista continua visível (e é o que volta ao salvar), em vez de sumir calado.
  const avulso = valor && !CODIGOS_PAISES.includes(valor) ? valor : null
  return (
    <Selecao rotulo={t("perfil.pais")} name="pais" defaultValue={valor ?? ""} erro={erro} autoComplete="country">
      <option value="">{t("perfil.pais.selecione")}</option>
      {avulso ? <option value={avulso}>{avulso}</option> : null}
      {paisesOrdenados(idioma).map((p) => (
        <option key={p.codigo} value={p.codigo}>{p.nome}</option>
      ))}
    </Selecao>
  )
}
