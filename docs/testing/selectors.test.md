# Unit Tests for Selectors

## What Was Built
Vitest unit tests for `selectNetWorth`, `selectUniqueCategories`, `selectMonthlyNet`, and `selectAccountById` — 16 tests that verify each selector's behavior in isolation using plain JavaScript objects as mock state.

## File Location
`src/__tests__/selectors.test.ts`

---

## Concepts Introduced

### Testing pure functions — call with input, assert output

**Plain English**
A selector is a pure function: the same input always produces the same output, with no side effects. Pure functions are the easiest thing to test because you don't need to set up a database, render a component, or mock an API. You call the function with data you construct yourself, and check that it returns what you expect. The entire test setup for `selectNetWorth` is: create a fake state with accounts, call the selector, assert the sum. Three lines.

**Technically Speaking**
`createSelector(inputSelectors, resultFn)` returns a function with signature `(state: RootState) => T`. During tests, you call it directly: `selectNetWorth(mockState)`. The selector doesn't know or care whether `mockState` came from a real Redux store or a plain object — it only reads the properties it's been told to read. TypeScript's structural typing enforces that your mock object matches what the input selectors access.

**Vue / Laravel Analogy**
In Laravel with PHPUnit, testing a computed model attribute:
```php
public function test_net_worth_sums_account_balances() {
    $user = new User();
    $user->accounts = collect([
        (object) ['balance' => 1000],
        (object) ['balance' => 500],
    ]);
    $this->assertEquals(1500, $user->net_worth);
}
```
Same concept: construct the minimum data the function needs, call it, assert. `expect(selectNetWorth(state)).toBe(1500)` maps directly to PHPUnit's `assertEquals`. In Vue, testing a Pinia store getter uses the same pattern — call the getter with controlled state, assert the output.

**Common Mistakes**
1. **Testing implementation instead of behavior.** Don't test that `selectNetWorth` calls `.reduce()` — test that it returns the correct number. If you rewrite the selector to use a `for` loop, the tests should still pass.
2. **Over-specifying test data.** If `selectNetWorth` only needs `accounts[].balance`, your mock state doesn't need realistic descriptions, IDs, or types. Add only what the code under test reads.
3. **Not testing edge cases.** Zero items (empty array) and a single item are both worth testing — they catch off-by-one bugs and incorrect initial accumulator values in `.reduce()`.

---

### makeState — the minimal mock state factory

**Plain English**
Every selector expects a `RootState`-shaped object. Rather than copying out the full type structure in every test, `makeState` is a helper function that builds it from just the pieces you care about: an array of accounts and an array of transactions. The `loading` and `error` fields are always `false`/`null` since no selector we're testing reads them. It's the smallest object that satisfies what the selectors need.

**Technically Speaking**
```ts
function makeState(accounts: Account[] = [], transactions: Transaction[] = []) {
  return {
    accounts: { accounts, loading: false, error: null },
    transactions: { transactions, loading: false, error: null },
  } as const;
}
```
TypeScript's structural typing doesn't require the object to be an instance of a specific class — it only requires the shape to match. The selectors access `state.accounts.accounts` and `state.transactions.transactions` — as long as those paths exist with the right types, the selectors work. `as const` tells TypeScript to infer the narrowest possible type, which avoids widening issues in tests.

**Vue / Laravel Analogy**
In Laravel tests, factory methods like `User::factory()->make()` serve the same purpose — creating a minimal, controlled object rather than a full database-backed model. The pattern is universal: tests should create exactly the data they need, no more.

**Common Mistakes**
1. **Using the real Redux store in selector tests.** Importing and dispatching to the real store makes tests slower, harder to isolate, and dependent on initial state. Selectors are pure functions — call them directly with mock state.
2. **Making `makeState` too general.** `makeState` should reflect the tests it serves. If you're only testing account-related selectors, you might not need the `transactions` parameter at all. Start minimal and extend when needed.

---

### Test factories — deterministic test data

**Plain English**
The `account()` and `txn()` functions create test objects with sensible defaults. You only pass the fields that matter for a given test — everything else gets a default. The `nextId` counter ensures each object gets a unique ID, preventing accidental ID collisions across tests. This is the "factory" pattern for test data: a function that builds a valid object with one overridable field at a time.

**Technically Speaking**
```ts
let nextId = 1;
function account(balance: number, type: 'checking' | 'savings' = 'checking'): Account {
  return { id: String(nextId++), name: `Account ${nextId}`, type, balance };
}

function txn(overrides: Partial<Transaction> = {}): Transaction {
  return { id: String(nextId++), accountId: '1', description: 'Test',
    amount: 100, type: 'debit', date: thisMonth(15), category: 'Misc',
    ...overrides };
}
```
`Partial<Transaction>` accepts any subset of Transaction fields — TypeScript ensures only valid fields are passed. The spread `...overrides` is last, so any provided field overrides the default. `nextId++` is a post-increment — it reads `nextId` then increments, ensuring each call gets a unique value.

**Vue / Laravel Analogy**
Laravel's `factory()->define()` is the exact equivalent:
```php
$factory->define(Account::class, function (Faker $faker) {
    return ['balance' => $faker->randomFloat(2), 'type' => 'checking'];
});
// Override in test: factory(Account::class)->make(['balance' => 1000])
```
The spread overrides pattern is identical to Laravel factory state overrides.

**Common Mistakes**
1. **Using hardcoded IDs across multiple tests.** `id: '1'` in every test risks accidental cache hits if `createSelector`'s memoization returns a stale result from a previous test's call.
2. **Including irrelevant fields in overrides.** If testing `selectNetWorth`, don't pass `{ description: 'Salary', category: 'Income' }` — those fields aren't read by the selector. Keep overrides minimal.

---

### toBeCloseTo for floating-point arithmetic

**Plain English**
`4200 - 87 - 22.50` should equal `4090.5`. In a perfect world, `toBe(4090.5)` would work. But JavaScript's floating-point arithmetic can produce `4090.4999999999995` for what looks like a simple subtraction. `toBeCloseTo(4090.5)` checks that the actual value is within `0.005` of the expected value (2 decimal places by default). For money amounts that are the sum of user-entered decimals, this is the correct matcher.

**Technically Speaking**
`expect(value).toBeCloseTo(number, numDigits?)` asserts `|received - expected| < 10^(-numDigits) / 2`. The default `numDigits` is 2, meaning values must agree to within `0.005`. IEEE 754 double-precision floating-point represents most decimal fractions as repeating binary fractions — `0.1 + 0.2 === 0.30000000000000004` is the canonical example. For financial calculations, `toBeCloseTo` avoids false test failures due to this representation.

**Vue / Laravel Analogy**
In PHP, floating-point comparison uses `abs($a - $b) < PHP_FLOAT_EPSILON` or PHPUnit's `assertEqualsWithDelta($expected, $actual, $delta)`. The problem is identical across languages — binary floating-point can't represent most decimal fractions exactly.

**Common Mistakes**
1. **Using `toBe` for float arithmetic.** `expect(0.1 + 0.2).toBe(0.3)` fails. Use `toBeCloseTo`.
2. **Using `toBeCloseTo` with too many decimal places.** `toBeCloseTo(4090.50, 10)` might fail even for correct results due to accumulated floating-point error. Stick to 2 decimal places for money.

---

## Code Walkthrough

### The thisMonth helper for date-sensitive tests
```ts
const now = new Date();
const yyyy = now.getFullYear();
const mm = String(now.getMonth() + 1).padStart(2, '0');
const thisMonth = (dd: number) => `${yyyy}-${mm}-${String(dd).padStart(2, '0')}`;
```
`selectMonthlyNet` filters transactions by the current month using `new Date()` internally. Test transactions must match the actual current month or the filter excludes them. Computing the prefix at module evaluation time (when the test file loads) ensures the test dates match what the selector computes. A hardcoded date like `'2025-05-15'` would break as soon as the month changes.

### Testing the boundary — past transactions excluded
```ts
it('ignores transactions from past months', () => {
  const transactions = [txn({ date: '2020-01-15', type: 'credit', amount: 500 })];
  expect(selectMonthlyNet(makeState([], transactions))).toBe(0);
});
```
`'2020-01-15'` is guaranteed to be in the past regardless of when the test runs (since we're in 2026). This is the "boundary case" — verifying that the filter actually excludes old transactions, not just that it includes current ones. Both sides of a filter condition should be tested.

### selectAccountById factory pattern
```ts
it('returns the correct account when multiple exist', () => {
  const a1 = account(100);
  const a2 = account(200);
  const a3 = account(300);
  expect(selectAccountById(a2.id)(makeState([a1, a2, a3]))).toEqual(a2);
});
```
`selectAccountById` is a factory — calling it with an ID returns a selector. The test calls the factory (`selectAccountById(a2.id)`) then immediately calls the selector with state. `toEqual` does deep equality — checking every field — rather than `toBe` which checks reference equality.

---

## What to Remember

- Selectors are pure functions — test them by calling directly with a plain object, no store required.
- `makeState` should be minimal — only include what the selectors under test actually read.
- Use `toBeCloseTo` for any assertion involving floating-point arithmetic, especially money sums.
- Build `thisMonth(dd)` dynamically from `new Date()` in test setup so date-sensitive tests don't break as time passes.
- Test both sides of a filter (included case AND excluded case) — a filter that accepts everything is not a filter.
