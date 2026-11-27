/** A radio button with a label and optional hint. */
import { Choice, type ChoiceProps } from '../Choice/Choice';

export function Radio(props: ChoiceProps) {
  return <Choice {...props} kind="radio" />;
}
