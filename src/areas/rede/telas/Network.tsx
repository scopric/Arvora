import { useState, type SubmitEvent } from "react"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Botao } from "../../../componentes/Botao"
import { Campo, Selecao } from "../../../componentes/Campo"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Icone } from "../../../componentes/Icone"
import { Vazio } from "../../../componentes/Vazio"
import { useIdioma, useT, useTitulo } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { CartaoPerfil, Etiqueta } from "../componentes"
import { nomeCategoria, nomeDe, nomeSetor, ok, useCarga, VITRINE, type Categoria, type Item, type Setor, type Vitrine } from "../lib"

const POR_PAGINA = 30
type Filtros = { setor: string; cidade: string; categoria: string; tipo: string }
const SEM_FILTROS: Filtros = { setor: "", cidade: "", categoria: "", tipo: "" }

export function Network() {
  const t = useT()
  const idioma = useIdioma()
  useTitulo("rede.network.titulo")
  const acesso = useAcesso()
  const { sessao } = useAuth()
  const uid = sessao?.user.id ?? ""
  const grupo = !acesso.carregando && temNivel(acesso.nivel, "grupo")
  const clube = !acesso.carregando && acesso.nivel === "clube"
  const liberado = !acesso.erro && (grupo || clube)

  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTROS) // os aplicados; o formulário só os troca ao enviar
  const [pagina, setPagina] = useState(1)
  const { estado, recarregar } = useCarga(async () => {
    if (!liberado) return null
    const [setores, categorias] = await Promise.all([
      supabase.from("setores").select("id, nome, nome_en").eq("ativo", true).order("ordem").order("nome"),
      supabase.from("categorias_rede").select("id, nome, nome_en").order("ordem").order("nome"),
    ])
    let membros: Vitrine[]
    let itens: Item[] = []
    if (grupo) {
      const r = await supabase.rpc("buscar_membros", {
        filtro_setor: filtros.setor ? Number(filtros.setor) : undefined,
        filtro_cidade: filtros.cidade.trim() || undefined,
        filtro_categoria: filtros.categoria ? Number(filtros.categoria) : undefined,
        filtro_tipo: filtros.tipo ? (filtros.tipo as "procura" | "oferece") : undefined,
        limite: POR_PAGINA * pagina,
      })
      membros = ok(r)
      const ids = membros.map((m) => m.id).filter((i): i is string => !!i)
      if (ids.length) itens = ok(await supabase.from("network_itens").select("perfil_id, tipo, categoria_id, texto").in("perfil_id", ids))
    } else {
      // Clube: lista simples pela vitrine, sem filtros nem itens (matriz §5).
      membros = ok(await supabase.from("perfis_vitrine").select(VITRINE).neq("id", uid).order("nome").limit(POR_PAGINA))
    }
    return { setores: ok(setores) as Setor[], categorias: ok(categorias) as Categoria[], membros, itens }
  }, `${liberado}-${grupo}-${JSON.stringify(filtros)}-${pagina}`)

  function buscar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setPagina(1)
    setFiltros({ setor: String(f.get("setor")), cidade: String(f.get("cidade")), categoria: String(f.get("categoria")), tipo: String(f.get("tipo")) })
  }

  let corpo
  if (acesso.carregando) corpo = <Esqueleto linhas={4} />
  else if (acesso.erro) corpo = <Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro>
  else if (!liberado) corpo = <Bloqueado minimo="clube" frase={t("rede.network.bloqueadoVisitante")} />
  else {
    const dados = estado.fase === "pronto" ? estado.dados : null
    const setores = dados?.setores ?? []
    const categorias = dados?.categorias ?? []
    const cadeado = clube
    corpo = (
      <>
        {clube ? <div className="mb-6"><Bloqueado frase={t("rede.network.bloqueadoClube")} /></div> : null}
        <form onSubmit={buscar} aria-label={t("rede.network.filtros")} className="grid gap-4 sm:grid-cols-2">
          <fieldset disabled={cadeado} className="contents">
            <Selecao rotulo={t("rede.network.setor")} name="setor" defaultValue={filtros.setor}>
              <option value="">{t("rede.network.todos")}</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{nomeDe(s, idioma)}</option>)}
            </Selecao>
            <Campo rotulo={t("rede.network.cidade")} name="cidade" defaultValue={filtros.cidade} />
            <Selecao rotulo={t("rede.network.categoria")} name="categoria" defaultValue={filtros.categoria}>
              <option value="">{t("rede.network.todas")}</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{nomeDe(c, idioma)}</option>)}
            </Selecao>
            <Selecao rotulo={t("rede.network.tipo")} name="tipo" defaultValue={filtros.tipo}>
              <option value="">{t("rede.network.procuraOuOferece")}</option>
              <option value="oferece">{t("rede.network.oferece")}</option>
              <option value="procura">{t("rede.network.procura")}</option>
            </Selecao>
            <Botao type="submit" className="sm:col-span-2 sm:w-auto">
              {cadeado ? <Icone nome="cadeado" className="mr-2 size-4" /> : null}
              {t("rede.network.buscar")}
            </Botao>
          </fieldset>
        </form>
        <div className="mt-8" aria-live="polite">
          {estado.fase === "carregando" ? <Esqueleto linhas={4} /> : null}
          {estado.fase === "erro" ? <Erro aoTentar={recarregar}>{t("rede.network.erro")}</Erro> : null}
          {dados && dados.membros.length === 0 ? <Vazio>{t("rede.network.vazio")}</Vazio> : null}
          {dados && dados.membros.length > 0 ? (
            <>
              <ul className="space-y-4">
                {dados.membros.map((m) => (
                  <CartaoPerfil
                    key={m.id}
                    perfil={m}
                    setor={nomeSetor(setores, m.setor_id, idioma)}
                    tags={dados.itens
                      .filter((i) => i.perfil_id === m.id)
                      .map((i) => <Etiqueta key={`${i.tipo}-${i.categoria_id}`}>{t(i.tipo === "oferece" ? "rede.network.oferece" : "rede.network.procura")}: {nomeCategoria(categorias, i.categoria_id, idioma)}</Etiqueta>)}
                    acoes={
                      cadeado ? (
                        <span className="inline-flex min-h-11 items-center gap-2 text-sm opacity-70">
                          <Icone nome="cadeado" className="size-4" />
                          {t("rede.network.conectarBloqueado")}
                        </span>
                      ) : undefined
                    }
                  />
                ))}
              </ul>
              {grupo && dados.membros.length >= POR_PAGINA * pagina ? (
                <div className="mt-6 flex justify-center">
                  <Botao variante="contorno" onClick={() => setPagina(pagina + 1)} className="sm:w-auto">{t("rede.network.verMais")}</Botao>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </>
    )
  }
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <h1 className="font-titulo text-4xl font-medium">{t("rede.network.titulo")}</h1>
      <p className="mt-2 opacity-75">{t("rede.network.intro")}</p>
      <div className="mt-8">{corpo}</div>
    </div>
  )
}
