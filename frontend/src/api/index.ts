import type { Account, Transaction } from '../types';

// Set VITE_API_URL in .env.local when the Haskell backend is running.
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function fetchAccounts(): Promise<Account[]> {
  return request<Account[]>('/accounts');
}


export async function fetchTransactions(accountId: string, signal?: AbortSignal): Promise<Transaction[]> {
  return request<Transaction[]>(`/accounts/${accountId}/transactions`, { signal });
}

export async function createAccount(account: Account): Promise<Account> {
  return request<Account>('/accounts', { method: 'POST', body: JSON.stringify(account) });
}

export async function updateAccount(account: Account): Promise<Account> {
  return request<Account>(`/accounts/${account.id}`, { method: 'PATCH', body: JSON.stringify(account) });
}

export async function createTransaction(transaction: Transaction): Promise<Transaction> {
  return request<Transaction>(
    `/accounts/${transaction.accountId}/transactions`,
    { method: 'POST', body: JSON.stringify(transaction) },
  );
}

export async function updateTransaction(transaction: Transaction): Promise<Transaction> {
  return request<Transaction>(`/transactions/${transaction.id}`, {
    method: 'PATCH',
    body: JSON.stringify(transaction),
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  return request<void>(`/transactions/${id}`, { method: 'DELETE' });
}

export async function deleteAccount(id: string): Promise<void> {
  return request<void>(`/accounts/${id}`, { method: 'DELETE' });
}

