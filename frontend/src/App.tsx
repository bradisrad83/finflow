import { Provider } from 'react-redux';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { store } from './store';
import Dashboard from './pages/Dashboard';
import AccountDetail from './pages/AccountDetail';
import usePersistStore from './hooks/usePersistStore';

function StorePersistence() {
  usePersistStore();
  return null;
}

function App() {
  return (
    <Provider store={store}>
      <StorePersistence />
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50 text-gray-900">
          <header className="border-b border-gray-100 bg-white px-8 py-4">
            <Link to="/" className="text-lg font-semibold tracking-tight text-gray-900">
              FinFlow
            </Link>
          </header>
          <main>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounts/:id" element={<AccountDetail />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </Provider>
  );
}

export default App;
