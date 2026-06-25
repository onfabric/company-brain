/** A person attached to a record or knowledge entry, as projected by the json_agg in
 * the search/get queries. Single source for the `@type participants …` annotations. */
export type Participant = {
  id: string;
  name: string | null;
  email: string | null;
  is_external: boolean;
  handle: string | null;
};
