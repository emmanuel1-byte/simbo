'use client';

import { Copy } from '@/components/icons';
import { ResultTable } from './result-table';
import { toast } from 'sonner';
import type { QueryResult } from '@/types';

interface AnswerCardProps {
  readonly result: QueryResult;
  readonly cached?: boolean;
}

export function AnswerCard({ result, cached }: AnswerCardProps) {
  function copyResult() {
    const header = result.columns.join('\t');
    const rows = result.rows.map((r) => r.join('\t')).join('\n');
    navigator.clipboard.writeText(`${header}\n${rows}`);
    toast.success('Result copied to clipboard');
  }

  return (
    <div className="overflow-hidden rounded-md border border-rule-2 bg-ink-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
        <div className="flex items-center gap-2.5 font-mono text-[11px]">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          <span className="text-paper-2">
            <b className="font-medium text-paper">{result.rowCount ?? result.rows.length}</b> rows,{' '}
            {result.columns.length} cols
          </span>
        </div>
        <span className="font-mono text-[10px] text-paper-3">
          {result.executionMs ?? 0}ms
        </span>
      </div>

      {/* Table */}
      <ResultTable result={result} maxRows={5} />

      {/* Footer */}
      <div className="flex items-center border-t border-rule bg-ink-4 px-4 py-2.5">
        <span className="font-mono text-[10px] text-paper-3">
          {cached ? '◆ cached, 5m' : '◇ fresh result'}
        </span>
        <button
          type="button"
          aria-label="Copy result as TSV"
          title="Copy as TSV"
          onClick={copyResult}
          className="ml-auto grid h-7 w-7 place-items-center rounded-sm border border-rule text-paper-3 transition-colors hover:border-rule-2 hover:text-paper"
        >
          <Copy size={12} />
        </button>
      </div>
    </div>
  );
}
