"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

type InteractiveSubmitButtonProps = {
  idleLabel: ReactNode;
  pendingLabel?: ReactNode;
  className?: string;
  pendingClassName?: string;
  disabled?: boolean;
  showSpinner?: boolean;
  confirmMessage?: string;
  form?: string;
  optimisticPendingOnClick?: boolean;
};

export function InteractiveSubmitButton({
  idleLabel,
  pendingLabel,
  className,
  pendingClassName,
  disabled = false,
  showSpinner = true,
  confirmMessage,
  form,
  optimisticPendingOnClick = false,
}: InteractiveSubmitButtonProps) {
  const { pending } = useFormStatus();
  const [optimisticPending, setOptimisticPending] = useState(false);
  const isPending = pending || optimisticPending;

  useEffect(() => {
    if (!pending && optimisticPending) {
      setOptimisticPending(false);
    }
  }, [pending, optimisticPending]);

  return (
    <button
      type="submit"
      form={form}
      disabled={disabled || isPending}
      onClick={(event) => {
        if (!confirmMessage) {
          if (optimisticPendingOnClick) {
            setOptimisticPending(true);
          }
          return;
        }

        const confirmed = window.confirm(confirmMessage);
        if (!confirmed) {
          event.preventDefault();
          return;
        }

        if (optimisticPendingOnClick) {
          setOptimisticPending(true);
        }
      }}
      className={`${className ?? ""} ${isPending ? (pendingClassName ?? "") : ""}`.trim()}
    >
      {isPending && showSpinner ? (
        <span aria-hidden="true" className="inline-flex items-center">
          <svg className="mr-1 size-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" className="stroke-current/25" strokeWidth="3" />
            <path
              d="M12 3a9 9 0 0 1 9 9"
              className="stroke-current"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </span>
      ) : null}
      {isPending ? (pendingLabel ?? idleLabel) : idleLabel}
    </button>
  );
}
