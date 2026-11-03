import { useState } from "react"
import { Link, useParams } from "react-router"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Botao } from "../../../componentes/Botao"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Icone } from "../../../componentes/Icone"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useIdioma, useT } from "../../../i18n"
import { linkTextoApp } from "../../../componentes/menuApp"
import { PaginaApp } from "../../../componentes/PaginaApp"
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
  let nome: string | undefined
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
      <section aria-labelledby={`bl-${tipo}`} className="rounded-xl p-5 shadow-borda">
        <h2 id={`bl-${tipo}`} className="text-corpo-p font-medium text-nevoa">{t(tipo === "procura" ? "rede.networkPerfil.procura" : "rede.networkPerfil.oferece")}</h2>
        {lista(tipo).length === 0 ? (
          <p className="mt-3 text-base text-nevoa">{t("rede.networkPerfil.nada")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-grafite">
            {lista(tipo).map((i) => (
              <li key={i.categoria_id} className="py-2.5 first:pt-0 last:pb-0">
                <p className="text-base font-medium">{nomeCategoria(categorias, i.categoria_id, idioma)}</p>
                {i.texto ? <p className="mt-1 text-base text-bruma">{i.texto}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    )
    const nomeOk = perfil.nome || null
    nome = nomeOk ?? undefined
    corpo = (
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <Avatar nome={nomeOk} />
          <div>
            {perfil.empresa_nome ? <p className="text-base text-bruma">{perfil.empresa_nome}</p> : null}
            {local ? <p className="text-corpo-p text-nevoa">{local}</p> : null}
          </div>
        </div>
        {perfil.bio ? <p className="max-w-prose text-base whitespace-pre-wrap">{perfil.bio}</p> : null}
        {perfil.linkedin_url?.startsWith("https://") || perfil.instagram ? (
          <p className="flex flex-wrap gap-4 text-corpo-p">
            {perfil.linkedin_url?.startsWith("https://") ? <a href={perfil.linkedin_url} rel="noopener noreferrer" className={linkTextoApp}>LinkedIn</a> : null}
            {perfil.instagram ? <a href={`https://www.instagram.com/${perfil.instagram}`} rel="noopener noreferrer" className={linkTextoApp}>Instagram</a> : null}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">{bloco("procura")}{bloco("oferece")}</div>
        {meu ? (
          <p className="text-corpo-p text-nevoa">{t("rede.networkPerfil.seuPerfil")} <Link to={caminho("/perfil")} className={linkTextoApp}>{t("menu.perfil")}</Link></p>
        ) : (
          <div className="space-y-4 border-t border-grafite pt-6">
            <div className="flex flex-wrap items-center gap-3">
              {grupo && perfil.id ? (
                <AcaoConexao uid={uid} outroId={perfil.id} nome={nomeOk ?? ""} origem="busca" conexao={conexao ?? undefined} aoMudar={recarregar} />
              ) : (
                <span className="inline-flex items-center gap-2 text-corpo-p text-nevoa"><Icone nome="cadeado" className="size-4 text-cinza" />{t("rede.network.conectarBloqueado")}</span>
              )}
              <Botao variante="contorno" onClick={() => setDenunciando(true)} className="sm:w-auto">{t("rede.networkPerfil.denunciar")}</Botao>
            </div>
            {!grupo ? <p className="text-corpo-p text-nevoa">{t("rede.network.bloqueadoClube")}</p> : null}
            {conexao?.status === "aceita" && perfil.id ? (
              <Contato outroId={perfil.id} />
            ) : (
              <p className="text-corpo-p text-nevoa">{t("rede.networkPerfil.contatoDepois")}</p>
            )}
          </div>
        )}
        {perfil.id ? <DialogoDenuncia alvo={{ perfil_denunciado_id: perfil.id }} aberto={denunciando} aoFechar={() => setDenunciando(false)} /> : null}
      </div>
    )
  }

  return (
    <PaginaApp chave="rede.networkPerfil.titulo" titulo={nome} estreita voltar={{ para: caminho("/network"), rotulo: t("rede.networkPerfil.voltar") }}>
      {corpo}
    </PaginaApp>
  )
}
