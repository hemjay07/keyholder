// File: apps/web/src/components/Pager.tsx
// One pager for every list page: range shown, previous/next, numbered pages with gaps, page size, all in the URL
// (?page=, ?per=) so any page can be linked and the back button works. Server component; plain links.
import Link from 'next/link';
import s from './pager.module.css';

export const PER_OPTIONS = [25, 50, 100] as const;

/** Parse ?page= and ?per= against a total; always returns a valid page. */
export function paginate(total: number, page?: string, per?: string, defPer = 50) {
  const size = PER_OPTIONS.find((n) => String(n) === per) ?? defPer;
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(pages, Math.max(1, Number.parseInt(page ?? '1', 10) || 1));
  return { page: p, pages, per: size, from: total ? (p - 1) * size : 0, to: Math.min(total, p * size), total };
}

/** Page numbers with gaps: 1 … 4 5 [6] 7 8 … 12 */
function window(page: number, pages: number): (number | 'gap')[] {
  const keep = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2].filter((n) => n >= 1 && n <= pages));
  const out: (number | 'gap')[] = [];
  [...keep].sort((a, b) => a - b).forEach((n, i, arr) => { if (i && n - arr[i - 1]! > 1) out.push('gap'); out.push(n); });
  return out;
}

interface PagerProps { base: string; query: Record<string, string | undefined>; page: number; pages: number; per: number; from: number; to: number; total: number; noun: string; defPer?: number }

export default function Pager({ base, query, page, pages, per, from, to, total, noun, defPer = 50 }: PagerProps) {
  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ ...query, ...patch }).filter(([, v]) => v != null && v !== '') as [string, string][]);
    if (q.get('page') === '1') q.delete('page');
    if (q.get('per') === String(defPer)) q.delete('per');
    const str = q.toString();
    return str ? `${base}?${str}` : base;
  };
  return (
    <nav className={s.pager} aria-label={`${noun} pages`}>
      <span className={s.range}>{total ? <><b>{from + 1}–{to}</b> of {total} {noun}</> : `No ${noun}`}</span>
      {pages > 1 && (
        <span className={s.pages}>
          {page > 1 ? <Link href={href({ page: String(page - 1) })} rel="prev">← Prev</Link> : <span className={s.off}>← Prev</span>}
          {window(page, pages).map((n, i) => (n === 'gap' ? <span key={`g${i}`} className={s.gap}>…</span> : n === page ? <span key={n} className={s.cur} aria-current="page">{n}</span> : <Link key={n} href={href({ page: String(n) })}>{n}</Link>))}
          {page < pages ? <Link href={href({ page: String(page + 1) })} rel="next">Next →</Link> : <span className={s.off}>Next →</span>}
        </span>
      )}
      {total > PER_OPTIONS[0] && (
        <span className={s.per}>Show {PER_OPTIONS.map((n) => (n === per ? <b key={n}>{n}</b> : <Link key={n} href={href({ per: String(n), page: undefined })}>{n}</Link>))}</span>
      )}
    </nav>
  );
}
