import { auth } from "@/auth";

export default auth((request) => {
  const isAuthenticated = Boolean(request.auth);
  const isDiaryRoute = request.nextUrl.pathname.startsWith("/diario");
  const isAuthPage = [
    "/entrar",
    "/cadastro",
    "/esqueci-senha",
    "/redefinir-senha",
    "/reenviar-verificacao",
  ].includes(request.nextUrl.pathname);

  if (isDiaryRoute && !isAuthenticated) {
    return Response.redirect(new URL("/entrar", request.nextUrl));
  }

  if (isAuthPage && isAuthenticated) {
    return Response.redirect(new URL("/inicio", request.nextUrl));
  }

  return undefined;
});

export const config = {
  matcher: [
    "/diario/:path*",
    "/entrar",
    "/cadastro",
    "/esqueci-senha",
    "/redefinir-senha",
    "/reenviar-verificacao",
  ],
};
