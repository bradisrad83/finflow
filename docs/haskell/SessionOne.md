# Haskell Session One — Servant API Server

## What Was Built
A minimal Haskell HTTP server using Servant and Warp that serves `GET /accounts` and `GET /accounts/:id/transactions` as JSON on `localhost:8080`, with types and JSON serialization matching the frontend's TypeScript interfaces exactly.

## File Location
`api/src/Types.hs`, `api/src/Main.hs`, `api/stack.yaml`, `api/package.yaml`

---

## Concepts Introduced

### Data Types and Sum Types

**Plain English**
In Haskell, you define the shape of your data with `data` declarations. A simple record looks a lot like a TypeScript interface — named fields with types. But Haskell also has sum types: `data AccountType = Checking | Savings` means "an AccountType is either Checking or Savings, and nothing else." These aren't strings with constraints — they're real values the compiler tracks. If you write a function that handles `AccountType` and forget the `Savings` case, GHC warns you. You can't accidentally pass `"cheking"` — there is no string, only the constructors.

**Technically Speaking**
`data Account = Account { accountId :: Text, accountName :: Text, accountType :: AccountType, accountBalance :: Double }` defines a product type (a record with multiple fields) using record syntax. The field names (`accountId`, etc.) double as accessor functions: `accountId :: Account -> Text`. `data AccountType = Checking | Savings` is a sum type (also called an algebraic data type or ADT) — a type with multiple constructors, each potentially carrying different data. Pattern matching on a sum type is exhaustive by default: GHC warns if you miss a constructor. This is the same concept as Haskell's `Maybe a = Nothing | Just a` — a type with two constructors, one carrying no data and one carrying a value.

**Vue / Laravel Analogy**
A Haskell record maps to a PHP class with typed properties, or a TypeScript interface. The `Account` record is the Haskell equivalent of:

```ts
interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings';
  balance: number;
}
```

The sum type `AccountType = Checking | Savings` maps to TypeScript's `'checking' | 'savings'` union — but where TypeScript unions are a compile-time annotation on top of strings, Haskell constructors are distinct runtime values. There's no PHP equivalent; PHP's closest feature is an enum (`enum AccountType: string { case Checking = 'checking'; case Savings = 'savings'; }`). In Haskell, enums and tagged unions are both just `data` — the same mechanism scales from two constructors to dozens, each optionally carrying payload.

**Common Mistakes**
- **Confusing `String` and `Text`.** In Haskell, `"hello"` is a `String` (a linked list of characters, i.e., `[Char]`). The `Text` type is a packed UTF-8 representation — efficient for I/O and JSON. They're not the same type. If your record field is `Text` but you write `"hello"` without `OverloadedStrings`, you get a type error. Always enable `{-# LANGUAGE OverloadedStrings #-}` in files that use `Text` literals.
- **Forgetting that field names are functions.** In Haskell's record syntax, `accountId` is not just a label — it's a function `Account -> Text`. If two records in the same module have a field with the same name, you get a name clash. This is why fields are often prefixed with the type name (`accountId` vs `transactionId`).

---

### Typeclasses and `ToJSON`

**Plain English**
A typeclass is Haskell's version of an interface — it defines a set of functions that a type must implement. `ToJSON` is a typeclass from the Aeson library that says "this type can be converted to JSON." Writing `instance ToJSON Account where toJSON a = ...` is you providing the implementation: "here's how to turn an `Account` value into a JSON object." The compiler then knows it can serialize `Account` anywhere JSON is expected — in HTTP responses, in lists, nested inside other JSON structures.

The key difference from object-oriented interfaces: in OOP, the implementation lives inside the class definition. In Haskell, the instance (implementation) lives separately from the data type. This means you can add `ToJSON` support to types you didn't write — even types from other libraries.

**Technically Speaking**
`class ToJSON a where toJSON :: a -> Value` defines the typeclass. `Value` is Aeson's JSON AST type. The `instance ToJSON Account` block provides the `toJSON` implementation for the `Account` type specifically. Haskell uses dictionary-passing under the hood: when you call a function that requires `ToJSON a`, GHC passes a "dictionary" (a struct of function pointers) for the specific type. This is compile-time polymorphism — no runtime type lookup, no vtable in the OOP sense.

`object [ "id" .= accountId a, ... ]` uses two Aeson combinators: `object` takes a list of `Pair` values and produces a JSON object; `.=` (pronounced "pair with") takes a key `Text` and a value (any `ToJSON` instance) and produces a `Pair`. The `.=` operator is type-safe: the right-hand side must itself have a `ToJSON` instance, recursively.

`instance ToJSON AccountType where toJSON Checking = "checking"; toJSON Savings = "savings"` uses pattern matching: the function body has one equation per constructor. `"checking"` here is a JSON string value because `Value` has a `FromString` instance that `OverloadedStrings` picks up.

**Vue / Laravel Analogy**
This is Laravel's `JsonResource`:

```php
class AccountResource extends JsonResource {
  public function toArray($request): array {
    return [
      'id'      => $this->id,
      'name'    => $this->name,
      'type'    => $this->type,
      'balance' => $this->balance,
    ];
  }
}
```

`toJson` in Haskell is `toArray` in Laravel — a method that maps your internal type to a JSON-serializable shape. The difference: Laravel resources are separate classes you instantiate; Haskell attaches the serialization to the type itself via the typeclass instance. Once `instance ToJSON Account` exists, you never need to wrap `Account` in a resource — Servant uses it directly.

In Vue, this would be a `computed` that transforms store state into the shape your API client expects. Same idea: a defined mapping from internal representation to wire format.

**Common Mistakes**
- **Using `deriving (Generic)` + `instance ToJSON` without customization, then getting wrong field names.** GHC can auto-derive `ToJSON` instances via `Generic`, but the derived instance uses Haskell field names directly — `accountId`, not `id`. If your frontend expects `id`, the auto-derived instance breaks the contract. Use explicit `instance ToJSON` with `object` and `.=` when the wire format doesn't match the field names.
- **Forgetting that `ToJSON` is recursive.** `accountType .= accountType a` works only because `AccountType` also has a `ToJSON` instance. If you add a field whose type lacks `ToJSON`, you get a compile error — not a runtime surprise.

---

### Servant's Type-Level API

**Plain English**
In every other web framework — Laravel, Express, FastAPI — you define routes by calling functions: `Route::get('/accounts', ...)`. In Servant, you define your API as a *type*. The routes, the HTTP methods, the URL parameters, and the response types are all written in Haskell's type system. Then you write handlers that the compiler verifies match the declared type. If your handler returns the wrong type, has the wrong number of arguments, or misses a route — it's a compile error, not a runtime 404.

**Technically Speaking**
```haskell
type API =
       "accounts" :> Get '[JSON] [Account]
  :<|> "accounts" :> Capture "id" Text :> "transactions" :> Get '[JSON] [Transaction]
```

This is a type-level DSL using type operators. `:>` is right-associative and means "followed by." `:<|>` is the alternative combinator — the API is one route OR the other. `"accounts"` is a type-level string literal (a path segment). `Capture "id" Text` is a type that says "capture the next path segment and decode it as `Text`, binding it to the name `id`." `Get '[JSON] [Account]` is a type that means "respond to GET requests, can produce JSON, returns `[Account]`."

`Server API` is a type alias that Servant computes from `API` — it resolves to the product of handler types: `Handler [Account] :<|> (Text -> Handler [Transaction])`. The `server` value must have exactly this type, which means `getAccounts` must be `Handler [Account]` and `getTransactions` must be `Text -> Handler [Transaction]`. This is enforced at compile time.

`Proxy API` is a runtime witness for the type `API` — since `API` is a type (not a value), you need a value-level token to pass it to `serve`. `Proxy` is that token: a zero-runtime-cost carrier for a type.

**Vue / Laravel Analogy**
Laravel's `routes/api.php`:
```php
Route::get('/accounts', [AccountController::class, 'index']);
Route::get('/accounts/{id}/transactions', [TransactionController::class, 'index']);
```

The Laravel version is configuration — strings and closures that are only checked at runtime. Servant's version is a type — checked at compile time. In Laravel, if `AccountController::index` returns transactions instead of accounts, the tests might catch it. In Servant, the compiler catches it before the code even runs.

Vue Router's `routes` array is the same idea as Laravel — runtime configuration, no static verification. There's no mainstream frontend or backend framework with Servant's level of static verification except for typed effect systems in Scala (http4s) and some TypeScript frameworks with heavy generics.

**Common Mistakes**
- **Forgetting `DataKinds` and `TypeOperators`.** The `:>` and `:<|>` operators and type-level string literals require these GHC extensions. Without them, you get confusing parse errors. Always have `{-# LANGUAGE DataKinds #-}` and `{-# LANGUAGE TypeOperators #-}` in files that define Servant APIs.
- **Getting `server` order wrong with `:<|>`.** The handlers in `server = h1 :<|> h2 :<|> h3` must be in exactly the same order as the routes in the `API` type. Servant matches them positionally. A mismatch produces a cryptic type error, not a runtime bug.
- **Using `String` where `Text` is required in captures.** `Capture "id" Text` binds a `Text` value. If your handler signature says `String -> Handler ...`, it won't match. Keep everything `Text`.

---

### `Handler` and `IO`

**Plain English**
In Haskell, functions that do real-world things — print to the terminal, start a server, read a file — live in the `IO` monad. A monad is a type that sequences operations with context. `IO` is the context of "this does something with the outside world." `main :: IO ()` means "main is an IO action that returns nothing useful."

`Handler` is Servant's monad for request handlers. It wraps `IO` and adds the ability to throw typed HTTP errors (`throwError err404`). `return seedAccounts` lifts a pure value into the `Handler` context — "this handler does no IO, it just gives back this list." When the backend needs a database, `return` becomes `liftIO (queryDB ...)`.

**Technically Speaking**
`Handler` is defined as `newtype Handler a = Handler { runHandler :: ExceptT ServerError IO a }`. `ExceptT` is a monad transformer that adds short-circuit error handling to `IO`. `return :: a -> Handler a` is the monadic `pure` — it wraps a value in the `Handler` context without any IO or error effects. `throwError :: ServerError -> Handler a` short-circuits and sends an HTTP error response.

`main :: IO ()` uses `do` notation, which is syntactic sugar for monad sequencing. `putStrLn "..."` is `IO ()` (print to stdout); `run 8080 app` is also `IO ()` (start the server). The `do` block sequences them: print first, then run.

**Vue / Laravel Analogy**
`main :: IO ()` maps to a Laravel `artisan serve` command or the `bootstrap/app.php` entry point — it's the "start the process" code. The `Handler` monad maps to a Laravel controller method: it can return a response (the happy path) or throw an exception (the error path), and the framework handles both cases. `return value` is `return response()->json($value)` — send this data back successfully.

**Common Mistakes**
- **Trying to use IO operations directly in `Handler` without `liftIO`.** `Handler` wraps `IO`, it doesn't *equal* `IO`. A function that returns `IO a` can't be called directly in a `Handler` context — you need `liftIO (someIOAction)` to lift it in.
- **Forgetting that `do` notation requires monadic alignment.** Every line in a `do` block must produce the same monad type. Mixing `IO` and `Handler` actions in the same `do` block without lifting produces type errors.

---

## Code Walkthrough

### `Types.hs` — the `ToJSON` instance for `Account`

```haskell
instance ToJSON Account where
  toJSON a = object
    [ "id"      .= accountId      a
    , "name"    .= accountName    a
    , "type"    .= accountType    a
    , "balance" .= accountBalance a
    ]
```

`object` produces a `Value` (Aeson's JSON AST). The list of `Pair` values maps Haskell field names to JSON key names — this is the explicit contract between Haskell and the React frontend. `accountId a` calls the record accessor function on the `Account` value `a`. `accountType a` is an `AccountType` value, which has its own `ToJSON` instance that produces `"checking"` or `"savings"` — Aeson calls it recursively.

### `Main.hs` — the API type

```haskell
type API =
       "accounts" :> Get '[JSON] [Account]
  :<|> "accounts" :> Capture "id" Text :> "transactions" :> Get '[JSON] [Transaction]
```

Read left to right: "a GET to `/accounts` returns JSON `[Account]`, OR a GET to `/accounts/<id>/transactions` returns JSON `[Transaction]` where `<id>` is captured as `Text`." The `'[JSON]` syntax is a type-level list with one element — Servant supports multiple content types, but we only need JSON.

### `Main.hs` — the server

```haskell
server :: Server API
server = getAccounts :<|> getTransactions
```

`Server API` is the type Servant computes from `API` — it resolves to `Handler [Account] :<|> (Text -> Handler [Transaction])`. The compiler verifies `getAccounts :: Handler [Account]` and `getTransactions :: Text -> Handler [Transaction]` match. If they don't, compile error.

### `Main.hs` — the entry point

```haskell
main :: IO ()
main = do
  putStrLn "FinFlow API running on http://localhost:8080"
  run 8080 $ simpleCors $ serve api server
```

`serve api server` converts the Servant server into a WAI `Application` (the standard Haskell web app interface, like WSGI in Python or Rack in Ruby). `simpleCors` wraps it with a middleware that adds `Access-Control-Allow-Origin: *` — without this, the React dev server on `localhost:5173` would be blocked by the browser's CORS policy. `run 8080` starts a Warp HTTP server on port 8080 serving that application.

### `Main.hs` — `OverloadedStrings` pragma

```haskell
{-# LANGUAGE OverloadedStrings #-}
```

Without this, every `"..."` literal in Haskell produces a `String` (`[Char]`). With it, string literals are polymorphic — GHC infers the type from context. `accountId = "1"` produces `Text` because the field is typed `Text`. `"accounts"` in the API type produces a type-level string. Without this pragma, you'd need `Data.Text.pack "1"` everywhere, which is tedious and noisy.

---

## What to Remember

- Haskell's `data` defines both records (product types) and enums (sum types) with the same syntax. Sum types are exhaustively checked by the compiler — forget a constructor in a pattern match and GHC warns you.
- `instance ToJSON MyType` is where the Haskell↔JSON contract lives. The field names in `object [ "id" .= ..., "name" .= ... ]` must match exactly what the frontend expects. A typo here produces `undefined` in the React component, not a compile error.
- Servant's `type API = ...` is the entire route table expressed as a type. The `server` value must match it exactly — wrong return type, wrong argument, missing route all produce compile errors before the server starts.
- `OverloadedStrings` is essential in any file using `Text`. Without it, `"hello"` is `String`, not `Text`, and you get type errors everywhere. Add it to every Haskell file that works with text or JSON.
- `run 8080 $ simpleCors $ serve api server` is three things composed right to left: `serve` converts Servant's type-safe server into a WAI app; `simpleCors` adds CORS headers so the React dev server can call it; `run 8080` starts Warp. Remove `simpleCors` and the browser blocks every request.
