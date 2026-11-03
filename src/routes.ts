import { index, type RouteConfig, route } from "@react-router/dev/routes"

export default [
  // A raiz "/" também é o app (redireciona para /{idioma}): o splat "*" sozinho não a casa no modo framework
  // (a home ficava em branco). id próprio porque o arquivo é o mesmo do splat.
  index("rotas/spa.tsx", { id: "spa-raiz" }),
  // Todo o resto é o app atual (login, perfil...), como SPA.
  route("*", "rotas/spa.tsx"),
] satisfies RouteConfig
