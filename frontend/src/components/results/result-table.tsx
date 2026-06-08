import { cn } from '@/lib/utils/cn';
import type { QueryResult } from '@/types';

interface ResultTableProps {
  readonly result: QueryResult;
  readonly compact?: boolean;
  readonly maxRows?: number;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return (value as string | number | boolean).toString();
}

export function ResultTable({ result, compact, maxRows }: ResultTableProps) {
  const rows = maxRows ? result.rows.slice(0, maxRows) : result.rows;

  const numericMaxes = new Map<number, number>();
  result.columns.forEach((_col, idx) => {
    const max = Math.max(
      ...rows.map((r) => Number(r[idx])).filter((n) => Number.isFinite(n)),
      0,
    );
    if (max > 0) numericMaxes.set(idx, max);
  });

  return (
    <div className="overflow-auto">
      <table
        className={cn(
          'w-full border-collapse font-mono',
          compact ? 'text-[11px]' : 'text-[12px]',
        )}
      >
        <thead>
          <tr>
            {result.columns.map((col) => (
              <th
                key={col}
                className="border-b border-rule bg-ink-4 px-4 py-2.5 text-left font-normal text-[10px] uppercase tracking-[0.14em] text-paper-3"
              >
                {col.replaceAll('_', ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className="border-b border-rule last:border-b-0 transition-colors hover:bg-ink-4/50"
            >
              {result.columns.map((col, colIdx) => {
                const value = row[colIdx];
                const isNumber = typeof value === 'number';
                const max = numericMaxes.get(colIdx);
                return (
                  <td
                    key={col}
                    className={cn(
                      'px-4 py-2.5',
                      isNumber ? 'text-right text-accent' : 'text-paper',
                    )}
                  >
                    {isNumber
                      ? new Intl.NumberFormat('en-US').format(value)
                      : formatCell(value)}
                    {isNumber && max && (
                      <div className="ml-auto mt-1.5 h-[4px] max-w-[100px] overflow-hidden rounded-full bg-ink-5">
                        <span
                          className="block h-full rounded-full bg-accent/35"
                          style={{ width: `${Math.max(8, (Number(value) / max) * 100)}%` }}
                        />
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
