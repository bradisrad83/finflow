# Haskell Session Two — Write Endpoints and IORef State

## What Was Built
POST and DELETE endpoints added to the Servant API (`POST /accounts`, `POST /accounts/:id/transactions`, `DELETE /transactions/:id`), with server state moved from static seed lists into mutable `IORef`s so writes actually persist across requests during the server's lifetime.

## File Location
`api/src/Types.hs`, `api/src/Main.hs`

---

## Concepts Introduced

### FromJSON — Deserializing Request Bodies

**Plain English**
`ToJSON` controls what Haskell sends *out* as JSON responses. `FromJSON` is the reverse: it controls how Haskell reads *incoming* JSON request bodies and turns them into typed values. When a POST request arrives with a JSON body, Servant calls the `FromJSON` instance for the expected type. If the JSON is malformed, a field is missing, or a value has the wrong shape, Servant rejects the request with a 400 before your handler code ever runs. You never write a string parser or a null check — the typeclass handles it.

**Technically Speaking**
`class FromJSON a where parseJSON :: Value -> Parser a`. `Value` is Aeson's JSON AST; `Parser` is a monad that either succeeds with a value or fails with an error message. `parseJSON` is called by Aeson's internal decoding machinery; you never call it directly.

The two main combinators:
- `withObject "TypeName" $ \o -> ...` — asserts the `Value` is a JSON object, binds the field map to `o`
- `o .: "key"` — looks up `"key"` in `o` and parses the value using the inferred type's `FromJSON` instance

The applicative sequencing `Constructor <$> o .: "a" <*> o .: "b" <*> o .: "c"` is the standard pattern. `<$>` applies the constructor to the first parsed field; `<*>` feeds each subsequent field in. If any field parse fails, the whole `Parser` fails and Aeson short-circuits with the error.

For sum types like `AccountType`, `withText "TypeName" $ \t -> case t of ...` asserts the value is a string and pattern-matches on it. `fail "message"` produces a `Parser` failure with that message, which becomes the 400 error body.

**Vue / Laravel Analogy**
This is Laravel's `FormRequest`:

```php
class CreateAccountRequest extends FormRequest {
  public function rules(): array {
    return [
      'id'      => 'required|string',
      'name'    => 'required|string',
      'type'    => 'required|in:checking,savings',
      'balance' => 'required|numeric',
    ];
  }
}
```

Laravel validates in a separate class with string rules. Haskell validates in the `FromJSON` instance with code — the same type system that defines `Account` also defines how to parse it. A field rename in `Account` requires updating `FromJSON`; the compiler ensures they stay in sync. In Laravel, a field rename in the model doesn't automatically update the `FormRequest` rules.

**Common Mistakes**
- **Forgetting `FromJSON` when adding a `ReqBody` to a route.** If your type has `ToJSON` but not `FromJSON`, Servant gives a confusing type error at the `ReqBody` site. Both instances are required for types used in request bodies.
- **Using `.:` for optional fields.** `o .: "key"` fails if `"key"` is absent. For optional fields, use `o .:? "key"` which returns `Maybe a`. Using `.:` on an optional field means any client that omits the field gets a 400.
- **Writing `parseJSON _ = fail "..."` as a catch-all.** This silently swallows type mismatches. Be explicit with `withObject` or `withText` — their error messages tell the caller exactly what shape was expected.

---

### IORef — Mutable State in IO

**Plain English**
Haskell functions are pure — by default, they can't change variables or produce side effects. This is what makes Haskell code easy to reason about, but it creates a problem for a server that needs to remember things between requests. `IORef` is the standard escape hatch: a mutable reference cell that can only be read and written inside the `IO` monad. Think of it as a single global variable, but one the type system tracks explicitly — you can only touch it in code that's allowed to do IO.

For session two, `IORef [Account]` is the entire database. It starts with the seed list, and every POST prepends to it, every DELETE filters it. The state lives in RAM and resets when the server restarts — good enough while there's no real database yet.

**Technically Speaking**
`newIORef :: a -> IO (IORef a)` — allocates a new mutable cell holding the initial value, returns it inside `IO`. `readIORef :: IORef a -> IO a` — reads the current value. `modifyIORef :: IORef a -> (a -> a) -> IO ()` — applies a pure function to the current value atomically (within a single thread; not safe for concurrent writes without `atomicModifyIORef`).

`liftIO :: IO a -> Handler a` — `Handler` is built on top of `IO` (it's `ExceptT ServerError IO`). Raw `IO` actions can't run directly inside `Handler` — you need `liftIO` to lift them into the `Handler` context. This is the monad transformer pattern: a stack of effects, where each layer needs explicit lifting to use a lower layer's operations.

`modifyIORef ref (acc :)` uses `(:)` as a function — in Haskell, `(:)` is the list cons operator. `(acc :)` is a partially applied section: a function `[Account] -> [Account]` that prepends `acc` to whatever list it receives. `modifyIORef ref (filter (...))` similarly passes a filter function to replace the list.

**Vue / Laravel Analogy**
The closest Laravel equivalent is an in-memory singleton bound in the service container:

```php
app()->singleton('accounts', fn() => collect($seedAccounts));
// In a handler:
app('accounts')->push($newAccount);
```

But Laravel doesn't actually work this way in production because PHP is shared-nothing — each request gets a fresh process. `IORef` is a valid server-side pattern in Haskell because the same long-running process handles all requests, so the ref persists between them.

In Vue, `ref([...])` from the Composition API is the closest conceptual match — a reactive mutable reference. The difference: Vue's `ref` triggers UI re-renders when mutated; Haskell's `IORef` doesn't notify anyone, it just stores the value.

**Common Mistakes**
- **Using `IORef` for concurrent writes without `atomicModifyIORef`.** `modifyIORef` is not thread-safe under concurrent requests — two simultaneous writes can race. For production, use `atomicModifyIORef` or a real database. For a single-developer session-two server, `modifyIORef` is fine.
- **Forgetting `liftIO`.** Any `IORef` operation (`readIORef`, `modifyIORef`) returns `IO a`, not `Handler a`. Without `liftIO`, GHC gives a type error complaining it can't match `IO` with `Handler`. Always `liftIO $ readIORef ref` inside a `Handler` `do` block.
- **Creating a new `IORef` inside a handler.** If you write `ref <- newIORef []` inside a handler function, you get a fresh empty ref on every request — state is never shared between requests. The refs must be created once in `main` and passed to all handlers.

---

### ReqBody in the Servant API Type

**Plain English**
Adding a POST route to Servant's API type means declaring what the request body looks like — its content type and its Haskell type. `ReqBody '[JSON] Account` in the route type tells Servant two things: "expect a JSON body" and "parse it into an `Account` value using its `FromJSON` instance." Servant then adds an extra argument to the corresponding handler function automatically. You never touch the raw request; Servant hands you a fully-parsed, type-safe value.

**Technically Speaking**
`ReqBody '[JSON] Account :> Post '[JSON] Account` reads as: "a route that accepts a JSON-encoded `Account` body and responds to POST with a JSON-encoded `Account`." The `'[JSON]` on `ReqBody` is the list of accepted content types for the request; the `'[JSON]` on `Post` is the list of producible content types for the response.

The effect on the handler type: every `ReqBody '[ct] a` in the route type adds one argument of type `a` to the `Server` handler. So `"accounts" :> ReqBody '[JSON] Account :> Post '[JSON] Account` compiles to a handler type of `Account -> Handler Account`. Servant extracts the body, parses it, and passes the result as that argument. A parse failure returns 400 automatically.

`DeleteNoContent` is a Servant type alias for `Verb 'DELETE 204 '[] NoContent` — a DELETE route that returns HTTP 204 with an empty body. The handler returns `return NoContent`; `NoContent` is a Haskell value that serializes to nothing.

**Vue / Laravel Analogy**
In Laravel:
```php
Route::post('/accounts', [AccountController::class, 'store']);
// Controller:
public function store(CreateAccountRequest $request): JsonResponse {
  $account = Account::create($request->validated());
  return response()->json($account);
}
```

The `CreateAccountRequest` type hint in the controller signature is Laravel's equivalent of `ReqBody '[JSON] Account` — it declares "this route expects a validated request of this shape." The difference: Laravel's binding is by convention (type-hint name matching), checked at runtime. Servant's binding is structural — the compiler derives the handler signature from the API type, and mismatches are compile errors.

**Common Mistakes**
- **Getting handler argument order wrong.** `"accounts" :> Capture "id" Text :> "transactions" :> ReqBody '[JSON] Transaction :> Post '[JSON] Transaction` produces a handler `Text -> Transaction -> Handler Transaction`. The `Capture` argument comes before the `ReqBody` argument because it appears first in the type. Swap them and the code won't compile.
- **Using `Post` when `PostCreated` is more correct.** `Post '[JSON] a` returns HTTP 200. A resource creation conventionally returns 201. `PostCreated '[JSON] a` returns 201. For session two, 200 is fine; in production, prefer 201.

---

### Dependency Injection via Function Arguments

**Plain English**
Rather than using a global mutable variable that any function can reach out and touch, the `IORef`s are created once in `main` and passed as explicit arguments to every handler that needs them. The function signature makes the dependency visible: `getAccounts :: IORef [Account] -> Handler [Account]` tells you exactly what state this function reads. Nothing is hidden. `makeServer` takes both refs and bundles the partially-applied handlers into the `Server API` value.

This is the same principle as dependency injection in OOP — functions receive what they need rather than reaching for globals — but expressed purely through function arguments rather than a container or framework.

**Technically Speaking**
`makeServer :: IORef [Account] -> IORef [Transaction] -> Server API` returns a `Server API` — which is a type alias Servant computes from `API`. Each handler in the `:<|>` chain is partially applied: `getAccounts accountsRef` has type `Handler [Account]`, `postTransaction transactionsRef` has type `Text -> Transaction -> Handler Transaction`. Servant matches them positionally against the `API` type definition.

The alternative — top-level `IORef`s using `unsafePerformIO` — is an antipattern in Haskell. It's technically possible but breaks referential transparency and is notoriously hard to reason about. Explicit argument passing is idiomatic.

**Vue / Laravel Analogy**
Laravel constructor injection:
```php
class AccountController {
  public function __construct(private AccountRepository $repo) {}
  public function index(): JsonResponse { return response()->json($this->repo->all()); }
}
```

The controller declares its dependency in the constructor; the service container wires it. Haskell's version has no container — you wire it manually in `main`. More verbose for large apps, but completely transparent: following the call chain from `main` tells you exactly which state each handler can access.

---

## Code Walkthrough

### `Types.hs` — `FromJSON` for a sum type

```haskell
instance FromJSON AccountType where
  parseJSON = withText "AccountType" $ \t -> case t of
    "checking" -> pure Checking
    "savings"  -> pure Savings
    _          -> fail "expected \"checking\" or \"savings\""
```

`withText` asserts the incoming JSON value is a string and binds it to `t`. The case expression pattern-matches on the string value — `pure Checking` lifts the constructor into the `Parser` monad (success), `fail "..."` produces a parse failure (400). The `_` wildcard catches any unknown string. This is the entire validation for `AccountType` — no regex, no enum library, just pattern matching.

### `Types.hs` — `FromJSON` for a record

```haskell
instance FromJSON Account where
  parseJSON = withObject "Account" $ \o -> Account
    <$> o .: "id"
    <*> o .: "name"
    <*> o .: "type"
    <*> o .: "balance"
```

`withObject` asserts a JSON object. `Account <$> o .: "id"` parses the `"id"` field as `Text` (inferred from the `Account` constructor's first argument type) and applies the `Account` constructor to it — producing `Parser (Text -> AccountType -> Double -> Account)` at that point. Each `<*> o .: "..."` feeds the next parsed field into the partially-applied constructor. The whole expression produces `Parser Account`. If any field is missing or has the wrong type, the entire `Parser Account` fails.

### `Main.hs` — IORef initialization in `main`

```haskell
main :: IO ()
main = do
  accountsRef     <- newIORef seedAccounts
  transactionsRef <- newIORef seedTransactions
  putStrLn "FinFlow API running on http://localhost:8080"
  run 8080 $ simpleCors $ serve api (makeServer accountsRef transactionsRef)
```

`newIORef seedAccounts` allocates the mutable cell and returns it inside `IO`. The `<-` in `do` notation extracts the `IORef [Account]` from the `IO` wrapper. Both refs are created here — once, at startup — and passed into `makeServer`. Every request handler that runs for the lifetime of this process shares the same two refs.

### `Main.hs` — a POST handler

```haskell
postAccount :: IORef [Account] -> Account -> Handler Account
postAccount ref acc = do
  liftIO $ modifyIORef ref (acc :)
  return acc
```

`modifyIORef ref (acc :)` — `(acc :)` is a section: the cons operator `:` partially applied with `acc` on the left. It produces a function `[Account] -> [Account]` that prepends `acc`. `modifyIORef` applies that function to whatever is currently in the ref. `liftIO` lifts the `IO ()` result into `Handler`. `return acc` echoes the received account back as the 201 response body — the frontend needs the created resource returned so it can store the id.

### `Main.hs` — the DELETE handler

```haskell
deleteTransaction :: IORef [Transaction] -> Text -> Handler NoContent
deleteTransaction ref tid = do
  liftIO $ modifyIORef ref (filter (\t -> transactionId t /= tid))
  return NoContent
```

`filter (\t -> transactionId t /= tid)` produces a function `[Transaction] -> [Transaction]` that removes the transaction with the matching id. `modifyIORef` replaces the ref's contents with the filtered list. `return NoContent` sends HTTP 204 — the `DeleteNoContent` route type tells Servant to use status 204 and an empty body.

### `Main.hs` — wiring with `makeServer`

```haskell
makeServer :: IORef [Account] -> IORef [Transaction] -> Server API
makeServer accountsRef transactionsRef =
       getAccounts    accountsRef
  :<|> getTransactions transactionsRef
  :<|> postAccount    accountsRef
  :<|> postTransaction transactionsRef
  :<|> deleteTransaction transactionsRef
```

Each handler is partially applied with its ref, reducing it to the type Servant expects. `getAccounts accountsRef :: Handler [Account]` matches the first route. `postTransaction transactionsRef :: Text -> Transaction -> Handler Transaction` matches the fourth. The `:<|>` ordering must be identical to the `API` type definition — Servant matches positionally.

---

## What to Remember

- `FromJSON` is `ToJSON`'s mirror: it deserializes incoming JSON into typed Haskell values. Write one instance per type used in a `ReqBody`. A parse failure automatically returns 400 — no manual error handling needed.
- `withObject "T" $ \o -> T <$> o .: "a" <*> o .: "b"` is the standard `FromJSON` pattern for records. For sum types serialized as strings, use `withText` and pattern match on the string.
- `IORef` is Haskell's mutable variable — allocated with `newIORef`, read with `readIORef`, updated with `modifyIORef`. Create refs once in `main` and pass them to handlers; never create them inside a handler or state won't persist between requests.
- `liftIO` is required whenever you call an `IO` action (like `readIORef`) inside a `Handler` `do` block. `Handler` is built on top of `IO` but is not `IO` — the lift is always explicit.
- `makeServer` takes the `IORef`s as arguments and partially applies each handler, producing a `Server API` value. Handler order in `:<|>` must match route order in the `API` type exactly — positional, not named.
