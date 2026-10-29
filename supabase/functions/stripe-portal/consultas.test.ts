import { deepEqual, rejects } from "node:assert/strict"
import { filtros, sbFalso } from "../_shared/sb-falso.ts"
import { consultas } from "./consultas.ts"

const UID = "00000000-0000-0000-0000-0000000000aa"

Deno.test("consultas portal: perfil_id sempre, com e sem conta; mais recente primeiro", async () => {
  const { sb, chamadas } = sbFalso(() => ({ data: null, error: null }))
  await consultas(sb).cliente(UID)
  await consultas(sb).cliente(UID, 3)
  deepEqual(filtros(chamadas[0]), [`perfil_id=${UID}`])
  deepEqual(filtros(chamadas[1]).sort(), ["conta_stripe_id=3", `perfil_id=${UID}`])
  deepEqual(chamadas[0].passos.find(([m]) => m === "order")![1], ["criado_em", { ascending: false }])
})

Deno.test("consultas portal: erro de consulta lança", async () => {
  await rejects(consultas(sbFalso(() => ({ data: null, error: { message: "boom" } })).sb).cliente(UID))
})
