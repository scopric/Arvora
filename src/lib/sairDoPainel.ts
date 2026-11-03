import { useEffect } from "react"
import { useCaminho } from "../i18n"
import { ehPainel } from "./enderecos"
import { sair, useAuth } from "./sessao"

// No painel, conta de membro não fica logada: sai e volta ao login do painel (em vez do 404 com a sessão aberta).
export function useSairSeNaoForEquipe(equipe: boolean, carregando: boolean, erro: unknown) {
  const caminho = useCaminho()
  const { sessao } = useAuth()
  const membroNoPainel = !!sessao && !carregando && !erro && !equipe && ehPainel(window.location.origin)
  useEffect(() => {
    if (membroNoPainel) sair().then(({ error }) => !error && window.location.replace(caminho("/entrar")))
  }, [membroNoPainel, caminho])
  return membroNoPainel
}
