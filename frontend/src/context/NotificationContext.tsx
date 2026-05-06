import { createContext, useCallback, useContext, useReducer } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface NotificationContextValue {
  addNotification: (message: string, type?: 'success' | 'error') => void;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type Action =
  | { type: 'add'; payload: Notification }
  | { type: 'remove'; payload: string };

function reducer(state: Notification[], action: Action): Notification[] {
  switch (action.type) {
    case 'add':    return [...state, action.payload];
    case 'remove': return state.filter((n) => n.id !== action.payload);
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, dispatch] = useReducer(reducer, []);

  const addNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = crypto.randomUUID();
    dispatch({ type: 'add', payload: { id, message, type } });
    setTimeout(() => dispatch({ type: 'remove', payload: id }), 3500);
  }, []);

  return (
    <NotificationContext.Provider value={{ addNotification }}>
      {children}
      {createPortal(
        <div className="fixed bottom-6 right-6 flex flex-col-reverse gap-2 z-50 pointer-events-none">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg text-sm font-medium text-white transition-all duration-200 ${
                n.type === 'success'
                  ? 'bg-emerald-600 dark:bg-emerald-500'
                  : 'bg-red-500 dark:bg-red-400'
              }`}
            >
              {n.message}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used inside <NotificationProvider>');
  return ctx;
}
