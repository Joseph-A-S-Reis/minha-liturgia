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
  alreadyExists?: boolean;
  warningCode?: string;
  warnings?: string[];
  processingScheduled?: boolean;
};

type AssetKind = "pdf" | "docx" | "epub";

function getAllowedKindsByResourceType(resourceType: string): AssetKind[] {
  switch (resourceType) {
    case "article":
      return [];
    case "book":
    case "document":
      return ["pdf", "docx", "epub"];
    default:
      return [];
  }
}

function acceptFromKinds(kinds: AssetKind[]): string {
  const map: Record<AssetKind, string[]> = {
    pdf: ["application/pdf", ".pdf"],
    docx: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".docx",
    ],
    epub: ["application/epub+zip", ".epub"],
  };

  return kinds.flatMap((kind) => map[kind]).join(",");
}

function describeKinds(kinds: AssetKind[]) {
  const labelMap: Record<AssetKind, string> = {
    pdf: "PDF",
    docx: "DOCX",
    epub: "EPUB",
  };

  return kinds.map((kind) => labelMap[kind]).join(", ");
}

function detectKindFromMime(file: File): AssetKind | null {
  const fileName = file.name.toLowerCase();

  if (file.type === "application/pdf") {
    return "pdf";
  }

  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.endsWith(".docx")
  ) {
    return "docx";
  }

  if (file.type === "application/epub+zip" || fileName.endsWith(".epub")) {
    return "epub";
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
      setStatus("Formatos suportados: PDF, DOCX e EPUB.");
      return;
    }

    if (allowedKinds.length === 0) {
      setStatus(`Este conteúdo (${resourceType}) não aceita upload de arquivo.`);
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

    if (uploadPayload.alreadyExists) {
      setStatus("Este arquivo já existe no Cloud Storage para este conteúdo. Reutilizando publicação existente.");
      router.refresh();
      return;
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
