/** Line diff used to carry server text into a note body. */
const MAX_DIFF_CELLS = 1_000_000;

type DiffOp =
  | { kind: 'equal'; a: number; b: number }
  | { kind: 'delete'; a: number }
  | { kind: 'insert'; b: number };

export function diff<T>(a: readonly T[], b: readonly T[]): DiffOp[] | null {
  const width = b.length + 1;
  if ((a.length + 1) * width > MAX_DIFF_CELLS) return null;

  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        a[i] === b[j]
          ? (table[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(table[(i + 1) * width + j] ?? 0, table[i * width + j + 1] ?? 0);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const skipOld = (table[(i + 1) * width + j] ?? 0) >= (table[i * width + j + 1] ?? 0);
    if (i < a.length && j < b.length && a[i] === b[j]) {
      ops.push({ kind: 'equal', a: i, b: j });
      i += 1;
      j += 1;
    } else if (j >= b.length || (i < a.length && skipOld)) {
      ops.push({ kind: 'delete', a: i });
      i += 1;
    } else {
      ops.push({ kind: 'insert', b: j });
      j += 1;
    }
  }
  return ops;
}
