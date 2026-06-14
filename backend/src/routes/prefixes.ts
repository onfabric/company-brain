// Single source for the route-group prefixes, shared by the group controllers
// and the root catch-all (which 404s unknown `/api` and `/internal` paths).
export enum RoutePrefix {
  Api = '/api',
  Internal = '/internal',
}
