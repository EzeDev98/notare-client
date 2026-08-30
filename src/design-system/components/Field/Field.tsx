import type { ReactNode } from 'react';
import './Field.css';

export interface FieldMessages {
  /*
   * `?: string | undefined`, not `?: string`.
   *
   * Under exactOptionalPropertyTypes those are different types: the first
   * permits an explicit `undefined`, the second permits only ABSENCE. A
   * component that destructures an optional prop and forwards it is always
   * passing it explicitly, so the narrow form makes forwarding impossible.
   *
   * Widening is correct HERE because absent and undefined mean the same thing
   * for a hint — there is no hint either way. It would be wrong for the note
   * auto-save payload, where absent means "leave this field alone" and an
   * explicit null means "clear it", and collapsing them erases a note. Same
   * flag, opposite answer, decided by whether the distinction carries meaning.
   */
  /** Guidance shown before anything goes wrong. */
  hint?: string | undefined;
  /** Error text. Its presence is what makes the field invalid. */
  error?: string | undefined;
}

interface FieldProps extends FieldMessages {
  label: string;
  /** id of the control, so <label for> and aria-describedby line up. */
  controlId: string;
  hintId: string;
  errorId: string;
  children: ReactNode;
  /**
   * Floats the label inside the control instead of stacking it above it, to
   * save the vertical space a separate label row costs — useful on forms
   * with several short fields stacked together (Register, Login).
   *
   * Opt-in per consumer rather than the default for every Field: the CSS
   * relies on `:placeholder-shown` to tell an empty control from a filled
   * one, and that pseudo-class only does anything useful on `<input>` and
   * `<textarea>`. A `<select>` never matches it, so a floating label there
   * would read as permanently "filled" even with nothing chosen. TextField
   * and PasswordField pass `floating`; Select and TextArea keep the
   * stacked layout.
   */
  floating?: boolean;
}

/**
 * The label / control / message shell shared by every form field.
 *
 * Exists so the ACCESSIBILITY WIRING is written once. Getting it wrong is easy
 * and invisible: a red message under an input that is not associated with it
 * is, to a screen reader user, not there at all. They tab in, hear "Email,
 * edit text", and have no idea why the form will not submit.
 *
 * Ids are passed in rather than generated here because the control needs the
 * same values, and a shared parent is the only place they can agree.
 *
 * role="alert" on the error makes it an assertive live region: it interrupts
 * to announce a validation failure the user needs to act on. Deliberately NOT
 * used on the hint, which is ordinary guidance and should not interrupt
 * anything.
 *
 * The label stays a real <label for> either way — `floating` only changes
 * where it sits, never how it is wired up. A sighted user reads it inside
 * the control instead of above it; a screen reader user gets the same
 * "Label, edit text" announcement either way, since that comes from the
 * `for`/`id` pair, not from visual position.
 */
export function Field({
  label,
  controlId,
  hintId,
  errorId,
  hint,
  error,
  children,
  floating = false,
}: FieldProps) {
  return (
    <div className={floating ? 'ds-field ds-field--floating' : 'ds-field'}>
      {floating ? (
        <div className="ds-field__control">
          {children}
          <label className="ds-field__label" htmlFor={controlId}>
            {label}
          </label>
        </div>
      ) : (
        <>
          <label className="ds-field__label" htmlFor={controlId}>
            {label}
          </label>
          {children}
        </>
      )}

      {/* Rendered before the error so a screen reader reads guidance first. */}
      {hint !== undefined && !error ? (
        <p className="ds-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}

      {error !== undefined ? (
        <p className="ds-field__error" id={errorId} role="alert">
          {/* An icon as well as colour — roughly 1 in 12 men cannot rely on
              hue to tell an error from a hint (§36). */}
          <span aria-hidden="true">⚠</span> {error}
        </p>
      ) : null}
    </div>
  );
}
