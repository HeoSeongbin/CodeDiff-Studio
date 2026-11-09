import { useEffect, useState } from 'react';
export function useNarrowScreen() {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 800px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 800px)');
    const change = () => setNarrow(media.matches);
    media.addEventListener('change', change);
    change();
    return () => media.removeEventListener('change', change);
  }, []);
  return narrow;
}
