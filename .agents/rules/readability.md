# Readability

- Optimize for a human reader scanning the workflow, not for the fewest lines.
- Use domain-specific names. Avoid vague names such as `data`, `result`, or a
  broad domain name when a more precise name is available.
- Use progressive disclosure: give a complex response a meaningful name before
  decomposing it.
- Avoid repeated tuple indexing, but do not combine a service call with large
  nested destructuring or destructure values before they are needed.
- Use one blank line between distinct concepts, workflow phases, and sequential
  persistence operations when it improves scanning.
- Follow the nearest established presentation pattern before introducing a new
  one.
- Name non-trivial conditions before branching. Multi-clause conditions must be
  assigned to a semantic boolean such as `isInvalidEntityVersion`, and the `if`
  statement must use that name. Do not place compound or negated logic directly
  inside an `if` condition.
- Construct entity transition state field by field; do not spread the previous
  entity.
- Pass behavioral helpers only the facts they evaluate, not a broader payload
  for convenience.
- Keep one-line transformations, comparators, and single-use wrappers at their
  call site unless extraction establishes meaningful ownership or reuse.
- Document non-trivial helpers with their purpose, output, and important failure
  or consistency behavior.
- Exported functions in `*.helper.ts` files must end with `Helper`.
- Domain validation objects and helper functions follow
  [Domain Validations And Helpers](domain-validations.md).
- In `for...of` loops, use a named loop variable and access its fields
  explicitly instead of destructuring in the loop declaration.
- Use `Pick`, `Omit`, or bespoke dependency interfaces only when they express an
  independently meaningful boundary, reusable contract, or enforced layer
  separation.
- For private helpers owned by the same factory or capability, prefer the
  existing dependency type. Do not narrow dependencies solely to document which
  properties the helper currently reads.

## Comments

- Keep comments concise and focused on information the code does not convey.
- Limit comment lines to 80 characters, including indentation and comment
  delimiters. Wrap longer prose across multiple `//` lines or a multiline
  `/** ... */` block; do not leave long JSDoc comments on one line.
- In multiline block comments, put the opening and closing delimiters on their
  own lines and prefix each content line with ` *`.
- Indivisible URLs, identifiers, and literal examples may exceed the limit when
  wrapping would change their meaning. Wrap the surrounding prose normally.
- `.prettierrc` sets `printWidth` to 80, but Prettier does not reflow JavaScript
  or TypeScript comments. Wrap comment text explicitly before formatting.

```ts
/**
 * Resolves previous/next periods from storage after enforcing ownership
 * and eligibility. Rejects lookup or validation failures; never persists.
 */
```

## Exports

- Keep declarations file-private by default.
- Export a function, value, class, interface, or type only when a current
  production module outside the defining file requires it.
- Tests do not justify exporting implementation-only declarations. Derive test
  input and output types from the module's public API instead.
- Dedicated mock and test-helper modules may export the test API they exist to
  provide.
- Framework entrypoints may remain exported when runtime discovery or generated
  integration code requires the export.
- Before adding or retaining a named export, search for its external consumers.
  Remove the export when none exist.

Prefer:

```ts
const accountingResponse = accountingEntityService.create(input);

const {
  accountingEntity: [accountingEntity, events, audit],
} = accountingResponse;
```

Avoid both repeated access such as `response.accountingEntity[2]` and a large
destructuring expression attached directly to the service invocation.
