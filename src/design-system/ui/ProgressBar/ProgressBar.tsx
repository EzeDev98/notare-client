import './ProgressBar.css';

interface ProgressBarProps {
  /** 0 to 100. */
  value: number;
  /** Spoken name, for example "Upload progress". */
  label: string;
}

/** A thin progress bar. */
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
