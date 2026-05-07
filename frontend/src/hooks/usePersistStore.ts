import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { STORAGE_KEY } from '../store';

function usePersistStore() {
  const state = useSelector((state: RootState) => state);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);
}

export default usePersistStore;
