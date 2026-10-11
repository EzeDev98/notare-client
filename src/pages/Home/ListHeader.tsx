import { noteCount } from '@/design-system/lib/noteCount';

interface ListHeaderProps {
  title: string;
  /** Left out while the count is not known yet. */
  count: number | undefined;
}

/** The list title (lg) with a muted count (xs) beside it. */
export function ListHeader({ title, count }: ListHeaderProps) {
  return (
    <div className="home__head">
      <h1 className="home__title">{title}</h1>
      {count === undefined ? null : <span className="home__count">{noteCount(count)}</span>}
    </div>
  );
}
