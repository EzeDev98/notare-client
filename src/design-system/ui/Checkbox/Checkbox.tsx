import { Choice, type ChoiceProps } from '../Choice/Choice';

/** A checkbox with a label and optional hint. Never a switch. */
export function Checkbox(props: ChoiceProps) {
  return <Choice {...props} kind="checkbox" />;
}
