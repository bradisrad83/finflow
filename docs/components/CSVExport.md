# CSV Export

## What Was Built
An "Export CSV" button on `AccountDetail` that downloads the currently-filtered transactions as a CSV file using `Blob` and `URL.createObjectURL` — no server, no library, purely in-browser.

## File Location
`src/pages/AccountDetail.tsx`

---

## Concepts Introduced

### Blob — an in-memory file

**Plain English**
A `Blob` is a piece of data that lives in the browser's memory, treated as a file. You hand it a string (or bytes, or an array of either) and tell it what kind of file it is (CSV, image, PDF, etc.). The browser holds that data in memory and gives you an object you can work with. You can't "open" a Blob directly — you need to get a URL for it, which is the next step.

**Technically Speaking**
`Blob` (Binary Large Object) is a W3C standard browser API. `new Blob(blobParts: BlobPart[], options?: BlobPropertyBag)` accepts an array of `string | ArrayBuffer | ArrayBufferView | Blob` as its parts — they're concatenated. The `type` option is the MIME type string; for CSV, `'text/csv;charset=utf-8;'` signals to the browser and OS what application to suggest for opening the file. The `Blob` object has `size` (bytes) and `type` properties but no direct way to download — for that you need `URL.createObjectURL`.

**Vue / Laravel Analogy**
In Laravel, `response()->streamDownload(fn() => echo $csv, 'file.csv')` serves a CSV from the server. The `Blob` is the client-side equivalent: you construct the file's content in JavaScript memory and initiate a download without any server roundtrip. In Vue, the same `Blob` code runs identically — it's a browser API, not framework-specific.

**Common Mistakes**
1. **Passing a bare string instead of an array.** `new Blob('some,csv', ...)` is a type error — `Blob` expects an array of parts. `new Blob(['some,csv'], ...)` is correct.
2. **Using the wrong MIME type.** `text/plain` works for download but tells the OS this is a text file, not a spreadsheet. `text/csv;charset=utf-8;` gives the browser and OS the right signal.

---

### URL.createObjectURL — a temporary URL for in-memory data

**Plain English**
Once you have a `Blob`, you need a URL to give to an `<a href="...">` so the browser can download it. `URL.createObjectURL(blob)` generates a temporary `blob://` URL — something like `blob://localhost/a3f2b8c4-...` — that points to the blob in memory. This URL is valid only in the current browser tab, only for the current session, only until you revoke it. It's a temporary address, not a real network URL. After the download starts, you revoke it immediately to free the memory.

**Technically Speaking**
`URL.createObjectURL(object: Blob | MediaSource)` returns a DOMString containing a URL with `blob:` scheme. The browser maintains an internal registry mapping these URLs to their in-memory objects. The URL is valid for the lifetime of the document or until `URL.revokeObjectURL(url)` is called. The URL is same-origin and cannot be accessed from other tabs or windows. Revoking after `.click()` is safe because the download request has already been queued in the browser's download manager — the blob data is copied out of the URL registry before revocation takes effect.

**Vue / Laravel Analogy**
There's no Laravel analogy for client-side blob URLs — server-side file serving goes through real HTTP URLs. In Vue, the exact same `URL.createObjectURL` code works identically — this is a pure browser API. If Vue Router were involved, you'd want to ensure the URL is revoked before any navigation, since navigating away destroys the document context in single-page apps.

**Common Mistakes**
1. **Forgetting `URL.revokeObjectURL(url)`.** The blob stays in memory indefinitely — each export creates another unreleased blob. In an app with frequent exports, this causes a memory leak. Always revoke immediately after `.click()`.
2. **Calling `URL.revokeObjectURL` before `.click()`.** The opposite mistake: revoking before the browser has processed the click causes the download to fail. Call `.click()` first, then revoke synchronously.

---

### Programmatic link click — triggering a download without a visible element

**Plain English**
The standard way to trigger a file download is an `<a href="..." download="filename">` link that the user clicks. You can also do it entirely in JavaScript: create the `<a>` element, set its `href` and `download` attributes, call `.click()` on it — all without adding it to the DOM. The browser treats it identically to a real link click. The `download` attribute tells the browser to save the file with a specific name rather than navigating to the URL.

**Technically Speaking**
`document.createElement('a')` creates an `HTMLAnchorElement` that exists only in memory. Setting `a.download = 'filename.csv'` activates the HTML `download` attribute — without it, the browser would navigate to the `blob://` URL instead of downloading. Setting `a.href` to the object URL, then calling `a.click()`, dispatches a synthetic click event that the browser handles as if the user had clicked the link. The element never needs to be in the DOM for this to work in modern browsers (Chrome, Firefox, Safari 10.1+).

**Vue / Laravel Analogy**
In Laravel Blade with a traditional form submission, you'd use `response()->download($path)`. In Vue, there's no framework-specific download primitive — the same JavaScript `createElement('a') + .click()` pattern is used. Libraries like FileSaver.js wrap this exact pattern with cross-browser fixes. Using it directly avoids adding a dependency for something the browser handles natively.

**Common Mistakes**
1. **Adding the element to the DOM.** `document.body.appendChild(a); a.click(); document.body.removeChild(a)` is an older pattern for cross-browser compatibility. Modern browsers support the in-memory click without DOM attachment.
2. **Omitting the `download` attribute.** Without `a.download`, the browser navigates to the blob URL instead of downloading. The file name comes from this attribute — it overrides whatever name the URL has.

---

### RFC 4180 CSV escaping — handling commas and quotes in field values

**Plain English**
CSV stands for comma-separated values. If a field value contains a comma, you need to wrap it in double quotes so the parser doesn't split the field at the wrong place. If the field value also contains double quotes, you escape them by doubling them: `"` becomes `""`. This is the RFC 4180 standard that Excel, Numbers, and Google Sheets all support. Skipping the escaping works most of the time but breaks silently on descriptions like `Coffee, croissant` or `He said "hello"`.

**Technically Speaking**
```ts
`"${t.description.replace(/"/g, '""')}"`
```
The regular expression `/"/g` matches every double-quote character globally. `.replace(/"/g, '""')` replaces each with two double-quotes. The outer backtick template wraps the result in quotes. This produces RFC 4180-compliant quoting: the field is always wrapped in quotes (simpler than conditionally quoting only fields that need it), and internal quotes are doubled. `t.amount.toFixed(2)` ensures a consistent two-decimal representation rather than JavaScript's default floating-point formatting.

**Vue / Laravel Analogy**
In Laravel, `League\Csv\Writer` handles this escaping automatically. The manual regex approach is what you'd write if doing it without a library — the same escaping logic applies in any language.

**Common Mistakes**
1. **Not escaping quotes, only commas.** A description containing `"` without escaping produces malformed CSV that breaks spreadsheet parsers at seemingly random rows.
2. **Using `Number.toString()` instead of `.toFixed(2)` for amounts.** `0.1 + 0.2` in JavaScript is `0.30000000000000004`. `.toFixed(2)` rounds to the correct two decimal places.

---

## Code Walkthrough

### Building the CSV content
```ts
const header = 'Date,Description,Category,Type,Amount\n';
const rows = transactions
  .map((t) => [
    t.date,
    `"${t.description.replace(/"/g, '""')}"`,
    `"${t.category.replace(/"/g, '""')}"`,
    t.type,
    t.amount.toFixed(2),
  ].join(','))
  .join('\n');
```
Each transaction maps to an array of field strings, joined with commas into one row. All rows join with newlines. Description and category are quoted and escaped. `t.date` is already `YYYY-MM-DD` — valid CSV without quoting. `t.type` is always `'credit'` or `'debit'` — no special characters.

### The Blob → URL → click → revoke sequence
```ts
const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `${account.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-transactions.csv`;
a.click();
URL.revokeObjectURL(url);
```
Five steps in sequence. `new Blob` wraps the string in a browser-managed binary object. `createObjectURL` generates the temporary address. The `<a>` element is constructed in memory only — never added to the DOM. `.click()` queues the download. `revokeObjectURL` frees the memory. The filename sanitizer converts "Primary Checking" → `primary-checking` using a regex that replaces non-alphanumeric characters with `-`.

### The transactions source
```ts
const transactions = useTransactions(account?.id ?? '', { type: filterType, query: deferredQuery });
```
Called at the top of the component (before the early return) with the same `filterType` and `deferredQuery` the list uses. This means the CSV exports exactly what's visible — if the user has filtered to "Credits" and searched for "salary", the CSV contains only those transactions. `account?.id ?? ''` is the safe form before the `if (!account)` guard: `useTransactions` with an empty string returns `[]`, so `transactions` is never `undefined`.

---

## What to Remember

- `Blob` is an in-memory file; `URL.createObjectURL` gives it a temporary browser URL.
- Always call `URL.revokeObjectURL(url)` after `.click()` — not before — to avoid memory leaks.
- The `download` attribute on `<a>` is required to trigger a file save rather than navigation to the blob URL.
- Wrap CSV fields in double-quotes and escape internal quotes as `""` — don't assume field values are safe.
- `useTransactions` called with the same filters as `TransactionList` exports exactly what's visible — respects the user's active search and filter.
