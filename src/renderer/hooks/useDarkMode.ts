import { useState, useEffect } from 'react';

/**
 * Hook to detect and track the system's dark mode preference.
 */
export function useDarkMode() {
  const [isDark, setIsDark] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => setIsDark(e.matches);
    
    // Support older browsers (though Electron is modern)
    if (media.addEventListener) {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    } else {
      // @ts-ignore
      media.addListener(listener);
      // @ts-ignore
      return () => media.removeListener(listener);
    }
  }, []);

  return isDark;
}
