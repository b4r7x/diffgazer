import { type ReactNode } from 'react'
import { ConfigProvider, useConfigContext } from './config-provider'
import { KeyboardProvider } from '@/components/keyboard'

export { useConfigContext }

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ConfigProvider>
      <KeyboardProvider>
        {children}
      </KeyboardProvider>
    </ConfigProvider>
  )
}
