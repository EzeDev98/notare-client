/** Onboarding pictures. */
import { CircleCheck, Smartphone } from 'lucide-react';

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

export function SuccessHero() {
  return (
    <div className="ob-hero ob-hero--pulse" aria-hidden="true">
      <CircleCheck />
    </div>
  );
}
