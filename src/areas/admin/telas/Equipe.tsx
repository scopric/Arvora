import { useState } from "react"
import { Botao } from "../../../componentes/Botao"
import { Campo, Selecao } from "../../../componentes/Campo"
import { DialogoConfirmar } from "../../../componentes/DialogoConfirmar"
import { Tabela } from "../../../componentes/Tabela"
import { Vazio } from "../../../componentes/Vazio"
import { useT } from "../../../i18n"
import { useAcesso, type PapelEquipe } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { classeAcao } from "../componentes/Campos"
import { AvisoDe, Mostrar, Pagina, Secao, SemPermissao } from "../componentes/Pagina"
import { exigir, exigirLinha, useAcao, useCarga } from "../lib/consulta"
import { SUPER, usePode } from "../lib/papel"

const PAPEIS: PapelEquipe[] = ["super_admin", "editor", "corretor", "moderador", "auditor"]

// Papéis da equipe (ADM-08). Só o super_admin lê e escreve a tabela (RLS). Quem entra aqui já existe como perfil; a busca é pelo nome.
export function Equipe() {
  const t = useT()
  const pode = usePode(SUPER)
  const { sessao } = useAuth()
  const { recarregar: recarregarAcesso } = useAcesso()
  const acao = useAcao()
  const [remover, setRemover] = useState<string | null>(null)
  const [trocar, setTrocar] = useState<{ perfil: string; nome: string; papel: PapelEquipe } | null>(null)
  const [busca, setBusca] = useState("")
  const [achados, setAchados] = useState<{ id: string; nome: string }[]>([])
  const [novoPapel, setNovoPapel] = useState<PapelEquipe>("editor")
  const carga = useCarga(async () => {
    const eq = exigir(await supabase.from("equipe").select("perfil_id, papel, criado_em").order("criado_em"))
    const nomes = eq.length ? exigir(await supabase.from("perfis").select("id, nome").in("id", eq.map((e) => e.perfil_id))) : []
    return eq.map((e) => ({ ...e, nome: nomes.find((n) => n.id === e.perfil_id)?.nome ?? e.perfil_id.slice(0, 8) }))
  }, [pode])
  if (!pode) return <Pagina titulo="admin.equipe.titulo"><SemPermissao /></Pagina>
  const eu = sessao?.user.id

  const buscar = () =>
    acao.rodar(async () => {
      const termo = busca.trim().replace(/[%,()]/g, " ")
      if (termo.length < 2) return setAchados([])
      setAchados(exigir(await supabase.from("perfis").select("id, nome").ilike("nome", `%${termo}%`).order("nome").limit(10)))
    })
  const mudar = (perfil: string, papel: PapelEquipe) =>
    acao.rodar(async () => {
      exigirLinha(await supabase.from("equipe").update({ papel }).eq("perfil_id", perfil).select("perfil_id"))
      carga.recarregar()
      if (perfil === eu) recarregarAcesso()
    }, "admin.comum.salvo")
  const adicionar = (perfil: string) =>
    acao.rodar(async () => {
      exigirLinha(await supabase.from("equipe").insert({ perfil_id: perfil, papel: novoPapel }).select("perfil_id"))
      setAchados([])
      setBusca("")
      carga.recarregar()
    }, "admin.equipe.adicionado")

  return (
    <Pagina titulo="admin.equipe.titulo" intro="admin.equipe.intro">
      <AvisoDe aviso={acao.aviso} />
      <Mostrar carga={carga}>
        {(linhas) =>
          linhas.length === 0 ? (
            <Vazio>{t("admin.vazio.nada")}</Vazio>
          ) : (
            <Tabela
              legenda={t("admin.equipe.titulo")} linhas={linhas} id={(l) => l.perfil_id}
              colunas={[
                { chave: "nome", titulo: t("admin.comum.nome"), celula: (l) => l.nome },
                {
                  chave: "papel", titulo: t("admin.equipe.papel"),
                  celula: (l) => (
                    <Selecao rotulo={`${t("admin.equipe.papel")} — ${l.nome}`} value={l.papel} disabled={l.perfil_id === eu || acao.ocupado} onChange={(e) => setTrocar({ perfil: l.perfil_id, nome: l.nome, papel: e.target.value as PapelEquipe })}>
                      {PAPEIS.map((p) => <option key={p} value={p}>{t(`admin.papel.${p}`)}</option>)}
                    </Selecao>
                  ),
                },
                { chave: "acoes", titulo: t("admin.comum.acoes"), celula: (l) => (l.perfil_id === eu ? "—" : <button type="button" className={classeAcao} aria-label={`${t("admin.equipe.remover")}: ${l.nome}`} onClick={() => setRemover(l.perfil_id)}>{t("admin.equipe.remover")}</button>) },
              ]}
            />
          )
        }
      </Mostrar>
      <Secao titulo="admin.equipe.adicionar">
        <div className="grid max-w-2xl gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <Campo rotulo={t("admin.equipe.buscar")} value={busca} onChange={(e) => setBusca(e.target.value)} />
          <Selecao rotulo={t("admin.equipe.papel")} value={novoPapel} onChange={(e) => setNovoPapel(e.target.value as PapelEquipe)}>
            {PAPEIS.map((p) => <option key={p} value={p}>{t(`admin.papel.${p}`)}</option>)}
          </Selecao>
          <Botao type="button" variante="contorno" onClick={() => void buscar()} className="sm:w-auto">{t("admin.equipe.procurar")}</Botao>
        </div>
        <ul className="mt-4 space-y-2">
          {achados.map((a) => (
            <li key={a.id} className="flex items-center gap-3">
              <span>{a.nome}</span>
              <button type="button" className={classeAcao} onClick={() => void adicionar(a.id)}>{t("admin.equipe.adicionarEste")}</button>
            </li>
          ))}
        </ul>
      </Secao>
      <DialogoConfirmar
        aberto={trocar !== null} titulo={t("admin.equipe.trocarTitulo")} texto={trocar ? `${trocar.nome}: ${t(`admin.papel.${trocar.papel}`)}. ${t("admin.equipe.trocarTexto")}` : ""} confirmar={t("admin.equipe.trocar")}
        aoCancelar={() => setTrocar(null)}
        aoConfirmar={() => { const x = trocar; setTrocar(null); if (x) void mudar(x.perfil, x.papel) }}
      />
      <DialogoConfirmar
        aberto={remover !== null} perigo titulo={t("admin.equipe.removerTitulo")} texto={t("admin.equipe.removerTexto")} confirmar={t("admin.equipe.remover")}
        aoCancelar={() => setRemover(null)}
        aoConfirmar={() => {
          const alvo = remover
          setRemover(null)
          if (alvo) void acao.rodar(async () => { exigirLinha(await supabase.from("equipe").delete().eq("perfil_id", alvo).select("perfil_id")); carga.recarregar() }, "admin.equipe.removido")
        }}
      />
    </Pagina>
  )
}
