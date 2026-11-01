import { Aviso } from "../../../componentes/Aviso"
import { useT, useTitulo, type Chave } from "../../../i18n"
import { Pagina, linkPrimario } from "../Pagina"

// E-mail de suporte vem de VITE_EMAIL_SUPORTE (o domínio ainda não existe; nunca no código). Sem a variável ou com valor
// que não parece e-mail, a tela diz que o canal está em definição em vez de esconder o problema.
const EMAIL = import.meta.env.VITE_EMAIL_SUPORTE as string | undefined
const emailValido = (v: string | undefined): v is string => Boolean(v) && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(v as string)

// PROVISÓRIO: respostas sem promessa comercial; prazos, reembolso e preços dependem do cliente e do solicitor.
const TEMAS: { tema: Chave; perguntas: [Chave, Chave][] }[] = [
  {
    tema: "publico.suporte.t1",
    perguntas: [
      ["publico.suporte.t1.q1", "publico.suporte.t1.a1"],
      ["publico.suporte.t1.q2", "publico.suporte.t1.a2"],
    ],
  },
  {
    tema: "publico.suporte.t2",
    perguntas: [
      ["publico.suporte.t2.q1", "publico.suporte.t2.a1"],
      ["publico.suporte.t2.q2", "publico.suporte.t2.a2"],
    ],
  },
  {
    tema: "publico.suporte.t3",
    perguntas: [
      ["publico.suporte.t3.q1", "publico.suporte.t3.a1"],
      ["publico.suporte.t3.q2", "publico.suporte.t3.a2"],
    ],
  },
  {
    tema: "publico.suporte.t4",
    perguntas: [
      ["publico.suporte.t4.q1", "publico.suporte.t4.a1"],
      ["publico.suporte.t4.q2", "publico.suporte.t4.a2"],
    ],
  },
]

export function Suporte({ email = EMAIL }: { email?: string }) {
  const t = useT()
  useTitulo("publico.suporte.titulo")
  return (
    <Pagina titulo={t("publico.suporte.titulo")} apoio={t("publico.suporte.apoio")} largura="max-w-4xl">
      <div className="mb-12">
        {emailValido(email) ? (
          <a href={`mailto:${email}`} className={linkPrimario}>
            {t("publico.suporte.escrever")} {email}
          </a>
        ) : (
          <Aviso tipo="erro">{t("publico.suporte.semCanal")}</Aviso>
        )}
      </div>
      <div className="space-y-10">
        {TEMAS.map(({ tema, perguntas }) => (
          <section key={tema} aria-labelledby={tema}>
            <h2 id={tema} className="mb-3 font-titulo text-3xl font-bold uppercase">
              {t(tema)}
            </h2>
            <div className="divide-y divide-creme/15 border-y border-creme/15">
              {perguntas.map(([q, a]) => (
                <details key={q} className="py-4">
                  <summary className="flex min-h-11 cursor-pointer items-center font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado">{t(q)}</summary>
                  <p className="mt-2 max-w-prose text-creme/80">{t(a)}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Pagina>
  )
}
