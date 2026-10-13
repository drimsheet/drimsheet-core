# Infrastructure Unit and Adapter Tests

- Put infrastructure mapper unit tests in an owning unit's `__tests__` folder
  and name them `<subject>.test.ts`.
- Put other infrastructure tests in an owning unit's `__specs__` folder and
  name them `<subject>.spec.ts`.
- Test concrete adapter behavior, serialization, persistence mapping, and
  integration with mocked external boundaries or in-process fakes.
- Assert the contract exposed to the owning application or domain port.
- Do not move business decisions into infrastructure tests or implementations.

Follow [General Testing](general.md).
