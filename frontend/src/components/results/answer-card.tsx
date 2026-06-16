'use client';

import { Copy, FileText } from '@/components/icons';
import { ResultTable } from './result-table';
import { toast } from 'sonner';
import type { QueryResult } from '@/types';

interface AnswerCardProps {
  readonly result: QueryResult;
  readonly cached?: boolean;
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(columns: string[], rows: unknown[][]): string {
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined
      ? ''
      : typeof v === 'object'
        ? JSON.stringify(v)
        : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replaceAll('"', '""')}"`
      : s;
  };
  return [columns.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
}

function toJSON(columns: string[], rows: unknown[][]): string {
  return JSON.stringify(
    rows.map((r) => Object.fromEntries(columns.map((col, i) => [col, r[i]]))),
    null,
    2,
  );
}

export function AnswerCard({ result, cached }: AnswerCardProps) {
  const cols = result.columns ?? [];
  const rows = result.rows ?? [];

  function copyResult() {
    const header = cols.join('\t');
    const body = rows.map((r) => r.join('\t')).join('\n');
    navigator.clipboard.writeText(`${header}\n${body}`);
    toast.success('Result copied to clipboard');
  }

  function exportCSV() {
    downloadFile('simbo-result.csv', toCSV(cols, rows), 'text/csv');
    toast.success('Exported as CSV');
  }

  function exportJSON() {
    downloadFile('simbo-result.json', toJSON(cols, rows), 'application/json');
    toast.success('Exported as JSON');
  }

  return (
    <div className="overflow-hidden rounded-md border border-rule-2 bg-ink-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
        <div className="flex items-center gap-2.5 font-mono text-[11px]">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          <span className="text-paper-2">
            <b className="font-medium text-paper">{result.rowCount ?? rows.length}</b> rows,{' '}
            {cols.length} cols
          </span>
        </div>
        <span className="font-mono text-[10px] text-paper-3">
          {result.executionMs ?? 0}ms
        </span>
      </div>

      {/* Table */}
      <ResultTable result={result} maxRows={5} />

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-rule bg-ink-4 px-4 py-2.5">
        <span className="font-mono text-[10px] text-paper-3">
          {cached ? '◆ cached, 5m' : '◇ fresh result'}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Export CSV */}
          <button
            type="button"
            title="Export as CSV"
            onClick={exportCSV}
            className="flex items-center gap-1 rounded-sm border border-rule px-2 py-1 font-mono text-[9px] text-paper-3 transition-colors hover:border-rule-2 hover:text-paper"
          >
            <FileText size={10} />
            CSV
          </button>

          {/* Export JSON */}
          <button
            type="button"
            title="Export as JSON"
            onClick={exportJSON}
            className="flex items-center gap-1 rounded-sm border border-rule px-2 py-1 font-mono text-[9px] text-paper-3 transition-colors hover:border-rule-2 hover:text-paper"
          >
            <FileText size={10} />
            JSON
          </button>

          {/* Copy as TSV */}
          <button
            type="button"
            aria-label="Copy result as TSV"
            title="Copy as TSV"
            onClick={copyResult}
            className="grid h-7 w-7 place-items-center rounded-sm border border-rule text-paper-3 transition-colors hover:border-rule-2 hover:text-paper"
          >
            <Copy size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
