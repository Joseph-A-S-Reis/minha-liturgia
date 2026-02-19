import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/app-url";

export default auth((request) => {
  const isAuthenticated = Boolean(request.auth);
  const appBaseUrl = getAppBaseUrl();
  const isDiaryRoute = request.nextUrl.pathname.startsWith("/diario");
  const isAuthPage = [
    "/entrar",
    "/cadastro",
    "/esqueci-senha",
    "/redefinir-senha",
    "/reenviar-verificacao",
  ].includes(request.nextUrl.pathname);

  if (isDiaryRoute && !isAuthenticated) {
    return Response.redirect(new URL("/entrar", appBaseUrl));
  }

  if (isAuthPage && isAuthenticated) {
    return Response.redirect(new URL("/inicio", appBaseUrl));
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
