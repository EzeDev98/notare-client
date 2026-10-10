import './LengthCounter.css';

interface LengthCounterProps {
  count: number;
  /** Characters allowed. Default 20,000. */
  limit?: number | undefined;
  /** The counter appears from here. Default 19,000. */
  from?: number | undefined;
}

const format = (value: number): string => value.toLocaleString('en-US');

/** Hidden below 19,000. Then "19,420 of 20,000 characters". At the limit it turns to the error colour. */
export function LengthCounter({ count, limit = 20000, from = 19000 }: LengthCounterProps) {
  if (count < from) return null;
  const reached = count >= limit;
  return (
    <p className={reached ? 'n-counter n-counter--limit' : 'n-counter'} role="status">
      {reached ? 'Limit reached. New text is not saved.' : `${format(count)} of ${format(limit)} characters`}
    </p>
  );
}
