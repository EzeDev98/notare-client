/**
 * Strips keys whose value is `undefined` from an object, without changing
 * the object's shape otherwise.
 *
 * exactOptionalPropertyTypes (tsconfig.app.json) distinguishes an ABSENT
 * optional prop from one explicitly set to `undefined` — but every DOM
 * prop type React ships (ComponentPropsWithoutRef<'input'>, and so on)
 * types its optional fields as `T | undefined` rather than leaving them
 * out entirely. So spreading a rest object built from one of those types
 * onto a PatternFly component — whose own props are plain `prop?: T`, no
 * explicit `| undefined` — fails the stricter check even though the two
 * are identical at runtime (React treats "absent" and "present but
 * undefined" the same way). This makes them type-identical too, at the
 * one place components already spread `...rest` onto a PatternFly
 * primitive, without loosening exactOptionalPropertyTypes for the rest of
 * the app.
 *
 * The return type matters as much as the runtime filter: simply returning
 * `T` would keep every field typed as `X | undefined`, so a spread of the
 * result still wouldn't satisfy a plain `prop?: X` target. Every field is
 * remapped to optional-without-undefined instead — matching what the
 * filter actually produces (a key is either present with a real value, or
 * absent).
 */
export function omitUndefined<T extends object>(
  obj: T,
): Partial<{ [K in keyof T]: Exclude<T[K], undefined> }> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<{
    [K in keyof T]: Exclude<T[K], undefined>;
  }>;
}
