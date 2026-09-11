import type { ReactNode } from "react";

export function HudPanel({
  title,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`flex min-h-0 flex-col bg-hive-bg ${className}`}>
      {title ? (
        <header className="border-b border-hive-line px-4 py-3 font-serif text-lg text-hive-paper">{title}</header>
      ) : null}
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
