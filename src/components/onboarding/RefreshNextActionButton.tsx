"use client";

import { useRouter } from "next/navigation";

type RefreshNextActionButtonProps = {
  label: string;
  className?: string;
};

export function RefreshNextActionButton({
  label,
  className,
}: RefreshNextActionButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        router.refresh();
      }}
      className={className}
    >
      {label}
    </button>
  );
}
