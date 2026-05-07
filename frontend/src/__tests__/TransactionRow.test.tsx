import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import TransactionRow from '../components/TransactionRow';
import type { Transaction } from '../types';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const txn: Transaction = {
  id: 't1',
  accountId: '1',
  description: 'Netflix',
  amount: 15.99,
  type: 'debit',
  date: '2026-05-07',
  category: 'Subscriptions',
};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('TransactionRow — rendering', () => {
  it('shows the transaction description', () => {
    renderWithProviders(<TransactionRow transaction={txn} onDelete={vi.fn()} onUpdate={vi.fn()} />);
    expect(screen.getByText('Netflix')).toBeTruthy();
  });

  it('shows the formatted amount', () => {
    renderWithProviders(<TransactionRow transaction={txn} onDelete={vi.fn()} onUpdate={vi.fn()} />);
    expect(screen.getByText('-$15.99')).toBeTruthy();
  });

  it('shows the category', () => {
    renderWithProviders(<TransactionRow transaction={txn} onDelete={vi.fn()} onUpdate={vi.fn()} />);
    expect(screen.getByText(/subscriptions/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// onDelete spy — callback called with correct transaction
// ---------------------------------------------------------------------------

describe('TransactionRow — delete', () => {
  it('calls onDelete with the transaction when delete button is clicked', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<TransactionRow transaction={txn} onDelete={onDelete} onUpdate={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /delete netflix/i }));

    expect(onDelete).toHaveBeenCalledWith(txn);
  });

  it('calls onDelete exactly once (stopPropagation prevents double-fire)', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<TransactionRow transaction={txn} onDelete={onDelete} onUpdate={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /delete netflix/i }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('does not call onUpdate when delete is clicked', async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<TransactionRow transaction={txn} onDelete={vi.fn()} onUpdate={onUpdate} />);

    await user.click(screen.getByRole('button', { name: /delete netflix/i }));

    expect(onUpdate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Edit mode — clicking the row switches to the edit form
// ---------------------------------------------------------------------------

describe('TransactionRow — edit mode', () => {
  it('clicking the row opens the inline edit form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionRow transaction={txn} onDelete={vi.fn()} onUpdate={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /edit netflix/i }));

    expect(screen.getByLabelText('Description')).toBeTruthy();
  });

  it('edit form is pre-filled with the current description', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionRow transaction={txn} onDelete={vi.fn()} onUpdate={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /edit netflix/i }));

    const input = screen.getByLabelText('Description') as HTMLInputElement;
    expect(input.value).toBe('Netflix');
  });
});
