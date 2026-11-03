import { useState } from "react"
import { Link, useParams } from "react-router"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Botao } from "../../../componentes/Botao"
import { Cartao } from "../../../componentes/Cartao"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Icone } from "../../../componentes/Icone"
import { LinkVoltar } from "../../../componentes/LinkVoltar"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useIdioma, useT } from "../../../i18n"
import { linkTextoApp } from "../../../componentes/menuApp"
import { MolduraApp, PaginaApp } from "../../../componentes/PaginaApp"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { AcaoConexao, Avatar, Contato, DialogoDenuncia } from "../componentes"
import { COLUNAS_CONEXAO, nomeCategoria, nomeSetor, ok, useCarga, VITRINE, type Categoria, type Conexao, type Item, type Setor } from "../lib"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function NetworkPerfil() {
  const t = useT()
  const idioma = useIdioma()
  const caminho = useCaminho()
  const { perfil: param = "" } = useParams()
  const acesso = useAcesso()
  const { sessao } = useAuth()
  const uid = sessao?.user.id ?? ""
  const [denunciando, setDenunciando] = useState(false)
  const liberado = !acesso.carregando && !acesso.erro && temNivel(acesso.nivel, "clube")
  const grupo = temNivel(acesso.nivel, "grupo")

  // O endereço leva o slug (ou o id, para quem ainda não tem slug). Perfil privado ou suspenso não volta do banco (RLS).
  const { estado, recarregar } = useCarga(async () => {
    if (!liberado) return null
    const base = supabase.from("perfis_vitrine").select(VITRINE)
    const { data: p, error } = await (UUID.test(param) ? base.eq("id", param) : base.eq("slug", param)).maybeSingle()
    if (error) throw error
    if (!p?.id) return { perfil: null }
    const id = p.id
    const [setores, categorias, itens, conexao] = await Promise.all([
      supabase.from("setores").select("id, nome, nome_en"),
      supabase.from("categorias_rede").select("id, nome, nome_en"),
      supabase.from("network_itens").select("perfil_id, tipo, categoria_id, texto").eq("perfil_id", id),
      supabase.from("conexoes").select(COLUNAS_CONEXAO)
        .or(`and(solicitante_id.eq.${uid},destinatario_id.eq.${id}),and(solicitante_id.eq.${id},destinatario_id.eq.${uid})`).maybeSingle(),
    ])
    if (conexao.error) throw conexao.error
    return { perfil: p, setores: ok(setores) as Setor[], categorias: ok(categorias) as Categoria[], itens: ok(itens) as Item[], conexao: conexao.data as Conexao | null }
  }, `${liberado}-${param}`)

  let corpo
  if (acesso.carregando || (liberado && estado.fase === "carregando")) corpo = <Esqueleto linhas={5} />
  else if (acesso.erro) corpo = <Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro>
  else if (!liberado) corpo = <Bloqueado minimo="clube" frase={t("rede.network.bloqueadoVisitante")} />
  else if (estado.fase === "erro") corpo = <Erro aoTentar={recarregar}>{t("rede.networkPerfil.erro")}</Erro>
  else if (estado.fase === "pronto" && estado.dados && !estado.dados.perfil) corpo = <Vazio>{t("rede.networkPerfil.privado")}</Vazio>
  else if (estado.fase === "pronto" && estado.dados?.perfil) {
    const { perfil, setores = [], categorias = [], itens = [], conexao } = estado.dados
    const meu = perfil.id === uid
    const local = [nomeSetor(setores, perfil.setor_id, idioma), perfil.cidade].filter(Boolean).join(" · ")
    const lista = (tipo: Item["tipo"]) => itens.filter((i) => i.tipo === tipo)
    const bloco = (tipo: Item["tipo"]) => (
      <Cartao>
        <section aria-labelledby={`bl-${tipo}`}>
          <h2 id={`bl-${tipo}`} className="text-corpo-p font-semibold text-cinza">{t(tipo === "procura" ? "rede.networkPerfil.procura" : "rede.networkPerfil.oferece")}</h2>
          {lista(tipo).length === 0 ? (
            <p className="mt-3 text-corpo text-cinza">{t("rede.networkPerfil.nada")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-fumaca">
              {lista(tipo).map((i) => (
                <li key={i.categoria_id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-corpo font-semibold">{nomeCategoria(categorias, i.categoria_id, idioma)}</p>
                  {i.texto ? <p className="mt-1 text-corpo text-cinza">{i.texto}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </Cartao>
    )
    const nomeOk = perfil.nome || null
    const redes = perfil.linkedin_url?.startsWith("https://") || perfil.instagram
    // Molde B150: cabeçalho com avatar 96, nome em Big Shoulders, empresa e setor · cidade, links; ações (Pedir conexão
    // dourado, Denunciar em Ghost) na lateral direita a partir de 640px. Depois os blocos Sobre, Procura, Oferece e Contato.
    corpo = (
      <div className="space-y-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <Avatar nome={nomeOk} grande />
          <div className="min-w-0 flex-1">
            <h1 className="font-conteudo text-titulo-g font-[500] tracking-normal break-words text-balance uppercase lg:text-conteudo">{nomeOk ?? t("rede.networkPerfil.titulo")}</h1>
            {perfil.empresa_nome ? <p className="mt-3 text-corpo text-creme">{perfil.empresa_nome}</p> : null}
            {local ? <p className="text-corpo-p text-cinza">{local}</p> : null}
            {redes ? (
              <p className="mt-3 flex flex-wrap gap-4 text-corpo-p">
                {perfil.linkedin_url?.startsWith("https://") ? <a href={perfil.linkedin_url} rel="noopener noreferrer" className={linkTextoApp}>LinkedIn</a> : null}
                {perfil.instagram ? <a href={`https://www.instagram.com/${perfil.instagram}`} rel="noopener noreferrer" className={linkTextoApp}>Instagram</a> : null}
              </p>
            ) : null}
          </div>
          {meu ? null : (
            <div className="flex flex-wrap items-center gap-3 sm:w-56 sm:shrink-0 sm:flex-col sm:items-stretch">
              {grupo && perfil.id ? (
                <AcaoConexao uid={uid} outroId={perfil.id} nome={nomeOk ?? ""} origem="busca" conexao={conexao ?? undefined} aoMudar={recarregar} />
              ) : (
                <span className="inline-flex items-center gap-2 text-corpo-p text-cinza"><Icone nome="cadeado" className="size-4" />{t("rede.network.conectarBloqueado")}</span>
              )}
              <Botao pequeno onClick={() => setDenunciando(true)}>{t("rede.networkPerfil.denunciar")}</Botao>
            </div>
          )}
        </div>
        {perfil.bio ? (
          <Cartao>
            <h2 className="text-corpo-p font-semibold text-cinza">{t("rede.networkPerfil.sobre")}</h2>
            <p className="mt-3 max-w-prose text-corpo whitespace-pre-wrap">{perfil.bio}</p>
          </Cartao>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">{bloco("procura")}{bloco("oferece")}</div>
        {meu ? (
          <p className="text-corpo-p text-cinza">{t("rede.networkPerfil.seuPerfil")} <Link to={caminho("/perfil")} className={linkTextoApp}>{t("menu.perfil")}</Link></p>
        ) : (
          <Cartao>
            <h2 className="text-corpo-p font-semibold text-cinza">{t("rede.networkPerfil.contato")}</h2>
            <div className="mt-3 space-y-3">
              {!grupo ? <p className="text-corpo text-cinza">{t("rede.network.bloqueadoClube")}</p> : null}
              {conexao?.status === "aceita" && perfil.id ? <Contato outroId={perfil.id} /> : <p className="text-corpo text-cinza">{t("rede.networkPerfil.contatoDepois")}</p>}
            </div>
          </Cartao>
        )}
        {perfil.id ? <DialogoDenuncia alvo={{ perfil_denunciado_id: perfil.id }} aberto={denunciando} aoFechar={() => setDenunciando(false)} /> : null}
      </div>
    )
  }

  // Com perfil carregado o <h1> é o nome, dentro do cabeçalho; nos outros estados a moldura dá o título da rota.
  if (liberado && estado.fase === "pronto" && estado.dados?.perfil)
    return (
      <MolduraApp chave="rede.networkPerfil.titulo">
        <div className="mx-auto max-w-[720px]">
          <LinkVoltar para={caminho("/network")} rotulo={t("rede.networkPerfil.voltar")} />
          {corpo}
        </div>
      </MolduraApp>
    )
  return (
    <PaginaApp chave="rede.networkPerfil.titulo" estreita voltar={{ para: caminho("/network"), rotulo: t("rede.networkPerfil.voltar") }}>
      {corpo}
    </PaginaApp>
  )
}
