import type { ReactNode } from 'react';

function safeHref(value: string) {
  try {
    const url = new URL(value, 'https://support.invalid');
    return url.protocol === 'https:' || url.protocol === 'mailto:'
      ? value
      : null;
  } catch {
    return null;
  }
}

function inlineMarkdown(value: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^\)]+\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(value))) {
    if (match.index > cursor) nodes.push(value.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(<strong key={`strong-${key++}`}>{token.slice(2, -2)}</strong>);
    } else {
      const link = /^\[([^\]]+)\]\(([^\)]+)\)$/.exec(token);
      const href = link?.[2] ? safeHref(link[2]) : null;
      if (link && href) {
        nodes.push(
          <a
            className="font-semibold text-primary underline underline-offset-2"
            href={href}
            key={`link-${key++}`}
            rel="noreferrer"
            target="_blank"
          >
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }
    cursor = match.index + token.length;
  }
  if (cursor < value.length) nodes.push(value.slice(cursor));
  return nodes;
}

export function SafeMarkdown({ value }: { value: string }) {
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(
      <p className="m-0 leading-7" key={`paragraph-${blocks.length}`}>
        {inlineMarkdown(paragraph.join(' '))}
      </p>,
    );
    paragraph = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(
      <ul className="m-0 grid gap-2 pl-5" key={`list-${blocks.length}`}>
        {list.map((item, index) => (
          <li key={`${item}-${index}`}>{inlineMarkdown(item)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const line of lines) {
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const Heading = heading[1]?.length === 1 ? 'h2' : 'h3';
      blocks.push(
        <Heading className="m-0 text-lg font-semibold" key={`heading-${blocks.length}`}>
          {inlineMarkdown(heading[2] ?? '')}
        </Heading>,
      );
      continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1] ?? '');
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();

  return <div className="grid gap-4 text-sm text-foreground">{blocks}</div>;
}
