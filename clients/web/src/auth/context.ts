import { createContext, useContext } from 'react'
import type { User } from 'oidc-client-ts'

export type AuthContextValue = {
  user: User | null
  loading: boolean
  signIn: (returnTo: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}