import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import AddTransactionForm from '../components/AddTransactionForm';

// Mock createTransaction to reject immediately — avoids relying on a real
// network timeout for the error-state test.
vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return {
    ...actual,
    createTransaction: vi.fn().mockRejectedValue(new Error('API unavailable')),
  };
});

// ---------------------------------------------------------------------------
// Helper — fills the three required text fields
// ---------------------------------------------------------------------------

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Description'), 'Netflix');
  await user.type(screen.getByLabelText('Amount'), '15.99');
  await user.type(screen.getByLabelText('Category'), 'Subscriptions');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AddTransactionForm', () => {
  it('"Add" button starts disabled with empty fields', () => {
    renderWithProviders(<AddTransactionForm accountId="1" />);
    const button = screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('"Add" button enables after all required fields are filled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddTransactionForm accountId="1" />);

    await fillRequiredFields(user);

    const button = screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('clears description and amount after successful submission', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddTransactionForm accountId="1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect((screen.getByLabelText('Description') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('');
  });

  it('shows an error message when the API call fails', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddTransactionForm accountId="1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Transaction failed — please try again.')).toBeTruthy();
  });
});
