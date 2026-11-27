/** The list title and note count. */
import { noteCount } from '@/design-system/lib/noteCount';

interface ListHeaderProps {
  title: string;
  count: number | undefined;
}

export function ListHeader({ title, count }: ListHeaderProps) {
  return (
    <div className="home__head">
      <h1 className="home__title">{title}</h1>
      {count === undefined ? null : <span className="home__count">{noteCount(count)}</span>}
    </div>
  );
}
