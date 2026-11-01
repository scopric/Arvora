import { Aviso } from "../../../componentes/Aviso"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { useIdioma, useT, useTitulo, type Chave } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { Markdown } from "../Markdown"
import { Pagina } from "../Pagina"
import { useConsulta } from "../usarConsulta"

// Termos e privacidade: o texto vigente por tipo e idioma vem de documentos_legais (LEG-01). Sem documento: aviso "em revisão",
// nunca texto inventado. Os textos em si são das Contratantes/solicitor, não nossos.
export function Legal({ tipo, titulo }: { tipo: "termos" | "privacidade"; titulo: Chave }) {
  const t = useT()
  const idioma = useIdioma()
  useTitulo(titulo)
  const doc = useConsulta(
    () =>
      supabase
        .from("documentos_legais")
        .select("titulo,versao,vigente_desde,conteudo_md")
        .eq("tipo", tipo)
        .eq("idioma", idioma)
        .lte("vigente_desde", new Date().toISOString())
        .order("vigente_desde", { ascending: false })
        .limit(1)
        .maybeSingle(),
    `${tipo}/${idioma}`,
  )
  const d = doc.dados
  const data = d && new Intl.DateTimeFormat(idioma === "pt" ? "pt-BR" : "en-IE", { dateStyle: "long", timeZone: "Europe/Dublin" }).format(new Date(d.vigente_desde))
  return (
    <Pagina titulo={t(titulo)} largura="max-w-3xl">
      {doc.carregando ? (
        <Esqueleto linhas={8} />
      ) : doc.erro ? (
        <Erro aoTentar={doc.recarregar} />
      ) : d ? (
        <>
          <p className="mb-8 font-mono text-xs tracking-[0.15em] text-creme/70">
            {t("publico.legal.versao")} {d.versao} · {t("publico.legal.vigenteDesde")} {data}
          </p>
          <Markdown texto={d.conteudo_md} />
        </>
      ) : (
        <Aviso tipo="ok">{t("publico.legal.emRevisao")}</Aviso>
      )}
    </Pagina>
  )
}
