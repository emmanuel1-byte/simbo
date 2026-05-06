'use client';

import { Bookmark, Copy, FileText, TrendingUp } from '@/components/icons';
import { ResultTable } from './result-table';
import { toast } from 'sonner';
import type { QueryResult } from '@/types';

interface AnswerCardProps {
  result: QueryResult;
  cached?: boolean;
}

export function AnswerCard({ result, cached }: AnswerCardProps) {
  return (
    <div className="mt-3.5 overflow-hidden rounded-xl border border-rule bg-ink-2">
      <div className="flex items-center justify-between border-b border-rule px-4 py-3 font-mono text-[11px]">
        <div className="flex gap-3.5 text-muted">
          <span>
            <b className="font-medium text-paper">Result</b> · {result.rowCount} rows ·{' '}
            {result.columns.length} cols
          </span>
        </div>
        <div className="flex gap-3.5 text-muted">
          executed in <b className="font-medium text-paper">{result.executionMs}ms</b>
        </div>
      </div>
      <ResultTable result={result} maxRows={5} />
      <div className="flex items-center gap-2.5 border-t border-rule bg-ink-3 px-4 py-2.5 font-mono text-[11px] text-muted">
        {cached ? 'cached · ttl 5m' : 'fresh result'}
        <div className="ml-auto flex gap-1.5">
          <IconBtn label="Copy" onClick={() => toast.success('Result copied')}>
            <Copy size={13} />
          </IconBtn>
          <IconBtn label="Save" onClick={() => toast.success('Saved to your library')}>
            <Bookmark size={13} />
          </IconBtn>
          <IconBtn label="Open chart" onClick={() => toast.info('Opening chart…')}>
            <TrendingUp size={13} />
          </IconBtn>
          <IconBtn label="Export" onClick={() => toast.success('Exporting CSV…')}>
            <FileText size={13} />
          </IconBtn>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-md border border-rule text-muted transition-colors hover:border-paper hover:text-paper"
    >
      {children}
    </button>
  );
}
