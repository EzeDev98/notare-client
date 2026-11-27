/** A checkbox with a label and optional hint. */
import { Choice, type ChoiceProps } from '../Choice/Choice';

export function Checkbox(props: ChoiceProps) {
  return <Choice {...props} kind="checkbox" />;
}
