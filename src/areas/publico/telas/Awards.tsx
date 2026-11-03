import { Link } from "react-router"
import { Cartao } from "../../../componentes/Cartao"
import { Icone } from "../../../componentes/Icone"
import { useCaminho, useT, useTitulo, type Chave } from "../../../i18n"
import { temNivel, useAcesso, type Nivel } from "../../../lib/acesso"
import { supabase } from "../../../lib/supabase"
import { Pagina } from "../Pagina"
import { useConsulta } from "../usarConsulta"

type Ambiente = { chave: string; nome: Chave; texto: Chave; minimo: Nivel; caminho: string | null }

// Os 7 ambientes (deck s12; PRD §17.4.3). `minimo` só escolhe o cadeado: quem barra de verdade é o RLS. Network já mostra a lista ao Clube.
const AMBIENTES: Omit<Ambiente, "caminho">[] = [
  { chave: "hall", nome: "menu.hallOfFame", texto: "publico.awards.hall", minimo: "visitante" },
  { chave: "biblioteca", nome: "menu.biblioteca", texto: "publico.awards.biblioteca", minimo: "visitante" },
  { chave: "originals", nome: "menu.originals", texto: "publico.awards.originals", minimo: "visitante" },
  { chave: "directory", nome: "menu.directory", texto: "publico.awards.directory", minimo: "visitante" },
  { chave: "network", nome: "menu.network", texto: "publico.awards.network", minimo: "clube" },
  { chave: "match", nome: "menu.match", texto: "publico.awards.match", minimo: "grupo" },
  { chave: "evento", nome: "publico.evento.titulo", texto: "publico.awards.evento", minimo: "visitante" },
]
const CAMINHOS: Record<string, string> = { hall: "/hall-of-fame", biblioteca: "/biblioteca", originals: "/originals", directory: "/directory", network: "/network", match: "/match" }

export function Awards() {
  const t = useT()
  const caminho = useCaminho()
  useTitulo("publico.awards.titulo")
  const { nivel } = useAcesso()
  // Edição em destaque: a mais recente com publicada_em preenchido (filtro explícito; a view já esconde o resto).
  const edicao = useConsulta(
    () => supabase.from("edicoes_publicas").select("slug,nome,fase").not("publicada_em", "is", null).order("ano", { ascending: false }).limit(1).maybeSingle(),
    "edicao-atual",
  )
  const slugEdicao = edicao.dados?.slug

  return (
    <Pagina titulo={t("publico.awards.titulo")} apoio={t("publico.awards.apoio")}>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {AMBIENTES.map((a) => {
          const destino = a.chave === "evento" ? (slugEdicao ? `/evento/${slugEdicao}` : null) : CAMINHOS[a.chave]
          const bloqueado = !temNivel(nivel, a.minimo)
          const nome = (
            <>
              {t(a.nome)}
              {a.chave === "evento" && edicao.dados ? <span className="sr-only"> — {edicao.dados.nome}</span> : null}
            </>
          )
          return (
            <li key={a.chave} className="relative">
              <Cartao className="h-full transition-colors focus-within:border-creme/60 hover:border-creme/60">
                {a.chave === "hall" ? <p className="mb-3 font-mono text-xs tracking-[0.2em] text-dourado uppercase">{t("publico.awards.destaqueHall")}</p> : null}
                <h2 className="font-titulo text-3xl font-bold uppercase">
                  {destino === null ? (
                    nome
                  ) : (
                    <Link to={caminho(destino)} className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado">{nome}</Link>
                  )}
                </h2>
                <p className="mt-3 text-creme/80">{t(a.texto)}</p>
                {destino === null ? <p className="mt-4 text-sm text-creme/70">{t(edicao.erro ? "comum.erroGenerico" : "publico.awards.eventoEmBreve")}</p> : null}
                {bloqueado && destino !== null ? (
                  <p className="mt-4 flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.15em] text-destaque uppercase">
                    <Icone nome="cadeado" className="size-4" />
                    {t(a.minimo === "grupo" ? "menu.bloqueadoGrupo" : "menu.bloqueadoClube")}
                  </p>
                ) : null}
              </Cartao>
            </li>
          )
        })}
      </ul>
    </Pagina>
  )
}
