'use client';

import { useContext } from 'react';
import { ThemeContext } from '@/app/providers/theme-provider';
import type { ThemeContextValue } from '@/types/theme';

const defaultValue: ThemeContextValue = {
  theme: 'auto',
  resolved: 'dark',
  setTheme: () => {},
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  return context ?? defaultValue;
}
