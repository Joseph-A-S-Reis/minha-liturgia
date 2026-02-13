import Link from "next/link";
import { consumeEmailVerificationToken } from "@/lib/account-security";

type VerifyEmailPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerificarEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = await searchParams;
  const token = params.token;

  const result = token ? await consumeEmailVerificationToken(token) : { success: false as const };

  return (
    <main className="flex min-h-screen w-full flex-col justify-center gap-6 px-6 py-10">
      <header>
        <h1 className="text-3xl font-bold text-zinc-900">Verificação de e-mail</h1>
      </header>

      <section
        className={`rounded-2xl border p-4 text-sm ${
          result.success
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700"
        }`}
      >
        {result.success
          ? "E-mail verificado com sucesso! Agora você já pode entrar."
          : "Token inválido ou expirado. Solicite um novo link de verificação."}
      </section>

      <p className="text-sm text-zinc-600">
        {result.success ? "Continuar para" : "Você pode"}{" "}
        <Link href={result.success ? "/entrar" : "/reenviar-verificacao"} className="font-semibold text-emerald-700 hover:text-emerald-800">
          {result.success ? "login" : "reenviar verificação"}
        </Link>
      </p>
    </main>
  );
}
