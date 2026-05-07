import { render } from '@testing-library/react';
import type { RenderOptions, RenderResult } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import type { EnhancedStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ComponentType, ReactElement, ReactNode } from 'react';
import accountsReducer from '../store/accountsSlice';
import type { AccountsState } from '../store/accountsSlice';
import transactionsReducer from '../store/transactionsSlice';
import type { TransactionsState } from '../store/transactionsSlice';
import { NotificationProvider } from '../context/NotificationContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PreloadedState {
  accounts?: Partial<AccountsState>;
  transactions?: Partial<TransactionsState>;
}

interface WrapperOptions {
  preloadedState?: PreloadedState;
  /** Starting URL for the router. Defaults to '/'. */
  initialPath?: string;
  /**
   * Route pattern to match against. Required when the component under test
   * calls useParams().
   * @example routePath="/accounts/:id"
   */
  routePath?: string;
}

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'>, WrapperOptions {}

interface RenderWithProvidersResult extends RenderResult {
  store: EnhancedStore;
}

// ---------------------------------------------------------------------------
// createWrapper — returns the Wrapper component + configured store.
// Use this when you need to pass a wrapper to renderHook.
// ---------------------------------------------------------------------------

export function createWrapper(options: WrapperOptions = {}): {
  wrapper: ComponentType<{ children: ReactNode }>;
  store: EnhancedStore;
} {
  const { preloadedState, initialPath = '/', routePath } = options;

  const store = configureStore({
    reducer: { accounts: accountsReducer, transactions: transactionsReducer },
    preloadedState: preloadedState
      ? {
          accounts: { accounts: [], loading: false, error: null, ...preloadedState.accounts },
          transactions: { transactions: [], loading: false, error: null, ...preloadedState.transactions },
        }
      : undefined,
  });

  function Wrapper({ children }: { children: ReactNode }) {
    const routerContent = routePath ? (
      <Routes>
        <Route path={routePath} element={<>{children}</>} />
      </Routes>
    ) : (
      <>{children}</>
    );

    return (
      <Provider store={store}>
        <NotificationProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            {routerContent}
          </MemoryRouter>
        </NotificationProvider>
      </Provider>
    );
  }

  return { wrapper: Wrapper, store };
}

// ---------------------------------------------------------------------------
// renderWithProviders — wraps RTL's render with all providers.
// Use this for component tests.
// ---------------------------------------------------------------------------

/**
 * Custom render with the full provider stack: Redux, NotificationProvider, MemoryRouter.
 * Returns everything RTL's render returns, plus the store.
 *
 * For hooks that need providers, use createWrapper instead:
 * @example
 * const { wrapper } = createWrapper({ preloadedState: { ... } });
 * const { result } = renderHook(() => useMyHook(), { wrapper });
 */
export function renderWithProviders(
  ui: ReactElement,
  { preloadedState, initialPath, routePath, ...renderOptions }: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const { wrapper: Wrapper, store } = createWrapper({ preloadedState, initialPath, routePath });
  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
