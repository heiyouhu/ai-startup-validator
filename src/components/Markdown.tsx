import React from "react";

interface MarkdownProps {
  content: string;
  className?: string;
}

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|\`([^\`]+)\`|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2]) {
      nodes.push(<strong key={`${keyBase}-b-${i}`}>{m[2]}</strong>);
    } else if (m[3]) {
      nodes.push(
        <code key={`${keyBase}-c-${i}`}>{m[3]}</code>
      );
    } else if (m[4] && m[5]) {
      nodes.push(
        <a key={`${keyBase}-a-${i}`} href={m[5]} target="_blank" rel="noopener noreferrer">
          {m[4]}
        </a>
      );
    }
    last = regex.lastIndex;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ content, className }: MarkdownProps) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!list) return;
    const items = list.items;
    const ordered = list.ordered;
    blocks.push(
      ordered ? (
        <ol key={`ol-${key++}`}>
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `ol-${key}-${idx}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={`ul-${key++}`}>
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `ul-${key}-${idx}`)}</li>
          ))}
        </ul>
      )
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushList();
      const level = h[1].length;
      const content = h[2];
      if (level === 1) blocks.push(<h1 key={`h-${key++}`}>{renderInline(content, `h1-${key}`)}</h1>);
      else if (level === 2) blocks.push(<h2 key={`h-${key++}`}>{renderInline(content, `h2-${key}`)}</h2>);
      else blocks.push(<h3 key={`h-${key++}`}>{renderInline(content, `h3-${key}`)}</h3>);
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      flushList();
      blocks.push(<hr key={`hr-${key++}`} />);
      continue;
    }
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ol[1]);
      continue;
    }
    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(ul[1]);
      continue;
    }
    flushList();
    blocks.push(<p key={`p-${key++}`}>{renderInline(line, `p-${key}`)}</p>);
  }
  flushList();

  return <div className={`report-prose ${className ?? ""}`}>{blocks}</div>;
}
