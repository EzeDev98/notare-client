/** A progress bar. */
import './ProgressBar.css';

interface ProgressBarProps {
  value: number;
  label: string;
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className="ui-bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <span className="ui-bar__fill" style={{ width: `${String(percent)}%` }} />
    </div>
  );
}
