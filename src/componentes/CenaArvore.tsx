import { useEffect, useRef, useState } from "react"
import { useT } from "../i18n"
import { FundoArvore } from "./FundoArvore"
import { gerar } from "./arvoreRede"

// Árvore sólida que brilha por dentro, em WebGL puro (sem biblioteca): os mesmos fios de arvoreRede.ts viram fitas
// afuniladas (halo gaussiano por baixo, núcleo claro por cima) e a copa vira volumes macios. Geometria 100% determinística.
// Cresce uma vez, inclina com o ponteiro e gira com a rolagem. Sem WebGL: cai no SVG de FundoArvore.
const VERT = `attribute vec3 p;attribute vec2 d;attribute vec4 a;
uniform float uT,uTime,uAsp,uEsc,uOff,uScroll,uHalo;uniform vec2 uPtr;
varying vec2 vUv;varying float vTipo,vA,vH;
void main(){
  float g=smoothstep(a.x,a.x+.04,uT);
  float esp=a.w>1.5?1.:mix(1.,3.2,uHalo);
  vec3 q=p+vec3(d*g*esp,0.);
  q.x+=sin(uTime*.5+q.y*2.)*.004*(q.y+1.);
  float r=uPtr.x*.25+uScroll*.3,c=cos(r),s=sin(r);
  q.xz=mat2(c,-s,s,c)*q.xz;
  q.x=q.x*uEsc+uOff;q.y=(q.y+1.)*uEsc-1.+uPtr.y*.06;
  gl_Position=vec4(q.x*.98/uAsp,q.y*.98,0.,1.+q.z*.45);
  vUv=a.yz;vTipo=a.w;vH=uHalo;vA=g*(1.-uScroll*.8);
}`
const FRAG = `precision mediump float;
varying vec2 vUv;varying float vTipo,vA,vH;
const vec3 S=vec3(.616,.71,.541),C=vec3(.957,.957,.937);
void main(){
  float r=length(vUv);
  float k;
  if(vTipo>1.5)k=exp(-r*r*4.)*(1.-smoothstep(.9,1.,r))*.09*vA;
  else if(vH>.5)k=exp(-r*r*5.)*.3*vA;
  else{k=(1.-smoothstep(.55,1.,r))*vA;gl_FragColor=vec4(mix(S,C,(1.-r)*(1.-r)*.55)*k,k);return;}
  gl_FragColor=vec4(S*k,k);
}`

const PROF = 7
const SEG = 12 // segmentos por fio
const LARG = 4 // ponytail: botão de calibração da espessura (1 = traço do SVG)
const FLOATS = 9 // p(3) d(2) a(4) = 36 B por vértice
const X = (x: number) => (x - 200) / 250
const Y = (y: number) => 1 - y / 300
const profundidade = (x: number, y: number) => 0.3 * Math.sin(3.1 * x) * Math.cos(2.3 * y)
const larg = (prof: number) => Math.max(0.7, 3.6 * 0.7 ** prof)
const CANTOS: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]

// Buffer único [galhos | juntas | copa]; `luz` = vértices de galhos + juntas.
const geometria = () => {
  const { fios, nos } = gerar()
  const dados: number[] = []
  const v = (x: number, y: number, z: number, dx: number, dy: number, t0: number, u: number, w: number, tipo: number) => dados.push(x, y, z, dx, dy, t0, u, w, tipo)
  const juntas: number[][] = []
  for (const f of fios) {
    const [x0, y0, cx, cy, x1, y1] = f.d.match(/-?\d+(\.\d+)?/g)!.map(Number)
    const [px0, py0, pcx, pcy, px1, py1] = [X(x0), Y(y0), X(cx), Y(cy), X(x1), Y(y1)]
    const ponta = f.folha ? 0.2 * larg(f.prof) : larg(f.prof + 1)
    const hw = (t: number) => ((1 - t) * larg(f.prof) + t * ponta) * LARG / 250
    const ponto = (i: number) => {
      const t = i / SEG
      const u = 1 - t
      const x = u * u * px0 + 2 * u * t * pcx + t * t * px1
      const y = u * u * py0 + 2 * u * t * pcy + t * t * py1
      const tx = 2 * u * (pcx - px0) + 2 * t * (px1 - pcx)
      const ty = 2 * u * (pcy - py0) + 2 * t * (py1 - pcy)
      const n = Math.hypot(tx, ty) || 1
      const h = hw(t)
      return { x, y, z: profundidade(x, y), nx: (-ty / n) * h, ny: (tx / n) * h, t0: ((f.prof + t) / PROF) * 0.9 }
    }
    for (let i = 0; i < SEG; i++) {
      const a = ponto(i), b = ponto(i + 1)
      for (const [P, s] of [[a, -1], [b, -1], [b, 1], [a, -1], [b, 1], [a, 1]] as const) v(P.x, P.y, P.z, P.nx * s, P.ny * s, P.t0, 0, s, 0)
    }
    juntas.push([px0, py0, hw(0), ((f.prof) / PROF) * 0.9])
  }
  for (const [x, y, r, t0] of juntas) for (const [cx, cy] of CANTOS) v(x, y, profundidade(x, y), cx * r, cy * r, t0, cx, cy, 1)
  const luz = dados.length / FLOATS // galhos + juntas: desenhados duas vezes (halo e núcleo)
  for (const n of nos) {
    if (n.prof < 4) continue
    const x = X(n.x), y = Y(n.y), r = 0.1 + ((n.r - 1.8) / 1.8) * 0.06
    for (const [cx, cy] of CANTOS) v(x, y, profundidade(x, y), cx * r, cy * r, ((n.prof + 1.5) / PROF) * 0.9, cx, cy, 2)
  }
  return { dados: new Float32Array(dados), luz, total: dados.length / FLOATS }
}

function iniciar(canvas: HTMLCanvasElement, parado: () => boolean, reduzido: boolean, deslocar: boolean, falha: () => void) {
  const gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: true })
  if (!gl) return null
  const sh = (tipo: number, src: string) => {
    const o = gl.createShader(tipo)!
    gl.shaderSource(o, src)
    gl.compileShader(o)
    return o
  }
  const prog = gl.createProgram()!
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  gl.useProgram(prog)
  const { dados, luz, total } = geometria()
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, dados, gl.STATIC_DRAW)
  for (const [nome, tam, desl] of [["p", 3, 0], ["d", 2, 3], ["a", 4, 5]] as const) {
    const l = gl.getAttribLocation(prog, nome)
    gl.enableVertexAttribArray(l)
    gl.vertexAttribPointer(l, tam, gl.FLOAT, false, FLOATS * 4, desl * 4)
  }
  const [uT, uAsp, uTime, uScroll, uPtr, uOff, uEsc, uHalo] = ["uT", "uAsp", "uTime", "uScroll", "uPtr", "uOff", "uEsc", "uHalo"].map((n) => gl.getUniformLocation(prog, n))
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  // Halos não se somam nas juntas: passe de halo com MAX onde a extensão existir.
  const mm = gl.getExtension("EXT_blend_minmax")
  gl.clearColor(0, 0, 0, 0)

  const alvo = { x: 0, y: 0 }
  const atual = { x: 0, y: 0 }
  let raf = 0
  let ini = 0
  let tempo = 0
  let rol = 0
  let visivel = true
  const medir = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    gl.viewport(0, 0, canvas.width, canvas.height)
    const asp = width / Math.max(height, 1)
    gl.uniform1f(uAsp, asp)
    gl.uniform1f(uEsc, Math.min(1, asp / 0.8))
    gl.uniform1f(uOff, deslocar && asp > 1.3 ? 0.42 * asp : 0)
  }
  const quadro = (agora: number) => {
    const dt = Math.min((agora - (ini || agora)) / 1000, 0.1)
    ini = agora
    if (!parado()) tempo += dt
    if (!reduzido && !parado()) {
      atual.x += (alvo.x - atual.x) * 0.06
      atual.y += (alvo.y - atual.y) * 0.06
      const r = canvas.getBoundingClientRect()
      rol += (Math.min(1, Math.max(0, -r.top / Math.max(r.height, 1))) - rol) * 0.1
    }
    const cresce = reduzido ? 1 : Math.min(1, tempo / 3.6)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform1f(uT, 1 - (1 - cresce) ** 3)
    gl.uniform1f(uTime, reduzido ? 0 : tempo)
    gl.uniform1f(uScroll, reduzido ? 0 : rol)
    gl.uniform2f(uPtr, atual.x, atual.y)
    gl.uniform1f(uHalo, 1)
    if (mm) gl.blendEquation(mm.MAX_EXT)
    gl.drawArrays(gl.TRIANGLES, 0, luz)
    if (mm) gl.blendEquation(gl.FUNC_ADD)
    gl.drawArrays(gl.TRIANGLES, luz, total - luz)
    gl.uniform1f(uHalo, 0)
    gl.drawArrays(gl.TRIANGLES, 0, luz)
    raf = !reduzido && visivel && !document.hidden && !parado() ? requestAnimationFrame(quadro) : 0
  }
  const retomar = () => {
    ini = 0
    if (!raf && !reduzido) raf = requestAnimationFrame(quadro)
  }
  const ponteiro = (e: PointerEvent) => {
    alvo.x = (e.clientX / innerWidth) * 2 - 1
    alvo.y = (e.clientY / innerHeight) * 2 - 1
    retomar()
  }
  const perdeu = (e: Event) => {
    e.preventDefault()
    fim()
    falha()
  }
  canvas.addEventListener("webglcontextlost", perdeu)
  const io = new IntersectionObserver(([e]) => {
    visivel = !!e?.isIntersecting
    if (visivel) retomar()
  })
  io.observe(canvas)
  const ro = new ResizeObserver(() => {
    medir()
    if (reduzido) quadro(performance.now())
  })
  ro.observe(canvas)
  medir()
  if (!reduzido) addEventListener("pointermove", ponteiro, { passive: true })
  document.addEventListener("visibilitychange", retomar)
  raf = requestAnimationFrame(quadro)
  const fim = () => {
    cancelAnimationFrame(raf)
    canvas.removeEventListener("webglcontextlost", perdeu)
    io.disconnect()
    ro.disconnect()
    removeEventListener("pointermove", ponteiro)
    document.removeEventListener("visibilitychange", retomar)
    gl.deleteProgram(prog)
    gl.deleteBuffer(buf)
  }
  return { fim, retomar }
}

// `className` posiciona e dimensiona a cena (precisa de altura definida).
export default function CenaArvore({ className = "", cheia = false, classeCanvas = "" }: { className?: string; cheia?: boolean; classeCanvas?: string }) {
  const t = useT()
  const ref = useRef<HTMLCanvasElement>(null)
  const [falhou, setFalhou] = useState(false)
  const [parado, setParado] = useState(false)
  const paradoRef = useRef(false)
  const acordar = useRef<() => void>(() => {})
  useEffect(() => {
    paradoRef.current = parado
    if (!parado) acordar.current()
  }, [parado])

  useEffect(() => {
    const reduzido = (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches)
    const cena = ref.current && iniciar(ref.current, () => paradoRef.current, reduzido, cheia, () => setFalhou(true))
    if (!cena) return setFalhou(true)
    acordar.current = cena.retomar
    return cena.fim
  }, [cheia])

  if (falhou) return <FundoArvore className={`${className} ${classeCanvas}`} camada="w-full" />
  return (
    <div className={`pointer-events-none absolute ${className}`}>
      <canvas ref={ref} aria-hidden="true" className={`size-full ${cheia ? "" : "cena-mascara"} ${classeCanvas}`} />
      <button
        type="button"
        onClick={() => setParado(!parado)}
        className="pointer-events-auto absolute right-4 bottom-4 z-10 inline-flex motion-reduce:hidden size-11 items-center justify-center rounded-lg text-creme/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destaque"
      >
        <span className="sr-only">{t(parado ? "fundo.continuar" : "fundo.pausar")}</span>
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-5" fill="currentColor">
          {parado ? <path d="M8 5v14l11-7z" /> : <path d="M6 5h4v14H6zM14 5h4v14h-4z" />}
        </svg>
      </button>
    </div>
  )
}
