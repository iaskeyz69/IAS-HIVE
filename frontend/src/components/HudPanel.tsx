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
    <section
      className={`hud-corners flex min-h-0 flex-col border border-hive-line bg-hive-panel/90 ${className}`}
    >
      <span className="c-br" />
      <span className="c-bl" />
      {title ? (
        <header className="label-hud border-b border-hive-line px-3 py-2 text-hive-gold">{title}</header>
      ) : null}
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
