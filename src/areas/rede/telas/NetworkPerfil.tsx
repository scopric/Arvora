import { useState } from "react"
import { Link, useParams } from "react-router"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Botao } from "../../../componentes/Botao"
import { Cartao } from "../../../componentes/Cartao"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Icone } from "../../../componentes/Icone"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useIdioma, useT, useTitulo } from "../../../i18n"
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
  useTitulo("rede.networkPerfil.titulo")
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
      <section aria-labelledby={`bl-${tipo}`}>
        <h2 id={`bl-${tipo}`} className="font-mono text-xs font-semibold tracking-[0.2em] text-destaque uppercase">{t(tipo === "procura" ? "rede.networkPerfil.procura" : "rede.networkPerfil.oferece")}</h2>
        {lista(tipo).length === 0 ? (
          <p className="mt-2 text-sm opacity-70">{t("rede.networkPerfil.nada")}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {lista(tipo).map((i) => (
              <li key={i.categoria_id}>
                <strong>{nomeCategoria(categorias, i.categoria_id, idioma)}</strong>
                {i.texto ? <p className="text-sm opacity-80">{i.texto}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    )
    corpo = (
      <Cartao className="space-y-6">
        <div className="flex items-start gap-4">
          <Avatar nome={perfil.nome} />
          <div>
            <h1 className="text-subtitulo font-semibold sm:text-titulo-p">{perfil.nome}</h1>
            {perfil.empresa_nome ? <p className="opacity-80">{perfil.empresa_nome}</p> : null}
            {local ? <p className="text-sm opacity-60">{local}</p> : null}
          </div>
        </div>
        {perfil.bio ? <p className="whitespace-pre-wrap">{perfil.bio}</p> : null}
        {perfil.linkedin_url?.startsWith("https://") || perfil.instagram ? (
          <p className="flex flex-wrap gap-4 text-sm">
            {perfil.linkedin_url?.startsWith("https://") ? <a href={perfil.linkedin_url} rel="noopener noreferrer" className="underline">LinkedIn</a> : null}
            {perfil.instagram ? <a href={`https://www.instagram.com/${perfil.instagram}`} rel="noopener noreferrer" className="underline">Instagram</a> : null}
          </p>
        ) : null}
        <div className="grid gap-6 sm:grid-cols-2">{bloco("procura")}{bloco("oferece")}</div>
        {meu ? (
          <p className="text-sm opacity-75">{t("rede.networkPerfil.seuPerfil")} <Link to={caminho("/perfil")} className="underline">{t("menu.perfil")}</Link></p>
        ) : (
          <div className="space-y-4 border-t border-current/15 pt-6">
            <div className="flex flex-wrap items-center gap-3">
              {grupo && perfil.id ? (
                <AcaoConexao uid={uid} outroId={perfil.id} nome={perfil.nome ?? ""} origem="busca" conexao={conexao ?? undefined} aoMudar={recarregar} />
              ) : (
                <span className="inline-flex min-h-12 items-center gap-2 text-sm opacity-75"><Icone nome="cadeado" className="size-4" />{t("rede.network.conectarBloqueado")}</span>
              )}
              <Botao variante="contorno" onClick={() => setDenunciando(true)} className="sm:w-auto">{t("rede.networkPerfil.denunciar")}</Botao>
            </div>
            {!grupo ? <p className="text-sm opacity-75">{t("rede.network.bloqueadoClube")}</p> : null}
            {conexao?.status === "aceita" && perfil.id ? (
              <Contato outroId={perfil.id} />
            ) : (
              <p className="text-sm opacity-60">{t("rede.networkPerfil.contatoDepois")}</p>
            )}
          </div>
        )}
        {perfil.id ? <DialogoDenuncia alvo={{ perfil_denunciado_id: perfil.id }} aberto={denunciando} aoFechar={() => setDenunciando(false)} /> : null}
      </Cartao>
    )
  }

  const temPerfil = estado.fase === "pronto" && !!estado.dados?.perfil
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <Link to={caminho("/network")} className="underline">{t("rede.networkPerfil.voltar")}</Link>
      {temPerfil ? null : <h1 className="mt-6 text-subtitulo font-semibold sm:text-titulo-p">{t("rede.networkPerfil.titulo")}</h1>}
      <div className="mt-6">{corpo}</div>
    </div>
  )
}
