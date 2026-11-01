import { useEffect, useRef, useState } from "react"
import { useT } from "../i18n"
import { FundoArvore } from "./FundoArvore"
import { gerar } from "./arvoreRede"

// Árvore de luz em WebGL puro (sem biblioteca): os mesmos fios e nós de arvoreRede.ts viram pontos com
// profundidade. Cresce uma vez, orbita devagar, inclina com o ponteiro e se dissolve com a rolagem.
// Plano focal passeia (bokeh fora de foco), pulsos de luz sobem da raiz às pontas e o cursor é uma fonte de luz.
// Sem WebGL: cai no SVG de FundoArvore.
const VERT = `attribute vec3 p;attribute vec4 a;
uniform float uT,uAsp,uPx,uTime,uScroll,uOff,uEsc,uFoco;uniform vec2 uPtr,uLuz;
varying vec4 vC;varying float vB;
float h(float n){return fract(sin(n)*43758.5453);}
void main(){
  float g=smoothstep(a.x,a.x+.05,uT);
  float tipo=a.z;
  bool poeira=tipo>2.5&&tipo<3.5;
  vec3 q=p;
  if(poeira){q.y=mod(q.y+1.+uTime*.05*(.4+a.w),2.)-1.;q.x+=sin(uTime*.3+a.w*20.)*.06;}
  q.x+=sin(uTime*.7+q.y*3.+a.w*6.28)*.006*(q.y+1.);
  vec3 dir=vec3(h(a.w*7.1)-.5,h(a.w*13.3)*.7,h(a.w*3.7)-.5);
  q+=dir*uScroll*uScroll*1.8;
  float r=uPtr.x*.3+uScroll*.35+sin(uTime*.08)*.1,c=cos(r),s=sin(r);
  q.xz=mat2(c,-s,s,c)*q.xz;
  q.x=q.x*uEsc+uOff;
  q.y=(q.y+1.)*uEsc-1.+uPtr.y*.08;
  float w=1.+q.z*.45;
  vec2 n=vec2(q.x*.98/uAsp,q.y*.98)/w;
  vec2 dv=(n-uLuz)*vec2(uAsp,1.);
  float dd=length(dv);
  float perto=1.-smoothstep(0.,.5,dd);
  n+=dv/max(dd,.05)*perto*.025;
  gl_Position=vec4(n,0.,1.);
  float des=min(1.,abs(q.z-uFoco)*1.3);
  float pul=tipo>2.5?0.:exp(-pow((a.x-fract(uTime*.07)*1.15+.1)*8.,2.));
  float pop=poeira?pow(max(0.,sin(uTime*1.7+a.w*60.)),40.):0.;
  float tam=a.y*uPx*g/w*(1.+des*1.2+pul*.8+pop*2.+perto*.6);
  gl_PointSize=min(180.,max(1.,tam));
  vB=des;
  float tw=tipo>.5?.65+.35*sin(uTime*1.6+a.w*40.):1.;
  vec3 col=tipo>1.5?vec3(.79,.64,.29):tipo>.5?vec3(.62,.71,.54):vec3(.96,.96,.94);
  float al=(poeira?.55:tipo>.5?1.:.7)*tw;
  if(tipo>3.5){col=vec3(1.,.88,.55);al=.14*pow(max(0.,sin(uTime*.5+a.w*20.)),3.);}
  col=mix(col,vec3(1.,.96,.85),min(1.,pul*.8+perto*.5));
  al=al*(1.+pul*1.2+pop*1.5+perto*.8)/(1.+des*des*3.);
  vC=vec4(col,al*g*(1.-uScroll*.9));
}`
// Raios de sol entre as copas (god rays) e o brilho do sol no canto: um triângulo de tela cheia, só gradiente; ciclos de ~18 s.
const VERT_R = `attribute vec2 q;varying vec2 v;void main(){v=q;gl_Position=vec4(q,0.,1.);}`
const FRAG_R = `precision mediump float;uniform float uTime,uAsp,uRoll;uniform vec2 uPtr;varying vec2 v;
void main(){
  vec2 p=vec2(v.x*uAsp,v.y);
  vec2 d=p-vec2(1.1*uAsp+uPtr.x*.3,1.5);
  float a=atan(d.x,-d.y);
  float f=sin(a*14.+sin(a*5.+uTime*.15)*1.6)*.5+.5;
  float g=sin(a*31.-uTime*.1)*.5+.5;
  float k=pow(f,4.)*(.6+.4*g)*(.55+.45*sin(uTime*.35+a*7.))*smoothstep(2.9,.2,length(d))*.5*mix(.6,1.,smoothstep(.8,1.4,uAsp));
  k=k*(.9+.1*sin(uTime*5.+a*9.))+exp(-length(d)*2.2)*.22*(.85+.15*sin(uTime*.9));
  k*=1.-uRoll*.8;
  gl_FragColor=vec4(vec3(1.,.86,.5)*k,k);}`
// Em foco: brilho macio. Fora de foco (vB→1): disco de bokeh, mais chapado.
const FRAG = `precision mediump float;varying vec4 vC;varying float vB;
void main(){float d=length(gl_PointCoord-.5);float k=1.-smoothstep(mix(.05,.3,vB),.5,d);gl_FragColor=vec4(vC.rgb*vC.a*k,k*vC.a);}`

const PROF = 7
const pontos = () => {
  const { fios, nos } = gerar()
  const dados: number[] = []
  const X = (x: number) => (x - 200) / 250
  const Y = (y: number) => 1 - y / 300
  for (const f of fios) {
    const [x0, y0, cx, cy, x1, y1] = f.d.match(/-?\d+(\.\d+)?/g)!.map(Number)
    const n = Math.max(8, Math.round(Math.hypot(x1 - x0, y1 - y0) / 1.15))
    const z = (Math.random() - 0.5) * 0.7
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const u = 1 - t
      const x = u * u * x0 + 2 * u * t * cx + t * t * x1
      const y = u * u * y0 + 2 * u * t * cy + t * t * y1
      const e = f.larg * 0.02
      dados.push(X(x) + (Math.random() - 0.5) * e, Y(y) + (Math.random() - 0.5) * e, z + (Math.random() - 0.5) * 0.04, ((f.prof + t) / PROF) * 0.9, 1.6 + f.larg * 0.55, 0, Math.random())
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
  for (let i = 0; i < 260; i++) dados.push((Math.random() - 0.5) * 1.8, Math.random() * 2 - 1, (Math.random() - 0.5) * 1.2, 0.85, 2 + Math.random() * 3, 3, Math.random())
  for (const n of nos) dados.push(X(n.x), Y(n.y), (Math.random() - 0.5) * 0.7, ((n.prof + 1) / PROF) * 0.9, n.r * 3.4, n.ouro ? 2 : 1, Math.random())
  for (let i = 0; i < 14; i++) dados.push(Math.random() * 1.4 - 0.5, Math.random() * 1.2 - 0.5, (Math.random() - 0.5) * 0.8, 0.9, 30 + Math.random() * 40, 4, Math.random())
  return new Float32Array(dados)
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
  const compila = (v: string, f: string) => {
    const o = gl.createProgram()!
    gl.attachShader(o, sh(gl.VERTEX_SHADER, v))
    gl.attachShader(o, sh(gl.FRAGMENT_SHADER, f))
    gl.bindAttribLocation(o, 2, "q")
    gl.linkProgram(o)
    return gl.getProgramParameter(o, gl.LINK_STATUS) ? o : null
  }
  const raios = compila(VERT_R, FRAG_R)
  if (!raios) return null
  const bufR = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, bufR)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const ur = (n: string) => gl.getUniformLocation(raios, n)
  const [rTime, rAsp, rRoll, rPtr] = ["uTime", "uAsp", "uRoll", "uPtr"].map(ur)
  gl.useProgram(prog)
  const dados = pontos()
  const bufP = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, bufP)
  gl.bufferData(gl.ARRAY_BUFFER, dados, gl.STATIC_DRAW)
  const liga = (nome: string, tam: number, desl: number) => {
    const l = gl.getAttribLocation(prog, nome)
    gl.enableVertexAttribArray(l)
    gl.vertexAttribPointer(l, tam, gl.FLOAT, false, 28, desl * 4)
  }
  liga("p", 3, 0)
  liga("a", 4, 3)
  const u = (n: string) => gl.getUniformLocation(prog, n)
  const [uT, uAsp, uPx, uTime, uScroll, uPtr, uOff, uEsc, uFoco, uLuz] = ["uT", "uAsp", "uPx", "uTime", "uScroll", "uPtr", "uOff", "uEsc", "uFoco", "uLuz"].map(u)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE)
  gl.clearColor(0, 0, 0, 0)

  const alvo = { x: 0, y: 0 }
  const atual = { x: 0, y: 0 }
  const luzAlvo = { x: 9, y: 9 } // fora da tela até o ponteiro entrar
  const luz = { x: 9, y: 9 }
  let raf = 0
  let ini = 0
  let tempo = 0
  let visivel = true
  let asp = 1
  let rolagem = 0
  const medir = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    gl.viewport(0, 0, canvas.width, canvas.height)
    asp = width / Math.max(height, 1)
    gl.useProgram(prog)
    gl.uniform1f(uAsp, asp)
    gl.uniform1f(uPx, dpr)
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
      luz.x += (luzAlvo.x - luz.x) * 0.1
      luz.y += (luzAlvo.y - luz.y) * 0.1
      const r = canvas.getBoundingClientRect()
      rolagem = Math.min(1, Math.max(0, -r.top / Math.max(r.height, 1)))
    }
    const cresce = reduzido ? 1 : Math.min(1, tempo / 3.6)
    const roll = reduzido ? 0 : rolagem
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(raios)
    gl.bindBuffer(gl.ARRAY_BUFFER, bufR)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0)
    gl.uniform1f(rTime, reduzido ? 0 : tempo % (40 * Math.PI))
    gl.uniform1f(rAsp, asp)
    gl.uniform1f(rRoll, roll)
    gl.uniform2f(rPtr, atual.x, atual.y)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.useProgram(prog)
    gl.bindBuffer(gl.ARRAY_BUFFER, bufP)
    gl.disableVertexAttribArray(2)
    liga("p", 3, 0)
    liga("a", 4, 3)
    gl.uniform1f(uT, 1 - (1 - cresce) ** 3)
    gl.uniform1f(uTime, reduzido ? 0 : tempo)
    gl.uniform1f(uScroll, roll)
    gl.uniform2f(uPtr, atual.x, atual.y)
    gl.uniform2f(uLuz, luz.x, luz.y)
    gl.uniform1f(uFoco, reduzido ? 0 : Math.sin(tempo * 0.1) * 0.3)
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
    const r = canvas.getBoundingClientRect()
    luzAlvo.x = ((e.clientX - r.left) / Math.max(r.width, 1)) * 2 - 1
    luzAlvo.y = 1 - ((e.clientY - r.top) / Math.max(r.height, 1)) * 2
    retomar()
  }
  const saiu = () => {
    luzAlvo.x = luzAlvo.y = 9
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
    else retomar() // um quadro mesmo pausado: redimensionar apaga o canvas
  })
  ro.observe(canvas)
  medir()
  if (!reduzido) {
    addEventListener("pointermove", ponteiro, { passive: true })
    document.addEventListener("mouseleave", saiu)
  }
  document.addEventListener("visibilitychange", retomar)
  raf = requestAnimationFrame(quadro)
  const fim = () => {
    cancelAnimationFrame(raf)
    canvas.removeEventListener("webglcontextlost", perdeu)
    io.disconnect()
    ro.disconnect()
    removeEventListener("pointermove", ponteiro)
    document.removeEventListener("mouseleave", saiu)
    document.removeEventListener("visibilitychange", retomar)
    gl.deleteProgram(prog)
    gl.deleteProgram(raios)
    gl.deleteBuffer(bufP)
    gl.deleteBuffer(bufR)
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
