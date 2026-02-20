"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  resourceId: string;
  resourceType: string;
};

type SignUploadResponse = {
  ok: boolean;
  assetId: string;
  warningCode?: string;
  warnings?: string[];
  processingScheduled?: boolean;
};

type AssetKind = "pdf" | "image" | "video" | "audio" | "html";

function getAllowedKindsByResourceType(resourceType: string): AssetKind[] {
  switch (resourceType) {
    case "html":
      return ["html"];
    case "document":
      return ["pdf"];
    case "audio":
      return ["audio"];
    case "video":
      return ["video"];
    case "book":
      return ["pdf", "html", "image", "audio", "video"];
    case "article":
      return ["html", "pdf", "image", "video", "audio"];
    default:
      return ["html", "pdf", "image", "video", "audio"];
  }
}

function acceptFromKinds(kinds: AssetKind[]): string {
  const map: Record<AssetKind, string[]> = {
    html: [".html", ".htm", "text/html"],
    pdf: ["application/pdf", ".pdf"],
    image: ["image/*"],
    video: ["video/*"],
    audio: ["audio/*"],
  };

  return kinds.flatMap((kind) => map[kind]).join(",");
}

function describeKinds(kinds: AssetKind[]) {
  const labelMap: Record<AssetKind, string> = {
    html: "HTML",
    pdf: "PDF",
    image: "imagem",
    video: "vídeo",
    audio: "áudio",
  };

  return kinds.map((kind) => labelMap[kind]).join(", ");
}

function detectKindFromMime(file: File): AssetKind | null {
  const fileName = file.name.toLowerCase();

  if (file.type === "text/html" || fileName.endsWith(".html") || fileName.endsWith(".htm")) {
    return "html";
  }

  if (file.type === "application/pdf") {
    return "pdf";
  }

  if (file.type.startsWith("image/")) {
    return "image";
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  if (file.type.startsWith("audio/")) {
    return "audio";
  }

  return null;
}

export function UploadAssetClient({ resourceId, resourceType }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const allowedKinds = getAllowedKindsByResourceType(resourceType);
  const accept = acceptFromKinds(allowedKinds);

  async function uploadFile(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File)) {
      setStatus("Selecione um arquivo válido.");
      return;
    }

    const safeKind = detectKindFromMime(file);
    if (!safeKind) {
      setStatus(
        "Formatos suportados: HTML, PDF, imagem, vídeo e áudio. Para HTML, use arquivos .html ou .htm.",
      );
      return;
    }

    if (!allowedKinds.includes(safeKind)) {
      setStatus(
        `Este conteúdo (${resourceType}) aceita apenas: ${describeKinds(allowedKinds)}.`,
      );
      return;
    }

    setStatus("Enviando arquivo...");

    const payload = new FormData();
    payload.append("resourceId", resourceId);
    payload.append("file", file);

    const uploadResponse = await fetch("/api/biblioteca/assets/direct-upload", {
      method: "POST",
      body: payload,
    });

    if (!uploadResponse.ok) {
      const err = await uploadResponse.json().catch(() => ({}));
      const parts = [err?.error, err?.code ? `(${String(err.code)})` : null, err?.details]
        .filter(Boolean)
        .map(String);
      throw new Error(parts.join(" ") || "Falha ao enviar arquivo.");
    }

    const uploadPayload = (await uploadResponse.json()) as SignUploadResponse;
    if (!uploadPayload.ok || !uploadPayload.assetId) {
      throw new Error("Não foi possível confirmar o upload do arquivo.");
    }

    if (uploadPayload.warningCode && Array.isArray(uploadPayload.warnings) && uploadPayload.warnings.length > 0) {
      setStatus(
        `Upload concluído com avisos (${uploadPayload.warningCode}): ${uploadPayload.warnings.join(" | ")}`,
      );
      router.refresh();
      return;
    }

    setStatus("Upload concluído com sucesso! Arquivo confirmado e disponível para publicação.");
    router.refresh();
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const formElement = event.currentTarget;
        const formData = new FormData(formElement);

        startTransition(async () => {
          try {
            await uploadFile(formData);
            formElement.reset();
          } catch (error) {
            setStatus(error instanceof Error ? error.message : "Falha inesperada no upload.");
          }
        });
      }}
    >
      <label className="block text-sm font-medium text-zinc-700" htmlFor="library-file-upload">
        Arquivo
      </label>
      <input
        id="library-file-upload"
        name="file"
        type="file"
        accept={accept}
        required
        className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
      />

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Enviando..." : "Enviar arquivo"}
      </button>

      {status ? <p className="text-xs font-medium text-zinc-600">{status}</p> : null}
    </form>
  );
}
