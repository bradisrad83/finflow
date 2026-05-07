import { useDeferredValue, useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../store';
import { fetchTransactions } from '../store/transactionsSlice';
import { deleteAccountThunk, renameAccountThunk } from '../store/accountsSlice';
import { selectAccountById, selectTransactionsLoading, selectTransactionsError } from '../store/selectors';
import { useNotification } from '../context/NotificationContext';
import TransactionList from '../components/TransactionList';
import useTransactions from '../hooks/useTransactions';
import Input from '../components/Input';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

type FilterType = 'all' | 'credit' | 'debit';

function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const account = useSelector(selectAccountById(id ?? ''));

  useDocumentTitle(account?.name ?? 'FinFlow');

  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  const txLoading = useSelector(selectTransactionsLoading);
  const txError = useSelector(selectTransactionsError);

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const renameRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (editing) {
      renameRef.current?.focus();
      renameRef.current?.select();
    }
  }, [editing]);

  async function handleDelete() {
    if (!account) return;
    setDeleting(true);
    try {
      await dispatch(deleteAccountThunk(account.id)).unwrap();
      addNotification(`"${account.name}" deleted`);
      navigate('/');
    } catch {
      setDeleteError('Failed to delete account. Please try again.');
      setDeleting(false);
      setConfirming(false);
    }
  }

  async function handleRename() {
    if (!account) return;
    const trimmed = draft.trim();
    if (!trimmed || trimmed === account.name) { setEditing(false); return; }
    try {
      await dispatch(renameAccountThunk({ ...account, name: trimmed })).unwrap();
      addNotification('Account renamed');
    } finally {
      setEditing(false);
    }
  }

  const searchRef = useRef<HTMLInputElement>(null);

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [isPending, startTransition] = useTransition();

  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;
  const transactions = useTransactions(account?.id ?? '', { type: filterType, query: deferredQuery });

  useEffect(() => {
    if (!id) return;
    const promise = dispatch(fetchTransactions(id));
    return () => { promise.abort(); };
  }, [id, dispatch]);

  useEffect(() => {
    if (!txLoading) searchRef.current?.focus();
  }, [txLoading]);

  if (!account) {
    return (
      <section className="px-8 py-10">
        <Link to="/" className="text-sm text-blue-500 dark:text-blue-400 hover:underline">
          &larr; Back to dashboard
        </Link>
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">Account not found.</p>
      </section>
    );
  }

  const formattedBalance = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(account.balance);

  function downloadCSV() {
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
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${account.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-transactions.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'credit', label: 'Credits' },
    { value: 'debit', label: 'Debits' },
  ];

  return (
    <section className="px-8 py-10">
      <Link to="/" className="text-sm text-blue-500 dark:text-blue-400 hover:underline">
        &larr; Back to dashboard
      </Link>
      <div className="mt-6 mb-2">
        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest font-medium">
          {account.type}
        </p>
        {editing ? (
          <input
            ref={renameRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-50 bg-transparent border-b-2 border-blue-400 focus:outline-none w-full"
          />
        ) : (
          <h2
            className="text-2xl font-semibold text-gray-900 dark:text-gray-50 mt-1 cursor-pointer hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-150"
            onClick={() => { setDraft(account.name); setEditing(true); }}
            title="Click to rename"
          >
            {account.name}
          </h2>
        )}
        <p className="text-3xl font-semibold text-gray-900 dark:text-gray-50 tracking-tight mt-2">
          {formattedBalance}
        </p>
      </div>
      <div className="mt-6 flex items-center gap-3">
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-150"
          >
            Delete account
          </button>
        ) : (
          <>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Delete this account and all its transactions?
            </span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-semibold text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 disabled:opacity-50 transition-colors duration-150"
            >
              {deleting ? 'Deleting…' : 'Confirm delete'}
            </button>
            <button
              type="button"
              onClick={() => { setConfirming(false); setDeleteError(null); }}
              className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-150"
            >
              Cancel
            </button>
          </>
        )}
        {deleteError && (
          <span className="text-xs text-red-500 dark:text-red-400">{deleteError}</span>
        )}
      </div>
      <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1 shadow-sm">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => startTransition(() => setFilterType(option.value))}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-all duration-150 ${
                filterType === option.value
                  ? `bg-blue-500 text-white ${isPending ? 'opacity-60' : 'opacity-100'}`
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Input
          ref={searchRef}
          type="text"
          placeholder="Search description"
          value={query}
          onChange={(e) => setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              if (e.target.value) next.set('q', e.target.value);
              else next.delete('q');
              return next;
            })}
          className="flex-1 shadow-sm"
        />
        <button
          type="button"
          onClick={downloadCSV}
          disabled={transactions.length === 0}
          className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 hover:text-blue-500 dark:hover:border-blue-400 dark:hover:text-blue-400 shadow-sm transition-colors duration-150 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Export CSV
        </button>
      </div>
      {txError && (
        <p className="mt-6 text-sm text-red-500 dark:text-red-400">{txError}</p>
      )}
      {txLoading ? (
        <p className="mt-8 text-sm text-gray-400 dark:text-gray-500">Loading transactions…</p>
      ) : (
        <div className={`transition-opacity duration-200 ${isStale ? 'opacity-50' : 'opacity-100'}`}>
          <TransactionList accountId={account.id} filters={{ type: filterType, query: deferredQuery }} />
        </div>
      )}
    </section>
  );
}

export default AccountDetail;
