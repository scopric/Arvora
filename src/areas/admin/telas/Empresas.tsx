import { useState } from "react"
import { DialogoConfirmar } from "../../../componentes/DialogoConfirmar"
import { Cartao } from "../../../componentes/Cartao"
import { Selo } from "../../../componentes/Selo"
import { Vazio } from "../../../componentes/Vazio"
import { useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { classeAcao } from "../componentes/Campos"
import { CrudTabela } from "../componentes/CrudTabela"
import type { CampoDef } from "../componentes/FormularioRegistro"
import { AvisoDe, Mostrar, Pagina, Secao } from "../componentes/Pagina"
import { exigir, exigirSemDados, useAcao, useCarga } from "../lib/consulta"
import { opcoesDe } from "../lib/opcoes"
import { APROVA_EMPRESA, EDITA, usePode } from "../lib/papel"

// Fila de aprovação (ADM-02, DIR-02) e cadastro. O motivo da recusa não tem coluna no banco (lacuna reportada).
export function Empresas() {
  const t = useT()
  const aprova = usePode(APROVA_EMPRESA)
  const edita = usePode(EDITA)
  const acao = useAcao()
  const [recusar, setRecusar] = useState<number | null>(null)
  const [versao, setVersao] = useState(0)
  const carga = useCarga(async () => {
    const [fila, setores] = await Promise.all([
      supabase.from("empresas").select("id, nome, cidade, pais, site, descricao, setor_id, criado_em").eq("status", "pendente").order("criado_em"),
      supabase.from("setores").select("id, nome").order("ordem"),
    ])
    return { fila: exigir(fila), setores: exigir(setores) }
  }, [versao])

  const decidir = (id: number, aprovar: boolean) =>
    acao.rodar(async () => {
      exigirSemDados(await supabase.rpc("aprovar_empresa", { empresa: id, aprovar }))
      setVersao((v) => v + 1)
    }, aprovar ? "admin.empresas.aprovada" : "admin.empresas.recusada")

  return (
    <Pagina titulo="admin.empresas.titulo" intro="admin.empresas.intro">
      <Mostrar carga={carga}>
        {({ fila, setores }) => {
          const campos: CampoDef[] = [
            { chave: "nome", rotulo: "admin.comum.nome", tipo: "texto", obrigatorio: true, naTabela: true },
            { chave: "slug", rotulo: "admin.comum.slug", tipo: "texto", slugDe: "nome", ajuda: "admin.comum.slugAjuda" },
            { chave: "setor_id", rotulo: "admin.empresas.setor", tipo: "selecao", obrigatorio: true, opcoes: opcoesDe(setores), naTabela: true },
            { chave: "cidade", rotulo: "admin.comum.cidade", tipo: "texto", naTabela: true },
            { chave: "pais", rotulo: "admin.comum.pais", tipo: "texto", ajuda: "admin.comum.paisAjuda" },
            { chave: "site", rotulo: "admin.comum.site", tipo: "url" },
            { chave: "logo_path", rotulo: "admin.empresas.logo", tipo: "imagem", pasta: "empresas" },
            { chave: "descricao", rotulo: "admin.comum.descricao", tipo: "area" },
          ]
          return (
            <>
              <Secao titulo="admin.empresas.fila">
                <AvisoDe aviso={acao.aviso} />
                {fila.length === 0 ? (
                  <Vazio>{t("admin.vazio.nada")}</Vazio>
                ) : (
                  <ul className="grid gap-4 md:grid-cols-2">
                    {fila.map((e) => (
                      <li key={e.id}>
                        <Cartao>
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-lg font-semibold">{e.nome}</h3>
                            <Selo tom="alerta">{t("admin.empresas.pendente")}</Selo>
                          </div>
                          <p className="mt-1 text-sm opacity-75">{[e.cidade, e.pais].filter(Boolean).join(" · ") || "—"}</p>
                          {e.site ? <p className="mt-1 text-sm"><a className="underline" href={e.site} target="_blank" rel="noopener noreferrer">{e.site}</a></p> : null}
                          {e.descricao ? <p className="mt-3 text-sm">{e.descricao}</p> : null}
                          {aprova ? (
                            <div className="mt-4 flex gap-3">
                              <button type="button" className={classeAcao} disabled={acao.ocupado} onClick={() => void decidir(e.id, true)}>{t("admin.empresas.aprovar")}</button>
                              <button type="button" className={classeAcao} disabled={acao.ocupado} onClick={() => setRecusar(e.id)}>{t("admin.empresas.recusar")}</button>
                            </div>
                          ) : null}
                        </Cartao>
                      </li>
                    ))}
                  </ul>
                )}
              </Secao>
              <Secao titulo="admin.empresas.todas">
                <CrudTabela
                  tabela="empresas" colunas="id, nome, slug, setor_id, cidade, pais, site, logo_path, descricao, status" campos={campos} ordem={[{ coluna: "nome" }]}
                  podeEditar={edita} podeApagar legenda="admin.empresas.titulo" vazio="admin.empresas.vazio" aoMudar={() => setVersao((v) => v + 1)}
                  extra={{ titulo: "admin.comum.status", celula: (l) => <Selo tom={l.status === "publicada" ? "destaque" : l.status === "rejeitada" ? "alerta" : "neutro"}>{t(`admin.empresas.status.${String(l.status) as "pendente"}`)}</Selo> }}
                />
              </Secao>
              <DialogoConfirmar
                aberto={recusar !== null} perigo titulo={t("admin.empresas.recusarTitulo")} texto={t("admin.empresas.recusarTexto")} confirmar={t("admin.empresas.recusar")}
                aoCancelar={() => setRecusar(null)}
                aoConfirmar={() => { const id = recusar; setRecusar(null); if (id !== null) void decidir(id, false) }}
              />
            </>
          )
        }}
      </Mostrar>
    </Pagina>
  )
}
