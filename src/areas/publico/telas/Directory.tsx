import { useSearchParams } from "react-router"
import { Link } from "react-router"
import { Cartao } from "../../../componentes/Cartao"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Selecao } from "../../../componentes/Campo"
import { Selo } from "../../../componentes/Selo"
import { Vazio } from "../../../componentes/Vazio"
import { useAuth } from "../../../lib/sessao"
import { useCaminho, useIdioma, useT, useTitulo } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { nomeLocalizado, urlImagem } from "../formatos"
import { Pagina } from "../Pagina"
import { linkContorno } from "../../../componentes/botaoEstilo"
import { useConsulta } from "../usarConsulta"

// Lista de empresas publicadas (DIR-01). Filtros de área e cidade ficam na URL.
// ponytail: filtra no navegador (a leitura traz até 1000 linhas por padrão do PostgREST); passa a filtrar no servidor quando o Directory crescer.
export function Directory() {
  const t = useT()
  const idioma = useIdioma()
  const caminho = useCaminho()
  useTitulo("publico.directory.titulo")
  const { sessao } = useAuth()
  const [params, setParams] = useSearchParams()
  const setorSlug = params.get("area") ?? ""
  const cidade = params.get("cidade") ?? ""
  const setores = useConsulta(() => supabase.from("setores").select("id,nome,nome_en,slug").eq("ativo", true).order("ordem"), "setores")
  const empresas = useConsulta(
    () => supabase.from("empresas").select("id,nome,slug,setor_id,cidade,pais,logo_path").eq("status", "publicada").order("nome"),
    "empresas",
  )
  // Selo Premiado: empresa ligada a um premiado publicado. O selo "Membro Grupo Árvora" (DIR-03) precisa de um dado que o visitante não lê: ver relatório.
  const premiadas = useConsulta(() => supabase.from("premiados").select("empresa_id").not("empresa_id", "is", null).not("publicado_em", "is", null), "premiadas")

  const listaSetores = setores.dados ?? []
  const todas = empresas.dados ?? []
  const setor = listaSetores.find((s) => s.slug === setorSlug)
  const cidades = [...new Set(todas.map((e) => e.cidade).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b))
  const visiveis = todas.filter((e) => (!setor || e.setor_id === setor.id) && (!cidade || e.cidade === cidade))
  const premiadasIds = new Set((premiadas.dados ?? []).map((p) => p.empresa_id))
  const nomeSetor = (id: number) => listaSetores.find((s) => s.id === id)
  const mudar = (chave: "area" | "cidade", valor: string) => {
    const novo = new URLSearchParams(params)
    if (valor) novo.set(chave, valor)
    else novo.delete(chave)
    setParams(novo, { replace: true })
  }

  return (
    <Pagina titulo={t("publico.directory.titulo")} apoio={t("publico.directory.apoio")}>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
        <Selecao rotulo={t("publico.directory.area")} value={setorSlug} onChange={(e) => mudar("area", e.target.value)}>
          <option value="">{t("publico.directory.todas")}</option>
          {listaSetores.map((s) => (
            <option key={s.id} value={s.slug} className="text-fundo">{nomeLocalizado(s, idioma)}</option>
          ))}
        </Selecao>
        <Selecao rotulo={t("publico.directory.cidade")} value={cidade} onChange={(e) => mudar("cidade", e.target.value)}>
          <option value="">{t("publico.directory.todas")}</option>
          {cidades.map((c) => (
            <option key={c} value={c} className="text-fundo">{c}</option>
          ))}
        </Selecao>
      </div>
      {empresas.carregando ? (
        <Esqueleto linhas={6} />
      ) : empresas.erro ? (
        <Erro aoTentar={empresas.recarregar} />
      ) : visiveis.length === 0 ? (
        <Vazio>{t(setor || cidade ? "publico.directory.vazioFiltro" : "publico.directory.vazio")}</Vazio>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visiveis.map((e) => {
            const logo = urlImagem(e.logo_path)
            const s = nomeSetor(e.setor_id)
            return (
              <li key={e.id} className="relative">
                <Cartao className="h-full transition-colors focus-within:border-creme/60 hover:border-creme/60">
                  {logo ? <img src={logo} alt="" loading="lazy" className="mb-4 h-12 w-auto max-w-40 object-contain" /> : null}
                  <h2 className="font-titulo text-2xl leading-tight font-normal">
                    <Link to={caminho(`/directory/${e.slug}`)} className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado">{e.nome}</Link>
                  </h2>
                  <p className="mt-2 text-creme/80">{[s && nomeLocalizado(s, idioma), e.cidade, e.pais].filter(Boolean).join(" · ")}</p>
                  {premiadasIds.has(e.id) ? <div className="mt-4"><Selo tom="dourado">{t("selo.premiado")}</Selo></div> : null}
                </Cartao>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-10">
        <Link to={caminho(sessao ? "/cadastrar-empresa" : "/entrar")} className={linkContorno}>
          {t("publico.directory.cadastrar")}
        </Link>
      </p>
    </Pagina>
  )
}
