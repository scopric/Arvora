import { type RouteConfig, route } from "@react-router/dev/routes"

export default [
  route(":lang/hall-of-fame", "rotas/hall-of-fame.tsx"),
  route(":lang/hall-of-fame/:edicao/:slug", "rotas/premiado.tsx"),
  // Todo o resto é o app atual (login, perfil...), como SPA.
  route("*", "rotas/spa.tsx"),
] satisfies RouteConfig
