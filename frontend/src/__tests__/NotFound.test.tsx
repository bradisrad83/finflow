import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from '../pages/NotFound';

// NotFound only needs MemoryRouter (for the <Link> component).
// No Redux store required — the component has no useSelector or useDispatch.

function renderNotFound() {
  return render(
    <MemoryRouter>
      <NotFound />
    </MemoryRouter>,
  );
}

describe('NotFound', () => {
  it('matches the snapshot', () => {
    const { container } = renderNotFound();
    expect(container).toMatchSnapshot();
  });
});
