/** "Step 2 of 3" with one bar per step. */
import './Steps.css';

export function Steps({ current, total }: { current: number; total: number }) {
  return (
    <div className="ui-steps">
      <div className="ui-steps__bars" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={String(index)}
            className={index < current ? 'ui-steps__bar ui-steps__bar--done' : 'ui-steps__bar'}
          />
        ))}
      </div>
      <p className="ui-steps__text">{`Step ${String(current)} of ${String(total)}`}</p>
    </div>
  );
}
