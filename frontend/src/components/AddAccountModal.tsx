import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { AppDispatch } from '../store';
import { createAccountThunk } from '../store/accountsSlice';

interface AddAccountModalProps {
  onClose: () => void;
}

function AddAccountModal({ onClose }: AddAccountModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const formId = useId();
  const nameId = `${formId}-name`;
  const typeId = `${formId}-type`;

  const [name, setName] = useState('');
  const [type, setType] = useState<'checking' | 'savings'>('checking');

  const isValid = name.trim() !== '';
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      const account = await dispatch(
        createAccountThunk({
          id: crypto.randomUUID(),
          name: name.trim(),
          type,
          balance: 0,
        }),
      ).unwrap();
      onClose();
      navigate(`/accounts/${account.id}`);
    } catch {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" />
      <div
        className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl border border-gray-100 dark:border-gray-700 p-6 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-5">
          Add account
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor={nameId} className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Account name
              </label>
              <input
                id={nameId}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/30 focus:border-blue-300 dark:focus:border-blue-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={typeId} className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Account type
              </label>
              <select
                id={typeId}
                value={type}
                onChange={(e) => setType(e.target.value as 'checking' | 'savings')}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/30 focus:border-blue-300 dark:focus:border-blue-400"
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-50 transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || submitting}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 ${
                isValid && !submitting
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
              }`}
            >
              {submitting ? 'Adding…' : 'Add account'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default AddAccountModal;
