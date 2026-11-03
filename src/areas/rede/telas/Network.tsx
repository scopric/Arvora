import { useState, type SubmitEvent } from "react"
import { Aviso } from "../../../componentes/Aviso"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Botao } from "../../../componentes/Botao"
import { Campo, Selecao } from "../../../componentes/Campo"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Icone } from "../../../componentes/Icone"
import { Vazio } from "../../../componentes/Vazio"
import { useIdioma, useT } from "../../../i18n"
import { PaginaApp } from "../../../componentes/PaginaApp"
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
  const acesso = useAcesso()
  const { sessao } = useAuth()
  const uid = sessao?.user.id ?? ""
  const grupo = !acesso.carregando && temNivel(acesso.nivel, "grupo")
  const clube = !acesso.carregando && acesso.nivel === "clube"
  const liberado = !acesso.erro && (grupo || clube)

  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTROS) // os aplicados; o formulário só os troca ao enviar
  const chave = `${liberado}-${grupo}-${JSON.stringify(filtros)}`
  // Páginas fixas de 30 pela RPC (limite + pular); "Ver mais" acrescenta sem recarregar a lista nem perder o foco.
  async function buscarPagina(pular: number) {
    const membros = ok(
      await supabase.rpc("buscar_membros", {
        filtro_setor: filtros.setor ? Number(filtros.setor) : undefined,
        filtro_cidade: filtros.cidade.trim() || undefined,
        filtro_categoria: filtros.categoria ? Number(filtros.categoria) : undefined,
        filtro_tipo: filtros.tipo ? (filtros.tipo as "procura" | "oferece") : undefined,
        limite: POR_PAGINA,
        pular,
      }),
    )
    const ids = membros.map((m) => m.id).filter((i): i is string => !!i)
    const itens: Item[] = ids.length ? ok(await supabase.from("network_itens").select("perfil_id, tipo, categoria_id, texto").in("perfil_id", ids)) : []
    return { membros: membros as Vitrine[], itens }
  }
  // Setores e categorias numa carga própria: se viessem com a lista, sumiriam a cada busca e o <select> voltaria a "Todos".
  const listas = useCarga(async () => {
    if (!liberado) return null
    const [setores, categorias] = await Promise.all([
      supabase.from("setores").select("id, nome, nome_en").eq("ativo", true).order("ordem").order("nome"),
      supabase.from("categorias_rede").select("id, nome, nome_en").order("ordem").order("nome"),
    ])
    return { setores: ok(setores) as Setor[], categorias: ok(categorias) as Categoria[] }
  }, `${liberado}`)
  const { estado, recarregar } = useCarga(async () => {
    if (!liberado) return null
    return grupo
      ? await buscarPagina(0)
      : // Clube: lista simples pela vitrine, sem filtros nem itens (matriz §5); só os 30 primeiros.
        { membros: ok(await supabase.from("perfis_vitrine").select(VITRINE).neq("id", uid).order("nome").limit(POR_PAGINA)), itens: [] as Item[] }
  }, chave)
  const [mais, setMais] = useState<{ k: string; membros: Vitrine[]; itens: Item[]; fim: boolean }>({ k: "", membros: [], itens: [], fim: false })
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erroMais, setErroMais] = useState(false)
  const extra = mais.k === chave ? mais : { membros: [], itens: [], fim: false }

  async function verMais(total: number) {
    setErroMais(false)
    setCarregandoMais(true)
    try {
      const p = await buscarPagina(total)
      setMais({ k: chave, membros: [...extra.membros, ...p.membros], itens: [...extra.itens, ...p.itens], fim: p.membros.length < POR_PAGINA })
    } catch {
      setErroMais(true)
    }
    setCarregandoMais(false)
  }

  function buscar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setFiltros({ setor: String(f.get("setor")), cidade: String(f.get("cidade")), categoria: String(f.get("categoria")), tipo: String(f.get("tipo")) })
  }

  let corpo
  if (acesso.carregando) corpo = <Esqueleto linhas={4} />
  else if (acesso.erro) corpo = <Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro>
  else if (!liberado) corpo = <Bloqueado minimo="clube" frase={t("rede.network.bloqueadoVisitante")} />
  else {
    const base = estado.fase === "pronto" ? estado.dados : null
    const dados = base && { ...base, membros: [...base.membros, ...extra.membros], itens: [...base.itens, ...extra.itens] }
    const temMais = grupo && !!base && !extra.fim && base.membros.length >= POR_PAGINA && (extra.membros.length === 0 || extra.membros.length % POR_PAGINA === 0)
    const setores = (listas.estado.fase === "pronto" && listas.estado.dados?.setores) || []
    const categorias = (listas.estado.fase === "pronto" && listas.estado.dados?.categorias) || []
    const erroListas = listas.estado.fase === "erro"
    const cadeado = clube
    corpo = (
      <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
        {/* Molde Scale AI (diretório): painel de filtros em vidro à esquerda, fixo ao rolar, com Limpar e Buscar no rodapé;
            resultados em grade de 3 colunas (2 em telas médias). Sem "Salvos": não há favorito no banco. */}
        <form onSubmit={buscar} onReset={() => setFiltros(SEM_FILTROS)} aria-labelledby="filtros-titulo" className="rounded-lg p-5 vidro-fundo lg:sticky lg:top-24 lg:self-start">
          <h2 id="filtros-titulo" className="text-corpo-p font-semibold text-cinza">{t("rede.network.filtros")}</h2>
          <fieldset disabled={cadeado} className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-1">
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
            {/* Para o Clube o dourado da tela é o do Bloqueado: o botão fica em cinza. */}
            <div className="flex gap-3 border-t border-placa pt-4 sm:col-span-2 lg:col-span-1">
              {cadeado ? null : <Botao type="reset" variante="contorno" className="flex-1">{t("rede.network.limpar")}</Botao>}
              <Botao type="submit" variante={cadeado ? "secundario" : "primario"} className="flex-1">
                {cadeado ? <Icone nome="cadeado" className="size-4" /> : null}
                {t("rede.network.buscar")}
              </Botao>
            </div>
          </fieldset>
        </form>
        <div className="min-w-0 space-y-6" aria-live="polite">
          {clube ? <Bloqueado frase={t("rede.network.bloqueadoClube")} /> : null}
          {estado.fase === "carregando" ? <Esqueleto linhas={4} /> : null}
          {estado.fase === "erro" || erroListas ? <Erro aoTentar={erroListas ? listas.recarregar : recarregar}>{t("rede.network.erro")}</Erro> : null}
          {dados && dados.membros.length === 0 ? <Vazio>{t("rede.network.vazio")}</Vazio> : null}
          {dados && dados.membros.length > 0 ? (
            <>
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                        <span className="inline-flex items-center gap-2 text-corpo-p text-cinza">
                          <Icone nome="cadeado" className="size-4" />
                          {t("rede.network.conectarBloqueado")}
                        </span>
                      ) : undefined
                    }
                  />
                ))}
              </ul>
              {clube && dados.membros.length >= POR_PAGINA ? <p className="mt-6 text-corpo-p text-cinza">{t("rede.network.soPrimeiros")}</p> : null}
              {temMais ? (
                <div className="mt-6 flex flex-col items-center gap-3">
                  {erroMais ? <Aviso tipo="erro">{t("rede.network.erro")}</Aviso> : null}
                  <Botao variante="secundario" ocupado={carregandoMais} onClick={() => void verMais(dados.membros.length)} className="sm:w-auto">{t("rede.network.verMais")}</Botao>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    )
  }
  return (
    <PaginaApp chave="rede.network.titulo" intro={t("rede.network.intro")}>
      {corpo}
    </PaginaApp>
  )
}
