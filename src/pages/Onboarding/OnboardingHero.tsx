import { CircleCheck, Smartphone } from 'lucide-react';

/** A phone with an arrow feeding into it: Notare arriving on the device. */
export function TransferHero() {
  return (
    <div className="ob-xfer" aria-hidden="true">
      <svg className="ob-xfer__arrow" viewBox="40 40 120 120">
        <polygon points="48,48 152,100 48,152 82,100" />
      </svg>
      <Smartphone className="ob-xfer__phone" />
    </div>
  );
}

/** The large tick on the last screen. It pulses gently. */
export function SuccessHero() {
  return (
    <div className="ob-hero ob-hero--pulse" aria-hidden="true">
      <CircleCheck />
    </div>
  );
}
