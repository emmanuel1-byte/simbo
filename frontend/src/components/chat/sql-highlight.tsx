import { Fragment } from 'react';

const KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'ORDER', 'LIMIT', 'OFFSET',
  'AS', 'AND', 'OR', 'NOT', 'IN', 'ON', 'JOIN', 'LEFT', 'RIGHT', 'INNER',
  'OUTER', 'FULL', 'CROSS', 'HAVING', 'UNION', 'ALL', 'DISTINCT', 'CASE',
  'WHEN', 'THEN', 'ELSE', 'END', 'INTERVAL', 'WITH', 'IS', 'NULL', 'BETWEEN',
  'LIKE', 'ILIKE', 'ASC', 'DESC',
]);

const FUNCTIONS = new Set([
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'NOW', 'DATE_TRUNC', 'EXTRACT',
  'COALESCE', 'CAST', 'TO_CHAR', 'TO_DATE', 'LOWER', 'UPPER', 'TRIM',
]);

interface SqlHighlightProps {
  code: string;
}

/**
 * Tiny SQL syntax highlighter. Splits on whitespace + symbols and colors tokens.
 * Good enough for read-only display; use a real parser for editing.
 */
export function SqlHighlight({ code }: SqlHighlightProps) {
  const lines = code.split('\n');
  return (
    <pre className="m-0 overflow-auto px-5 py-4 font-mono text-[12.5px] leading-[1.7] text-paper">
      {lines.map((line, i) => (
        <Fragment key={i}>
          {tokenize(line)}
          {'\n'}
        </Fragment>
      ))}
    </pre>
  );
}

function tokenize(line: string) {
  // Comment line
  if (line.trim().startsWith('--')) {
    return <span className="sql-cm">{line}</span>;
  }
  // Tokenize, preserving delimiters
  const parts = line.split(/(\s+|[(),;])/g);
  return parts.map((part, idx) => {
    if (!part) return null;
    const upper = part.toUpperCase();
    if (KEYWORDS.has(upper)) {
      return (
        <span key={idx} className="sql-kw">
          {part}
        </span>
      );
    }
    if (FUNCTIONS.has(upper)) {
      return (
        <span key={idx} className="sql-fn">
          {part}
        </span>
      );
    }
    if (/^'[^']*'$/.test(part)) {
      return (
        <span key={idx} className="sql-str">
          {part}
        </span>
      );
    }
    if (/^\d+$/.test(part)) {
      return (
        <span key={idx} className="sql-num">
          {part}
        </span>
      );
    }
    return <Fragment key={idx}>{part}</Fragment>;
  });
}
