import { cn } from '@/lib/utils/cn';
import type { QueryResult } from '@/types';

interface ResultTableProps {
  result: QueryResult;
  compact?: boolean;
  maxRows?: number;
}

/**
 * Renders query results with cell-type detection.
 * Numeric cells are right-aligned and accented.
 */
export function ResultTable({ result, compact, maxRows }: ResultTableProps) {
  const rows = maxRows ? result.rows.slice(0, maxRows) : result.rows;

  // Find max numeric value per column for bar scaling
  const numericMaxes = new Map<string, number>();
  for (const col of result.columns) {
    const max = Math.max(
      ...rows
        .map((r) => Number(r[col]))
        .filter((n) => Number.isFinite(n)),
      0,
    );
    if (max > 0) numericMaxes.set(col, max);
  }

  return (
    <div className="overflow-auto">
      <table
        className={cn(
          'w-full border-collapse font-mono text-[12px]',
          compact && 'text-[11px]',
        )}
      >
        <thead>
          <tr>
            {result.columns.map((col) => (
              <th
                key={col}
                className="border-b border-rule bg-ink-3 px-4 py-2.5 text-left font-normal text-2xs uppercase tracking-[0.16em] text-muted"
              >
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-rule last:border-b-0">
              {result.columns.map((col) => {
                const value = row[col];
                const isNumber = typeof value === 'number';
                const max = numericMaxes.get(col);
                return (
                  <td
                    key={col}
                    className={cn(
                      'px-4 py-2.5',
                      isNumber ? 'text-right text-accent' : 'text-paper',
                    )}
                  >
                    {isNumber ? new Intl.NumberFormat('en-US').format(value) : String(value)}
                    {isNumber && max && (
                      <div className="ml-auto mt-1.5 h-[6px] max-w-[140px] overflow-hidden rounded-[3px] bg-ink-4">
                        <span
                          className="block h-full rounded-[3px] bg-accent"
                          style={{
                            width: `${Math.max(8, (Number(value) / max) * 100)}%`,
                          }}
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
