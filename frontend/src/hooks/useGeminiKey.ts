import { useState } from 'react';
import { getKey, clearKey } from '@/lib/gemini';

export function useGeminiKey() {
  const [hasKey, setHasKey] = useState(() => !!getKey());
  const markSaved = () => setHasKey(true);
  const changeKey = () => {
    clearKey();
    setHasKey(false);
  };
  return { hasKey, markSaved, changeKey };
}
