import type { ReactNode } from 'react';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-5 border-b pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-[var(--reading-width)]">
        {eyebrow ? (
          <p className="mb-3 mt-0 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="m-0 text-3xl font-semibold leading-[1.1] tracking-[-0.035em] text-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="mb-0 mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
