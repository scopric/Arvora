import { z } from "zod"
import type { Chave } from "../i18n"
import { pt } from "../i18n/pt"

// Mensagens dos schemas são CHAVES do dicionário (src/i18n); a tela traduz com t().
const texto = (max: 80 | 120 | 600) => z.string().trim().max(max, `validacao.max${max}`)
const opcional = (max: 80 | 120 | 600) => texto(max).transform((v) => (v === "" ? null : v))

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "validacao.email.obrigatorio")
  .email("validacao.email.invalido")

// Mesma regra do Supabase local (config.toml): 8+ caracteres com minúscula, maiúscula e número.
export const senha = z
  .string()
  .min(8, "validacao.senha.curta")
  .regex(/[a-z]/, "validacao.senha.minuscula")
  .regex(/[A-Z]/, "validacao.senha.maiuscula")
  .regex(/[0-9]/, "validacao.senha.numero")

export const cadastroSchema = z.object({
  nome: texto(120).min(1, "validacao.nome.obrigatorio"),
  email,
  senha,
  maior18: z.literal(true, { error: "validacao.maior18" }),
})

export const loginSchema = z.object({
  email,
  senha: z.string().min(1, "validacao.senha.obrigatoria"),
})

export const recuperarSchema = z.object({ email })

export const redefinirSchema = z.object({ senha })

// Espelha os checks da tabela perfis (migration f1_03). O banco é a barreira; aqui é a mensagem.
export const perfilSchema = z.object({
  nome: texto(120).min(1, "validacao.nome.obrigatorio"),
  empresa_nome: opcional(120),
  setor_id: z
    .string()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number({ error: "validacao.setor" }).int("validacao.setor").positive("validacao.setor").nullable()),
  cidade: opcional(80),
  pais: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().regex(/^[A-Z]{2}$/, "validacao.pais").nullable()),
  linkedin_url: z
    .string()
    .trim()
    .max(300, "validacao.max300")
    .transform((v) => (v === "" ? null : v))
    .pipe(
      z
        .string()
        .regex(/^https:\/\/([a-z0-9-]+\.)*linkedin\.com\//i, "validacao.linkedin")
        .nullable(),
    ),
  instagram: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@/, ""))
    .transform((v) => (v === "" ? null : v))
    .pipe(
      z
        .string()
        .regex(/^[A-Za-z0-9._]{1,30}$/, "validacao.instagram")
        .nullable(),
    ),
  bio: opcional(600),
  visibilidade: z.enum(["membros", "publico"], { error: "validacao.visibilidade" }),
})

export type CamposDeErro = Record<string, Chave>

// Devolve { campo: chave da mensagem } a partir de um erro do Zod (primeira mensagem de cada campo).
export function errosPorCampo(erro: z.ZodError): CamposDeErro {
  const saida: CamposDeErro = {}
  for (const item of erro.issues) {
    const campo = String(item.path[0] ?? "")
    if (campo && !(campo in saida)) saida[campo] = item.message as Chave
  }
  return saida
}

// Chave da mensagem (erro.auth.<code>) para o erro do Supabase Auth; código desconhecido cai em erro.auth.default.
// Nada de texto técnico na tela.
export function mensagemDeErroAuth(erro: { message?: string; code?: string; status?: number }): Chave {
  const chave = `erro.auth.${erro.code}`
  return chave in pt ? (chave as Chave) : "erro.auth.default"
}

// Parâmetros do link enviado por e-mail (/confirmar): só os tipos que os modelos de e-mail geram.
export const confirmarSchema = z.object({
  token_hash: z.string().min(1),
  type: z.enum(["signup", "recovery", "email_change"]),
})
