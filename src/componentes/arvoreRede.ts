// Gerador determinístico da árvore de rede do FundoArvore (arquivo à parte: componentes e funções não se misturam no Fast Refresh).
export type Fio = { d: string; prof: number; larg: number; op: number }
export type No = { x: number; y: number; r: number; ouro: boolean; prof: number; ciclo: number; fase: number }

const SEMENTE = 20261022
const PROF_MAX = 6
export const PASSO = 0.6 // s de atraso por nível; 6 × 0,6 + 0,9 s de traço = 4,5 s

// Gerador pseudoaleatório com semente fixa (mulberry32): a mesma árvore em todo render e no pré-render.
function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function gerar() {
  const rnd = mulberry32(SEMENTE)
  const entre = (a: number, b: number) => a + rnd() * (b - a)
  const f = (n: number) => n.toFixed(1)
  const fios: Fio[] = []
  const nos: No[] = []
  const ramo = (x: number, y: number, ang: number, len: number, prof: number) => {
    const x2 = x + Math.sin(ang) * len
    const y2 = y - Math.cos(ang) * len
    const dobra = entre(-0.18, 0.18) * len
    const cx = (x + x2) / 2 + Math.cos(ang) * dobra
    const cy = (y + y2) / 2 + Math.sin(ang) * dobra
    fios.push({
      d: `M${f(x)} ${f(y)}Q${f(cx)} ${f(cy)} ${f(x2)} ${f(y2)}`,
      prof,
      larg: Math.max(0.7, 3.6 * 0.7 ** prof),
      op: +entre(0.38, 0.58).toFixed(2),
    })
    const folha = prof >= PROF_MAX || (prof >= 3 && rnd() < 0.3)
    if (folha || (prof >= 1 && rnd() < 0.25)) {
      nos.push({
        x: +f(x2), y: +f(y2), prof,
        r: +(folha ? entre(2.4, 3.6) : entre(1.8, 2.4)).toFixed(1),
        ouro: rnd() < 0.2,
        ciclo: +entre(5, 9).toFixed(1),
        fase: +entre(0, 3).toFixed(1),
      })
    }
    if (folha) return
    const filhos = prof < 3 && rnd() < 0.25 ? 3 : 2
    for (let i = 0; i < filhos; i++) {
      const lado = filhos === 3 ? i - 1 : i === 0 ? -1 : 1
      ramo(x2, y2, ang + lado * entre(0.25, 0.6) + entre(-0.08, 0.08), len * entre(0.72, 0.86), prof + 1)
    }
  }
  ramo(200, 600, 0, 120, 0)
  return { fios, nos }
}
