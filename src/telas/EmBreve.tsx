import { Link } from "react-router"
import { SeletorIdioma } from "../componentes/SeletorIdioma"
import { useCaminho, useT, useTitulo } from "../i18n"
import { useAuth } from "../lib/sessao"

const link =
  "inline-flex min-h-11 items-center rounded-lg px-4 text-creme transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"

export function EmBreve() {
  const { sessao, carregando } = useAuth()
  const t = useT()
  useTitulo("doc.titulo")
  const caminho = useCaminho()
  return (
    <main className="relative isolate flex min-h-dvh flex-col justify-center overflow-hidden px-6 py-24 sm:px-16 lg:px-32">
      <SeletorIdioma />
      <nav aria-label={t("nav.principal")} className="absolute top-0 right-0 flex min-h-17 items-center gap-2 px-4 py-3 text-sm font-semibold sm:px-12">
        {carregando ? null : sessao ? (
          <Link to={caminho("/perfil")} className={link}>{t("nav.perfil")}</Link>
        ) : (
          <>
            <Link to={caminho("/entrar")} className={link}>{t("nav.entrar")}</Link>
            <Link to={caminho("/cadastro")} className={`${link} border border-creme/30 hover:border-creme/60`}>{t("nav.criarConta")}</Link>
          </>
        )}
      </nav>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-1/3 -right-1/4 -z-10 size-[60rem] rounded-full bg-superficie/25 blur-3xl"
      />

      <img
        src="/logo-simbolo.png"
        alt=""
        width="354"
        height="287"
        className="animate-subir mb-8 h-16 w-auto self-start"
        style={{ "--atraso": "0ms" } as React.CSSProperties}
      />
      <p
        className="animate-subir text-xs font-semibold tracking-[0.3em] text-destaque uppercase"
        style={{ "--atraso": "60ms" } as React.CSSProperties}
      >
        {t("inicio.embreve")}
      </p>

      <h1
        className="animate-subir mt-8 max-w-4xl font-titulo text-5xl leading-[1.05] font-medium text-balance sm:text-7xl lg:text-8xl"
        style={{ "--atraso": "120ms" } as React.CSSProperties}
      >
        {t("inicio.titulo")}
      </h1>

      <span
        aria-hidden="true"
        className="animate-subir mt-10 block h-px w-16 bg-dourado"
        style={{ "--atraso": "240ms" } as React.CSSProperties}
      />

      <p
        className="animate-subir mt-10 max-w-xl text-base leading-relaxed text-creme/75 sm:text-lg"
        style={{ "--atraso": "360ms" } as React.CSSProperties}
      >
        {t("inicio.descricao")}
      </p>
    </main>
  )
}
