"use client";

import Image from "next/image";
import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/app/auth-actions";
import { InteractiveSubmitButton } from "@/app/components/interactive-submit-button";
import { LogoutButton } from "@/app/components/logout-button";
import {
  type AccountSettingsActionState,
  updateCommunityProfileAction,
  updateDevotionProfileAction,
  updatePublicProfileAction,
} from "./actions";

const initialState: AccountSettingsActionState = {
  success: false,
  message: "",
};

type AccountSettingsFormsProps = {
  user: {
    name: string | null;
    email: string;
    image: string | null;
    emailVerified: Date | null;
    hasPassword: boolean;
    devotionSaint: string | null;
    communityName: string | null;
  };
};

function AccountAvatar({ imageUrl, name }: { imageUrl: string | null; name: string | null }) {
  const fallback = (name?.trim().charAt(0) || "M").toUpperCase();

  if (!imageUrl) {
    return (
      <div className="flex size-20 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-xl font-semibold text-emerald-700">
        {fallback}
      </div>
    );
  }

  return (
    <Image
      src={imageUrl}
      alt={`Foto de perfil de ${name ?? "usuário"}`}
      width={80}
      height={80}
      unoptimized
      className="size-20 rounded-full border border-zinc-200 bg-zinc-100 object-cover shadow-sm"
    />
  );
}

export function AccountSettingsForms({ user }: AccountSettingsFormsProps) {
  const [accountState, accountAction, isSendingReset] = useActionState(
    requestPasswordResetAction,
    initialState,
  );
  const [personalState, personalAction, isSavingPersonal] = useActionState(
    updatePublicProfileAction,
    initialState,
  );
  const [devotionState, devotionAction, isSavingDevotion] = useActionState(
    updateDevotionProfileAction,
    initialState,
  );
  const [communityState, communityAction, isSavingCommunity] = useActionState(
    updateCommunityProfileAction,
    initialState,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.image);

  const emailVerificationLabel = user.emailVerified ? "E-mail verificado" : "Verificação pendente";
  const emailVerificationClassName = user.emailVerified
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";

  const accountHint = user.hasPassword
    ? "A senha atual não é exibida por segurança. Você pode solicitar um novo link de redefinição a qualquer momento."
    : "Sua conta ainda não possui senha por credenciais cadastrada. Ao solicitar redefinição, enviaremos um link para criar uma nova senha.";

  const avatarCaption = useMemo(() => {
    if (!previewUrl && !user.image) {
      return "Nenhuma foto enviada ainda.";
    }

    if (previewUrl && previewUrl !== user.image) {
      return "Pré-visualização da nova foto selecionada.";
    }

    return "Foto de perfil atual.";
  }, [previewUrl, user.image]);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-2">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Dados da conta
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-900">Acesso e segurança</h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-600">
              Seu e-mail é a chave da casa. Nesta etapa, ele fica somente para consulta enquanto a redefinição de senha já funciona por link seguro.
            </p>
          </div>
          <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${emailVerificationClassName}`}>
            {emailVerificationLabel}
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">E-mail</p>
            <p className="mt-2 text-sm font-medium text-zinc-900">{user.email}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Senha</p>
            <p className="mt-2 text-sm font-medium text-zinc-900">
              {user.hasPassword ? "Protegida por credenciais" : "Ainda não configurada"}
            </p>
            <p className="mt-2 text-xs text-zinc-500">{accountHint}</p>
          </div>
        </div>

        <form action={accountAction} className="mt-5 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <input type="hidden" name="email" value={user.email} />
          <div>
            <p className="text-sm font-medium text-zinc-900">Redefinir senha</p>
            <p className="text-xs text-zinc-500">
              Enviaremos um link de redefinição para o e-mail cadastrado. Sem sustos, sem senha em texto puro e sem exorcismo no banco.
            </p>
          </div>
          <InteractiveSubmitButton
            idleLabel="Enviar link de redefinição"
            pendingLabel="Enviando..."
            disabled={isSendingReset}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
            pendingClassName="bg-emerald-600"
          />
        </form>

        {accountState.message ? (
          <p className={`mt-3 text-sm ${accountState.success ? "text-emerald-700" : "text-red-600"}`}>
            {accountState.message}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Dados pessoais
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-900">Nome público e foto</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Estes dados aparecem em contextos públicos do app, como sua identificação visual em interações futuras.
          </p>
        </div>

        <form action={personalAction} className="mt-5 space-y-4">
          <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:flex-row sm:items-center">
            <AccountAvatar imageUrl={previewUrl} name={user.name} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-900">Foto de perfil</p>
              <p className="mt-1 text-xs text-zinc-500">{avatarCaption}</p>
              <label htmlFor="account-image" className="mt-3 block text-sm font-medium text-zinc-700">
                Escolher nova foto
              </label>
              <input
                id="account-image"
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                disabled={isSavingPersonal}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    setPreviewUrl(user.image);
                    return;
                  }

                  const objectUrl = URL.createObjectURL(file);
                  setPreviewUrl((current) => {
                    if (current?.startsWith("blob:")) {
                      URL.revokeObjectURL(current);
                    }
                    return objectUrl;
                  });
                }}
                className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 outline-none ring-emerald-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70"
              />
              <p className="mt-2 text-xs text-zinc-500">Formatos aceitos: JPG, PNG ou WEBP com até 5MB.</p>
            </div>
          </div>

          <div>
            <label htmlFor="account-name" className="block text-sm font-medium text-zinc-700">
              Nome público
            </label>
            <input
              id="account-name"
              name="name"
              type="text"
              required
              minLength={2}
              maxLength={120}
              defaultValue={user.name ?? ""}
              disabled={isSavingPersonal}
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70"
              placeholder="Como você deseja ser identificado(a)?"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <InteractiveSubmitButton
              idleLabel="Salvar dados pessoais"
              pendingLabel="Salvando..."
              disabled={isSavingPersonal}
              className="inline-flex items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
              pendingClassName="bg-emerald-600"
            />
          </div>

          {personalState.message ? (
            <p className={`text-sm ${personalState.success ? "text-emerald-700" : "text-red-600"}`}>
              {personalState.message}
            </p>
          ) : null}
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Devoção
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-900">Identidade devocional</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Um espaço simples para registrar o santo de devoção que acompanha sua caminhada espiritual.
          </p>
        </div>

        <form action={devotionAction} className="mt-5 space-y-4">
          <div>
            <label htmlFor="devotion-saint" className="block text-sm font-medium text-zinc-700">
              Santo de devoção
            </label>
            <input
              id="devotion-saint"
              name="devotionSaint"
              type="text"
              maxLength={120}
              defaultValue={user.devotionSaint ?? ""}
              disabled={isSavingDevotion}
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70"
              placeholder="Ex.: Nossa Senhora Aparecida, São José, Santa Teresinha..."
            />
          </div>

          <InteractiveSubmitButton
            idleLabel="Salvar devoção"
            pendingLabel="Salvando..."
            disabled={isSavingDevotion}
            className="inline-flex items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
            pendingClassName="bg-emerald-600"
          />

          {devotionState.message ? (
            <p className={`text-sm ${devotionState.success ? "text-emerald-700" : "text-red-600"}`}>
              {devotionState.message}
            </p>
          ) : null}
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Comunidade
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-900">Paróquia, fraternidade ou instituição</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Registre a comunidade com a qual você comunga ou presta devoção. Nesta V1, o campo é livre e objetivo.
          </p>
        </div>

        <form action={communityAction} className="mt-5 space-y-4">
          <div>
            <label htmlFor="community-name" className="block text-sm font-medium text-zinc-700">
              Nome da comunidade
            </label>
            <input
              id="community-name"
              name="communityName"
              type="text"
              maxLength={160}
              defaultValue={user.communityName ?? ""}
              disabled={isSavingCommunity}
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70"
              placeholder="Ex.: Paróquia São José, Comunidade Shalom, Fraternidade X..."
            />
          </div>

          <InteractiveSubmitButton
            idleLabel="Salvar comunidade"
            pendingLabel="Salvando..."
            disabled={isSavingCommunity}
            className="inline-flex items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
            pendingClassName="bg-emerald-600"
          />

          {communityState.message ? (
            <p className={`text-sm ${communityState.success ? "text-emerald-700" : "text-red-600"}`}>
              {communityState.message}
            </p>
          ) : null}
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-2">
        <p className="text-sm text-zinc-700">
          Precisa voltar para sua rotina espiritual? Você pode continuar de onde parou ou sair da conta sem drama litúrgico.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/inicio"
            className="inline-flex items-center rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
          >
            Voltar ao início
          </Link>
          <LogoutButton />
        </div>
      </section>
    </div>
  );
}
