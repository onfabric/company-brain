/// <reference path="./db/queries.gen.d.ts" />
// The generated file augments @ilbertt/bun-sqlgen's QueryResults/TypedSQL. Packages
// that consume the Eden `App` type (backend-client, dashboard, cli) compile the
// repositories but don't otherwise pull in the augmentation; this reference carries
// it across the package boundary so the typed query tags resolve there too.
import type { createApp } from '#app.ts';

export type App = ReturnType<typeof createApp>;
