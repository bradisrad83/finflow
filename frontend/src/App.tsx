import { Provider } from 'react-redux';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { store } from './store';
import Dashboard from './pages/Dashboard';
import AccountDetail from './pages/AccountDetail';
import usePersistStore from './hooks/usePersistStore';
import { ThemeProvider, useTheme } from './context/ThemeContext';

function StorePersistence() {
  usePersistStore();
  return null;
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:border-blue-300 hover:text-blue-500 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors duration-150"
    >
      {isDark ? 'Light mode' : 'Dark mode'}
    </button>
  );
}

function App() {
  return (
    <Provider store={store}>
      <StorePersistence />
      <ThemeProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-150">
            <header className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 px-8 py-4 flex items-center justify-between">
              <Link to="/" className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                FinFlow
              </Link>
              <ThemeToggle />
            </header>
            <main>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/accounts/:id" element={<AccountDetail />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  );
}

export default App;
