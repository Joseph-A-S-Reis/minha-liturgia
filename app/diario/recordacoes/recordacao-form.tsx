"use client";

import Link from "next/link";
import { useActionState } from "react";
import { InteractiveSubmitButton } from "@/app/components/interactive-submit-button";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { deleteJournalMemoryAttachmentAction } from "./actions";
import type { JournalMemoryView } from "./actions";

export type RecordacaoFormState = {
  success: boolean;
  message: string;
};

const initialState: RecordacaoFormState = {
  success: false,
  message: "",
};

type RecordacaoFormProps = {
  mode: "create" | "edit";
  submitAction: (
    previousState: RecordacaoFormState,
    formData: FormData,
  ) => Promise<RecordacaoFormState>;
  memory?: JournalMemoryView;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function RecordacaoForm({ mode, submitAction, memory }: RecordacaoFormProps) {
  const [state, action] = useActionState(submitAction, initialState);

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      {mode === "edit" && memory ? <input type="hidden" name="memoryId" value={memory.id} /> : null}

      <div className="space-y-1">
        <label htmlFor="memory-title" className="text-sm font-medium text-zinc-700">
          Nome da recordação
        </label>
        <input
          id="memory-title"
          name="title"
          required
          defaultValue={memory?.title ?? ""}
          maxLength={120}
          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-500 transition focus:ring"
          placeholder="Ex.: Batismo, Primeira Eucaristia, Crisma..."
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="memory-date" className="text-sm font-medium text-zinc-700">
          Data da recordação
        </label>
        <input
          id="memory-date"
          name="memoryDate"
          type="date"
          required
          defaultValue={memory?.memoryDate ?? ""}
          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-500 transition focus:ring"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="memory-description" className="text-sm font-medium text-zinc-700">
          Descrição
        </label>
        <textarea
          id="memory-description"
          name="description"
          required
          defaultValue={memory?.description ?? ""}
          maxLength={8000}
          className="h-40 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-500 transition focus:ring"
          placeholder="Descreva esse momento especial para você..."
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="memory-attachments" className="text-sm font-medium text-zinc-700">
          Anexos (JPG, PNG, WEBP, PDF, DOCX)
        </label>
        <input
          id="memory-attachments"
          name="attachments"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.jpg,.jpeg,.png,.webp,.pdf,.docx"
          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
        />
        <p className="text-xs text-zinc-500">
          Limites: até 5 imagens por recordação (máx. 5MB cada). PDF e DOCX também são aceitos.
        </p>
      </div>

      {mode === "edit" && memory && memory.attachments.length > 0 ? (
        <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <h2 className="text-sm font-semibold text-zinc-800">Anexos atuais</h2>
          <ul className="mt-2 space-y-2">
            {memory.attachments.map((attachment) => (
              <li key={attachment.id} className="rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/api/diario/recordacoes/anexos/${attachment.id}`}
                    target="_blank"
                    className="font-medium text-sky-700 hover:underline"
                  >
                    {attachment.fileName}
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">{formatBytes(attachment.fileSize)}</span>
                    <form action={deleteJournalMemoryAttachmentAction}>
                      <input type="hidden" name="memoryId" value={memory.id} />
                      <input type="hidden" name="attachmentId" value={attachment.id} />
                      <ConfirmSubmitButton
                        label="Excluir anexo"
                        confirmMessage="Deseja excluir este anexo agora?"
                        className="inline-flex rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                      />
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <InteractiveSubmitButton
          idleLabel={mode === "create" ? "Salvar recordação" : "Salvar alterações"}
          pendingLabel="Salvando..."
          className="inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          pendingClassName="bg-emerald-500"
        />
        <Link
          href="/diario/recordacoes"
          className="inline-flex rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
        >
          Cancelar
        </Link>
      </div>

      {state.message ? (
        <p className={`text-sm ${state.success ? "text-emerald-700" : "text-red-600"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
