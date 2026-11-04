import { useEffect, useState } from "react"
import { Navigate, Outlet, useLocation } from "react-router"
import { useCaminho, useT } from "./i18n"
import { useAcesso } from "./lib/acesso"
import { useAuth } from "./lib/sessao"
import { supabase } from "./lib/supabase"
import { DeclararIdade } from "./telas/DeclararIdade"

export function RotaProtegida() {
  const { sessao, carregando } = useAuth()
  const { recarregar } = useAcesso()
  const caminho = useCaminho()
  const t = useT()
  const local = useLocation()
  // Quem se cadastrou pelo formulário já declarou 18 anos (o gatilho grava a data). Quem veio do Google, não (f4_10):
  // pergunta ao banco uma vez por usuário. Falha na leitura mostra a declaração, que é idempotente.
  const uid = sessao?.user.id ?? null
  const precisaPerguntar = !!sessao && sessao.user.user_metadata?.maior_18 !== "true"
  const [declarada, setDeclarada] = useState<{ uid: string; ok: boolean } | null>(null)
  useEffect(() => {
    if (!precisaPerguntar || !uid) return
    let ativo = true
    void supabase.rpc("idade_declarada").then(({ data, error }) => ativo && setDeclarada({ uid, ok: !error && data === true }))
    return () => {
      ativo = false
    }
  }, [precisaPerguntar, uid])

  if (carregando || (precisaPerguntar && declarada?.uid !== uid)) return <p role="status" className="p-12 text-creme/70">{t("comum.carregando")}</p>
  if (!sessao) return <Navigate to={caminho("/entrar")} replace state={{ de: local.pathname }} />
  if (precisaPerguntar && !declarada?.ok) {
    // Sem a declaração o banco devolveu nível visitante: depois de declarar, o nível é lido de novo.
    return <DeclararIdade aoDeclarar={() => (setDeclarada({ uid: sessao.user.id, ok: true }), recarregar())} />
  }
  return <Outlet />
}
