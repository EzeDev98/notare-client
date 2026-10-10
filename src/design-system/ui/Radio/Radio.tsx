import { Choice, type ChoiceProps } from '../Choice/Choice';

/** A radio button with a label and optional hint. Give the group one shared `name`. */
export function Radio(props: ChoiceProps) {
  return <Choice {...props} kind="radio" />;
}
