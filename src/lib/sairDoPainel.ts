import { useEffect, useState } from "react"
import { useCaminho } from "../i18n"
import { ehPainel } from "./enderecos"
import { sair, useAuth } from "./sessao"

// No painel, conta de membro não fica logada: sai e volta ao login do painel com o aviso (Decisão 67).
// Se a saída falhar, devolve false e o LayoutAdmin mostra o 404 de antes, em vez de "carregando" para sempre.
export function useSairSeNaoForEquipe(equipe: boolean, carregando: boolean, erro: unknown) {
  const caminho = useCaminho()
  const { sessao } = useAuth()
  const [falhou, setFalhou] = useState(false)
  const membroNoPainel = !!sessao && !carregando && !erro && !equipe && !falhou && ehPainel(window.location.origin)
  useEffect(() => {
    if (!membroNoPainel) return
    sair().then(({ error }) => (error ? setFalhou(true) : window.location.replace(`${caminho("/entrar")}?motivo=membro`)))
  }, [membroNoPainel, caminho])
  return membroNoPainel
}
