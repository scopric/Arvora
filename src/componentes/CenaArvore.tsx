import { useEffect, useRef, useState } from "react"
import { useT } from "../i18n"
import { FundoArvore } from "./FundoArvore"
import { gerar } from "./arvoreRede"

// Árvore de luz em WebGL puro (sem biblioteca): os mesmos fios e nós de arvoreRede.ts viram pontos com
// profundidade. Cresce uma vez, inclina com o ponteiro e gira com a rolagem. Sem WebGL: cai no SVG de FundoArvore.
const VERT = `attribute vec3 p;attribute vec4 a;
uniform float uT,uAsp,uPx,uTime,uScroll;uniform vec2 uPtr;
varying vec4 vC;
void main(){
  float g=smoothstep(a.x,a.x+.05,uT);
  vec3 q=p;
  if(a.z>2.5)q.y=mod(q.y+1.+uTime*.05*(.4+a.w),2.)-1.;
  q.x+=sin(uTime*.7+q.y*3.+a.w*6.28)*.006*(q.y+1.);
  float r=uPtr.x*.7+uScroll*.9,c=cos(r),s=sin(r);
  q.xz=mat2(c,-s,s,c)*q.xz;
  q.y+=uPtr.y*.08;
  float w=1.+q.z*.45;
  gl_Position=vec4(q.x*.98/uAsp,q.y*.98,0.,w);
  gl_PointSize=max(1.,a.y*uPx*g/w);
  float tw=a.z>.5?.65+.35*sin(uTime*1.6+a.w*40.):1.;
  vec3 col=a.z>1.5?vec3(.79,.64,.29):a.z>.5?vec3(.62,.71,.54):vec3(.96,.96,.94);
  vC=vec4(col,(a.z>2.5?.55:a.z>.5?1.:.8)*tw*g*(1.-uScroll*.8));
}`
const FRAG = `precision mediump float;varying vec4 vC;
void main(){float d=length(gl_PointCoord-.5);float k=smoothstep(.5,.05,d);gl_FragColor=vec4(vC.rgb*vC.a*k,k*vC.a);}`

const PROF = 7
const pontos = () => {
  const { fios, nos } = gerar()
  const dados: number[] = []
  const X = (x: number) => (x - 200) / 250
  const Y = (y: number) => 1 - y / 300
  for (const f of fios) {
    const [x0, y0, cx, cy, x1, y1] = f.d.match(/-?\d+(\.\d+)?/g)!.map(Number)
    const n = Math.max(8, Math.round(Math.hypot(x1 - x0, y1 - y0) / 1.3))
    const z = (Math.random() - 0.5) * 0.7
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const u = 1 - t
      const x = u * u * x0 + 2 * u * t * cx + t * t * x1
      const y = u * u * y0 + 2 * u * t * cy + t * t * y1
      const e = f.larg * 0.02
      dados.push(X(x) + (Math.random() - 0.5) * e, Y(y) + (Math.random() - 0.5) * e, z + (Math.random() - 0.5) * 0.04, ((f.prof + t) / PROF) * 0.9, 1.8 + f.larg * 0.8, 0, Math.random())
    }
  }
  for (const n of nos) {
    for (let i = 0; i < 36; i++) {
      const r = 0.08 * Math.cbrt(Math.random())
      const a = Math.random() * 6.283
      const b = Math.acos(2 * Math.random() - 1)
      dados.push(X(n.x) + r * Math.sin(b) * Math.cos(a), Y(n.y) + r * Math.sin(b) * Math.sin(a), (Math.random() - 0.5) * 0.7 + r * Math.cos(b), ((n.prof + 1.5) / PROF) * 0.9, 2.2 + Math.random() * 2, Math.random() < 0.25 ? 2 : 1, Math.random())
    }
  }
  for (let i = 0; i < 140; i++) dados.push((Math.random() - 0.5) * 1.8, Math.random() * 2 - 1, (Math.random() - 0.5) * 1.2, 0.85, 2 + Math.random() * 3, 3, Math.random())
  for (const n of nos) dados.push(X(n.x), Y(n.y), (Math.random() - 0.5) * 0.7, ((n.prof + 1) / PROF) * 0.9, n.r * 3.4, n.ouro ? 2 : 1, Math.random())
  return new Float32Array(dados)
}

function iniciar(canvas: HTMLCanvasElement, parado: () => boolean, reduzido: boolean, falha: () => void) {
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
  const dados = pontos()
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, dados, gl.STATIC_DRAW)
  const liga = (nome: string, tam: number, desl: number) => {
    const l = gl.getAttribLocation(prog, nome)
    gl.enableVertexAttribArray(l)
    gl.vertexAttribPointer(l, tam, gl.FLOAT, false, 28, desl * 4)
  }
  liga("p", 3, 0)
  liga("a", 4, 3)
  const u = (n: string) => gl.getUniformLocation(prog, n)
  const [uT, uAsp, uPx, uTime, uScroll, uPtr] = ["uT", "uAsp", "uPx", "uTime", "uScroll", "uPtr"].map(u)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE)
  gl.clearColor(0, 0, 0, 0)

  const alvo = { x: 0, y: 0 }
  const atual = { x: 0, y: 0 }
  let raf = 0
  let ini = 0
  let tempo = 0
  let visivel = true
  const medir = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.uniform1f(uAsp, width / Math.max(height, 1))
    gl.uniform1f(uPx, dpr)
  }
  const quadro = (agora: number) => {
    const dt = Math.min((agora - (ini || agora)) / 1000, 0.1)
    ini = agora
    if (!parado()) tempo += dt
    if (!reduzido && !parado()) {
      atual.x += (alvo.x - atual.x) * 0.06
      atual.y += (alvo.y - atual.y) * 0.06
    }
    const r = canvas.getBoundingClientRect()
    const rolagem = Math.min(1, Math.max(0, -r.top / Math.max(r.height, 1)))
    const cresce = reduzido ? 1 : Math.min(1, tempo / 3.6)
    gl.uniform1f(uT, 1 - (1 - cresce) ** 3)
    gl.uniform1f(uTime, reduzido ? 0 : tempo)
    gl.uniform1f(uScroll, reduzido ? 0 : rolagem)
    gl.uniform2f(uPtr, atual.x, atual.y)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.POINTS, 0, dados.length / 7)
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
  }
  return { fim, retomar }
}

// `className` posiciona e dimensiona a cena (precisa de altura definida).
export default function CenaArvore({ className = "" }: { className?: string }) {
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
    const cena = ref.current && iniciar(ref.current, () => paradoRef.current, reduzido, () => setFalhou(true))
    if (!cena) return setFalhou(true)
    acordar.current = cena.retomar
    return cena.fim
  }, [])

  if (falhou) return <FundoArvore className={className} camada="w-full" />
  return (
    <div className={`pointer-events-none absolute ${className}`}>
      <canvas ref={ref} aria-hidden="true" className="cena-mascara size-full" />
      <button
        type="button"
        onClick={() => setParado(!parado)}
        className="pointer-events-auto absolute right-4 bottom-4 z-10 inline-flex motion-reduce:hidden size-11 items-center justify-center rounded-lg text-creme/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
      >
        <span className="sr-only">{t(parado ? "fundo.continuar" : "fundo.pausar")}</span>
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-5" fill="currentColor">
          {parado ? <path d="M8 5v14l11-7z" /> : <path d="M6 5h4v14H6zM14 5h4v14h-4z" />}
        </svg>
      </button>
    </div>
  )
}
