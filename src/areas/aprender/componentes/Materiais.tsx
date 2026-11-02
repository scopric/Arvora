import { useState } from "react"
import { useLocation } from "react-router"
import { Abas } from "../../../componentes/Abas"
import { Aviso } from "../../../componentes/Aviso"
import { Botao } from "../../../componentes/Botao"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Vazio } from "../../../componentes/Vazio"
import { useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { COLUNAS_ENTREGA, COLUNAS_EXERCICIO, type EntregaLinha, type ExercicioLinha } from "../tipos"
import { useCarga } from "../useCarga"
import { dados } from "../util"
import { Exercicio } from "./Exercicio"

type Material = { id: number; tipo: "resumo" | "ebook" | "exercicios"; conteudo_md: string | null; arquivo_path: string | null }

// O banco já entrega só o material aprovado e publicado (RLS de materiais_aula); a tela não filtra de novo.
// conteudo_md é mostrado como texto simples, em parágrafos: não há leitor de Markdown na base (lacuna reportada).
function Ebook({ caminho }: { caminho: string }) {
  const t = useT()
  const [erro, setErro] = useState(false)
  async function baixar() {
    setErro(false)
    const { data, error } = await supabase.storage.from("materiais").createSignedUrl(caminho, 60, { download: true })
    if (error || !data) return setErro(true)
    window.location.assign(data.signedUrl)
  }
  return (
    <div className="space-y-3">
      {erro ? <Aviso tipo="erro">{t("aprender.ebook.erro")}</Aviso> : null}
      <Botao onClick={baixar} className="sm:w-auto">{t("aprender.ebook.baixar")}</Botao>
      <p className="text-legenda text-nevoa">{t("aprender.ebook.uso")}</p>
    </div>
  )
}

export function Materiais({ aulaId, uid, podeEnviar, doGrupo }: { aulaId: number; uid: string; podeEnviar: boolean; doGrupo: boolean }) {
  const t = useT()
  const { hash } = useLocation()
  // Rascunhos dos exercícios ficam aqui: a aba inativa é desmontada (Abas) e o texto digitado se perderia.
  const [rascunhos, setRascunhos] = useState<Record<number, string>>({})
  const [estado, recarregar] = useCarga(async () => {
    const [m, e] = await Promise.all([
      supabase.from("materiais_aula").select("id, tipo, conteudo_md, arquivo_path").eq("aula_id", aulaId),
      supabase.from("exercicios").select(COLUNAS_EXERCICIO).eq("aula_id", aulaId).order("ordem"),
    ])
    const exercicios = dados(e) as ExercicioLinha[]
    const ids = exercicios.map((x) => x.id)
    const entregas = ids.length ? (dados(await supabase.from("entregas").select(COLUNAS_ENTREGA).eq("perfil_id", uid).in("exercicio_id", ids)) as EntregaLinha[]) : []
    return { materiais: dados(m) as Material[], exercicios, entregas }
  }, `${aulaId}:${uid}`)

  if (estado.fase === "carregando") return <Esqueleto linhas={5} />
  if (estado.fase === "erro") return <Erro aoTentar={recarregar} />
  const { materiais, exercicios, entregas } = estado.dados
  const de = (tipo: Material["tipo"]) => materiais.find((m) => m.tipo === tipo)
  const resumo = de("resumo")
  const ebook = de("ebook")
  // Aba sem material: a aula já está publicada, então só falta este item. PROVISÓRIO: o "sai até [data]" do PRD §17.5.3 é prazo do cliente.
  const vazio = <Vazio>{t("aprender.materiais.vazio")}</Vazio>
  // Um primário por tela: só o primeiro exercício com formulário aberto (sem entrega, ou a ajustar) fica dourado.
  const entregaDe = (id: number) => entregas.find((e) => e.exercicio_id === id) ?? null
  const primeiroAberto = podeEnviar ? exercicios.find((x) => !entregaDe(x.id) || entregaDe(x.id)?.status === "ajustar")?.id : undefined

  return (
    <Abas
      rotulo={t("aprender.materiais.rotulo")}
      inicial={hash === "#exercicios" ? "exercicios" : undefined}
      abas={[
        {
          chave: "resumo",
          rotulo: t("aprender.aba.resumo"),
          conteudo: resumo?.conteudo_md ? (
            <div className="max-w-prose space-y-4 text-base leading-relaxed">
              {resumo.conteudo_md.split(/\n{2,}/).map((p, i) => (
                <p key={i} className="whitespace-pre-line">{p}</p>
              ))}
            </div>
          ) : (
            vazio
          ),
        },
        { chave: "ebook", rotulo: t("aprender.aba.ebook"), conteudo: ebook?.arquivo_path ? <Ebook caminho={ebook.arquivo_path} /> : vazio },
        {
          chave: "exercicios",
          rotulo: t("aprender.aba.exercicios"),
          conteudo: exercicios.length ? (
            <div className="space-y-5">
              {exercicios.map((x) => (
                <Exercicio key={x.id} exercicio={x} entrega={entregaDe(x.id)} uid={uid} podeEnviar={podeEnviar} doGrupo={doGrupo} primario={x.id === primeiroAberto} aoAtualizar={recarregar} rascunho={rascunhos[x.id]} aoDigitar={(v) => setRascunhos((r) => {
                    const n = { ...r }
                    if (v === undefined) delete n[x.id]
                    else n[x.id] = v
                    return n
                  })} />
              ))}
            </div>
          ) : (
            vazio
          ),
        },
      ]}
    />
  )
}
