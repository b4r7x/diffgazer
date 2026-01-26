import { type ReactNode } from 'react'
import { ConfigProvider, useConfigContext } from './config-provider'

export { useConfigContext }

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ConfigProvider>
      {children}
    </ConfigProvider>
  )
}
