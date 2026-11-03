import { useState, type SubmitEvent } from "react"
import { Link } from "react-router"
import { z } from "zod"
import { Aviso } from "../../../componentes/Aviso"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Botao } from "../../../componentes/Botao"
import { Campo, Selecao } from "../../../componentes/Campo"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Selo } from "../../../componentes/Selo"
import { useCaminho, useIdioma, useT, useTitulo, type Chave } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { errosPorCampo, type CamposDeErro } from "../../../lib/validacao"
import { nomeLocalizado } from "../formatos"
import { criarSlug } from "../slug"
import { Pagina } from "../Pagina"
import { linkPrimario } from "../../../componentes/botaoEstilo"
import { useConsulta } from "../usarConsulta"

const vazioParaNulo = (v: string) => (v === "" ? null : v)
// Espelha os checks da tabela empresas (f3_01). O banco é a barreira; aqui é a mensagem ao lado do campo.
const empresaSchema = z.object({
  nome: z.string().trim().min(1, "publico.cadastrarEmpresa.erro.nome").max(160, "publico.cadastrarEmpresa.erro.nome"),
  setor_id: z.coerce.number({ error: "publico.cadastrarEmpresa.erro.setor" }).int("publico.cadastrarEmpresa.erro.setor").positive("publico.cadastrarEmpresa.erro.setor"),
  cidade: z.string().trim().max(80, "publico.cadastrarEmpresa.erro.cidade").transform(vazioParaNulo),
  pais: z.string().trim().toUpperCase().transform(vazioParaNulo).pipe(z.string().regex(/^[A-Z]{2}$/, "publico.cadastrarEmpresa.erro.pais").nullable()),
  site: z.string().trim().transform(vazioParaNulo).pipe(z.string().max(300, "publico.cadastrarEmpresa.erro.site").regex(/^https?:\/\//i, "publico.cadastrarEmpresa.erro.site").refine((v) => URL.canParse(v), "publico.cadastrarEmpresa.erro.site").nullable()),
  descricao: z.string().trim().max(2000, "publico.cadastrarEmpresa.erro.descricao").transform(vazioParaNulo),
})

const SELO: Record<string, { tom: "neutro" | "destaque" | "alerta"; texto: Chave }> = {
  pendente: { tom: "neutro", texto: "publico.cadastrarEmpresa.statusPendente" },
  publicada: { tom: "destaque", texto: "publico.cadastrarEmpresa.statusPublicada" },
  rejeitada: { tom: "alerta", texto: "publico.cadastrarEmpresa.statusRejeitada" },
}

// Cadastro da própria empresa (DIR-02): só logado com Clube ou Grupo. Entra como "pendente" (o gatilho do banco força isso e define o dono);
// a equipe aprova antes de publicar. Editar depois volta para pendente.
export function CadastrarEmpresa() {
  const t = useT()
  const idioma = useIdioma()
  const caminho = useCaminho()
  useTitulo("publico.cadastrarEmpresa.titulo")
  const { sessao, carregando: sessaoCarregando } = useAuth()
  const acesso = useAcesso()
  const uid = sessao?.user.id ?? null
  const setores = useConsulta(() => supabase.from("setores").select("id,nome,nome_en").eq("ativo", true).order("ordem"), "setores")
  const minhas = useConsulta(
    // Sem sessão não há o que ler (e a RPC é só de quem tem conta).
    () => (uid ? supabase.rpc("minhas_empresas") : Promise.resolve({ data: [] as { id: number; nome: string; status: string }[], error: null })),
    `minhas-empresas/${uid}`,
  )
  const [erros, setErros] = useState<CamposDeErro>({})
  const [falha, setFalha] = useState<Chave | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const titulo = t("publico.cadastrarEmpresa.titulo")
  if (sessaoCarregando || (uid && acesso.carregando)) return <Pagina titulo={titulo} largura="max-w-3xl"><Esqueleto /></Pagina>
  if (!uid) {
    return (
      <Pagina titulo={titulo} largura="max-w-3xl">
        <p className="max-w-prose text-lg">{t("publico.cadastrarEmpresa.entrar")}</p>
        <Link to={caminho("/entrar")} className={`${linkPrimario} mt-6`}>{t("nav.entrar")}</Link>
      </Pagina>
    )
  }
  if (acesso.erro) return <Pagina titulo={titulo} largura="max-w-3xl"><Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro></Pagina>
  if (!temNivel(acesso.nivel, "clube")) {
    return <Pagina titulo={titulo} largura="max-w-3xl"><Bloqueado minimo="clube" frase={t("publico.cadastrarEmpresa.bloqueado")} /></Pagina>
  }

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setFalha(null)
    const dados = empresaSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!dados.success) return setErros(errosPorCampo(dados.error))
    setErros({})
    setOcupado(true)
    // Linha vazia na resposta = o banco recusou sem dar erro (RLS): trata como falha, nunca como sucesso (Erros 2.5).
    const r = await supabase.from("empresas").insert({ ...dados.data, slug: criarSlug(dados.data.nome) }).select("id")
    setOcupado(false)
    if (r.error || !r.data?.length) return setFalha("publico.cadastrarEmpresa.erroEnvio")
    setEnviado(true)
    minhas.recarregar()
  }

  const lista = minhas.dados ?? []
  return (
    <Pagina titulo={titulo} apoio={t("publico.cadastrarEmpresa.apoio")} largura="max-w-3xl">
      {enviado ? (
        <div className="mb-10 space-y-5">
          <Aviso tipo="ok">{t("publico.cadastrarEmpresa.pendente")}</Aviso>
          <Botao variante="contorno" onClick={() => setEnviado(false)} className="sm:w-auto">
            {t("publico.cadastrarEmpresa.outra")}
          </Botao>
        </div>
      ) : null}
      {lista.length ? (
        <section aria-labelledby="minhas" className="mb-12">
          <h2 id="minhas" className="mb-3 font-titulo text-3xl font-normal">{t("publico.cadastrarEmpresa.minhas")}</h2>
          <ul className="divide-y divide-creme/15 border-y border-creme/15">
            {lista.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="font-semibold">{m.nome}</span>
                <Selo tom={SELO[m.status].tom}>{t(SELO[m.status].texto)}</Selo>
              </li>
            ))}
          </ul>
        </section>
      ) : minhas.erro ? (
        <div className="mb-10"><Erro aoTentar={minhas.recarregar} /></div>
      ) : null}
      {enviado ? null : setores.erro ? (
        <Erro aoTentar={setores.recarregar} />
      ) : (
        <form onSubmit={enviar} noValidate className="space-y-5">
          <p className="text-sm text-creme/70">{t("publico.cadastrarEmpresa.revisao")}</p>
          {Object.keys(erros).length ? <Aviso tipo="erro">{t("publico.cadastrarEmpresa.corrija")}</Aviso> : null}
          {falha ? <Aviso tipo="erro">{t(falha)}</Aviso> : null}
          <Campo rotulo={t("publico.cadastrarEmpresa.nome")} name="nome" maxLength={160} autoComplete="organization" erro={t(erros.nome)} />
          <Selecao rotulo={t("publico.cadastrarEmpresa.setor")} name="setor_id" defaultValue="" erro={t(erros.setor_id)}>
            <option value="" className="text-fundo">{t("publico.cadastrarEmpresa.escolha")}</option>
            {(setores.dados ?? []).map((s) => (
              <option key={s.id} value={s.id} className="text-fundo">{nomeLocalizado(s, idioma)}</option>
            ))}
          </Selecao>
          <Campo rotulo={t("publico.cadastrarEmpresa.cidade")} name="cidade" maxLength={80} autoComplete="address-level2" erro={t(erros.cidade)} />
          <Campo rotulo={t("publico.cadastrarEmpresa.pais")} name="pais" maxLength={2} autoComplete="country" erro={t(erros.pais)} ajuda={t("publico.cadastrarEmpresa.paisAjuda")} className="uppercase" />
          <Campo rotulo={t("publico.cadastrarEmpresa.site")} name="site" type="url" maxLength={300} inputMode="url" erro={t(erros.site)} ajuda={t("publico.cadastrarEmpresa.siteAjuda")} />
          <div>
            <label htmlFor="descricao" className="mb-2 block text-sm font-semibold text-creme">{t("publico.cadastrarEmpresa.descricao")}</label>
            <textarea
              id="descricao"
              name="descricao"
              rows={5}
              maxLength={2000}
              aria-invalid={erros.descricao ? true : undefined}
              aria-describedby={erros.descricao ? "erro-descricao" : undefined}
              className="w-full rounded-lg border border-creme/25 bg-transparent px-4 py-3 text-base text-creme outline-none focus-visible:border-dourado focus-visible:ring-2 focus-visible:ring-dourado/40"
            />
            {erros.descricao ? <p id="erro-descricao" role="alert" className="mt-2 text-sm text-red-300">{t(erros.descricao)}</p> : null}
          </div>
          <Botao type="submit" ocupado={ocupado}>{t("publico.cadastrarEmpresa.enviar")}</Botao>
        </form>
      )}
    </Pagina>
  )
}
