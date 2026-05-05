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
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Mocks — replace each function body with a `return request<T>(...)` call
// when the Haskell backend is ready. The signatures and return types stay the same.
// ---------------------------------------------------------------------------

export async function fetchAccounts(): Promise<Account[]> {
  // return request<Account[]>('/accounts');
  await sleep(300);
  return [];
}

export async function fetchBalances(): Promise<{ id: string; balance: number }[]> {
  // return request<{ id: string; balance: number }[]>('/accounts/balances');
  await sleep(1000);
  return [
    { id: '1', balance: round(10000 + Math.random() * 5000) },
    { id: '2', balance: round(7000 + Math.random() * 3000) },
    { id: '3', balance: round(2500 + Math.random() * 1500) },
  ];
}

export async function fetchTransactions(accountId: string): Promise<Transaction[]> {
  // return request<Transaction[]>(`/accounts/${accountId}/transactions`);
  await sleep(300);
  void accountId;
  return [];
}

export async function createAccount(data: Omit<Account, 'id'>): Promise<Account> {
  // return request<Account>('/accounts', { method: 'POST', body: JSON.stringify(data) });
  await sleep(200);
  return { ...data, id: crypto.randomUUID() };
}

export async function createTransaction(data: Omit<Transaction, 'id'>): Promise<Transaction> {
  // return request<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(data) });
  await sleep(200);
  return { ...data, id: crypto.randomUUID() };
}

export async function deleteTransaction(id: string): Promise<void> {
  // return request<void>(`/transactions/${id}`, { method: 'DELETE' });
  await sleep(200);
  void id;
}

// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
