import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <section className="px-8 py-20 flex flex-col items-center text-center">
      <p className="text-6xl font-semibold text-gray-200 dark:text-gray-700 select-none">
        404
      </p>
      <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-50">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
        The URL you entered doesn&apos;t match any page in FinFlow.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-lg px-4 py-2 text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors duration-150 shadow-sm"
      >
        Back to dashboard
      </Link>
    </section>
  );
}

export default NotFound;
