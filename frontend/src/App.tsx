import { Provider } from 'react-redux';
import { store } from './store';
import AccountsOverview from './components/AccountsOverview';

function App() {
  return (
    <Provider store={store}>
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <header className="border-b border-gray-100 bg-white px-8 py-4">
          <h1 className="text-lg font-semibold tracking-tight text-gray-900">FinFlow</h1>
        </header>
        <main>
          <AccountsOverview />
        </main>
      </div>
    </Provider>
  );
}

export default App;
