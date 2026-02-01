import type { ReactNode } from "react";

type MaxWidthProps = {
  children: ReactNode;
  className?: string;
};

export function MaxWidth({ children, className }: MaxWidthProps) {
  return (
    <div
      className={`mx-auto w-full max-w-6xl px-6 sm:px-8 ${className ?? ""}`.trim()}
    >
      {children}
    </div>
  );
}
