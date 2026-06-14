import { t } from 'elysia';

type Literal<V extends string> = ReturnType<typeof t.Literal<V>>;

type LiteralUnion<T extends readonly string[]> = ReturnType<
  typeof t.Union<{ -readonly [K in keyof T]: Literal<T[K] & string> }>
>;

type UnionOptions = NonNullable<Parameters<typeof t.Union>[1]>;

// t.Union over a runtime-mapped array loses the literal element types, so its
// static type collapses to never — invisible to Eden clients. Casting restores
// the union derived from the source tuple while keeping a single source of truth.
export function literalUnion<const T extends readonly string[]>(
  values: T,
  options?: UnionOptions,
): LiteralUnion<T> {
  return t.Union(
    values.map((value) => t.Literal(value)),
    options,
  ) as unknown as LiteralUnion<T>;
}
