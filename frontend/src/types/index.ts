export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings';
  balance: number;
}

export interface Transaction {
  id: string;
  accountId: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string;
  category: string;
}
