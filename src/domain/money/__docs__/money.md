# Money

## Table of Contents

- [Overview](#overview)
- [Working with Money](#working-with-money)
- [Working with Currency](#working-with-currency)
- [Glossary](#glossary)
  - [`IMoney` (Type)](#imoney-type)
  - [`ICurrency` (Type)](#icurrency-type)
  - [`IFactor` (Type)](#ifactor-type)

## Overview

In **Drimsheet**, money is one of our most critical shared core concepts. Because financial rounding errors or precision drops can lead to critical bugs, we have strict rules for handling any monetary value. The shared value objects (`money.vo.ts` and `currency.vo.ts`) enforce immutability, type safety, and mathematically sound arithmetic across all domains.

## Working with Money

### 1. Always Use Minor Units

Monetary values must **always** be represented, stored, and processed in their **minor units** (e.g., cents for USD, kobo for NGN) as integers.

- We use `bigint` for money amounts to prevent the Javascript `Number.MAX_SAFE_INTEGER` limitation.
- Never use floats or decimals for money.

### 2. Never Calculate Outside the Value Object

All mathematical operations must be performed exclusively through the provided `moneyValue` object. You should **never** perform native arithmetic operations directly on the `.amount` property yourself.

The `moneyValue` object enforces proper mathematical rounding securely and prevents operations across different currencies.

**Example**:

```typescript
import moneyValue from 'src/domain/money/values/money.vo';

// ✅ DO:
const totalAmount = moneyValue.add(itemMoney, taxMoney);

// ❌ DON'T DO:
const totalAmount = itemMoney.amount + taxMoney.amount;
```

#### Core Operations (`moneyValue`)

- `make(amount, currency, isInMinorUnit)`: Initializes a new money object. If `isInMinorUnit` is false, it safely normalizes the float to the minor unit using the currency's properties.
- `makeZeroAmount(currency)`: Creates a zero-balance money object.
- `add(...args)` / `subtract(...args)`: Safely add or subtract amounts of the same currency.
- `multiply(money, factor)` / `divide(money, divisor)`: Uses algorithmic precision based on a `{ numerator, denominator }` factor to avoid float issues. `divide` returns both a `value` and `remainder`.
- `min(...args)` / `max(...args)`: Utilities to find extremums securely.
- `validate(money)`: Asserts structural integrity and currency validity.

### Currency Conversion

`convert(money, exchangeRate, targetCurrency)` interprets the rate as target
major units per source major unit. It accounts for both currencies' precisions:

```text
target minor units = truncateTowardZero(
  source minor units × rate × 10^target precision ÷ 10^source precision
)
```

The rate's canonical decimal string is parsed into a BigInt fraction, including
scientific notation. All monetary arithmetic uses integers; division occurs
only after applying both currency scales. Conversion rounds once at the final
target minor unit by truncating toward zero: `1.9` becomes `1` and `-1.9`
becomes `-1`. This preserves the existing equal-precision rounding rule.

- USD `100n` (USD 1.00) at `150` JPY/USD becomes JPY `150n` (JPY 150).
- JPY `150n` at `0.006` USD/JPY becomes USD `90n` (USD 0.90).
- USD `1n` at `150` JPY/USD becomes JPY `1n`, discarding the fractional yen.

Rates must be positive and finite. Their decimal numerator and denominator
must each fit within `Number.MAX_SAFE_INTEGER` before currency scaling, retaining
the existing safe-factor limit. Invalid rates are rejected even for zero amounts.
Source amounts and converted amounts remain BigInts and are not restricted to
JavaScript's safe-integer range by conversion itself.

`IExchangeRate.rate` remains a JavaScript number. Exact conversion uses the decimal
value represented by `rate.toString()`; it cannot restore precision lost before
the rate reached this API. Parsing the fraction with BigInts avoids introducing
additional error from floating-point factor multiplication.

## Working with Currency

All currency representations in Drimsheet use standard ISO 4217 rules. The currency value object ensures that the application only ever operates using globally recognized fiat parameters.

**Note**: Currencies can only be created within the system. We do not permit custom or user-defined currencies.

#### Core Operations (`currencyValue`)

- **Code Validation (`isValidCode`)**: Currency codes must be exactly 3 uppercase characters (e.g. `USD`, `NGN`) and must be globally recognized (verified via Javascript's internal `Intl.DisplayNames`).
- **Minor Unit Validation (`isValidMinorUnit`)**: Minor units dictates the scale of the currency (e.g., `2` for USD means 1 dollar = 100 cents). This value must be an integer between `0` and `8`.

## Glossary

This section defines the key data structures involved with money and currency.

### `IMoney` (Type)

The immutable data structure representing a financial amount.

**Properties:**

- **`amount`** (`bigint`): The integer representation of the money amount, strictly in minor units.
- **`currency`** (`ICurrency`): The currency object this money is evaluated in.

### `ICurrency` (Type)

The definition of a fiat or platform currency.

**Properties:**

- **`code`** (`string`): The 3-letter, globally recognized uppercase currency code (e.g., `NGN`).
- **`minorUnit`** (`number`): The mathematical exponent (base 10) used to represent fractional currency. Must be between 0 and 8.

### `IFactor` (Type)

A secure representation of a multiplier or divisor to avoid precision loss from JavaScript floating point math.

**Properties:**

- **`numerator`** (`number`): The top integer of the fraction.
- **`denominator`** (`number`): The bottom integer of the fraction.
