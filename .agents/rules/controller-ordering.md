# Controller Endpoint Ordering

- In `*.controller.ts`, order endpoints by behavior: reads (collection, named
  lookups, detail, subresources), creation/setup, updates, lifecycle actions,
  then deletion. Classify by behavior, not HTTP verb; rectification is an update.
- Within each phase, group related resource paths and sort by path, ignoring a
  leading slash. Put prerequisite setup before dependent creation.
- Route precedence comes first: keep literal routes before parameterized or
  catch-all routes that could match the same request, for the same HTTP verb.
- For authentication controllers, group flows in lifecycle
  order: signup/verification, login (including OAuth start/callback), session
  refresh/logout, then recovery request/completion. Keep paired steps adjacent.
- Insert new endpoints in their owning group. Move each method with its complete
  documentation and decorators; preserve middleware order and endpoint behavior.
- After reordering, regenerate TSOA artifacts and verify route precedence and
  unchanged API contracts with the existing HTTP specs.
