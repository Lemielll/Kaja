import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { User } from 'oidc-client-ts'
import { setAccessToken, setUnauthorizedHandler } from '../lib/api'
import { AuthContext } from './context'
import { oidcUserManager } from './oidc'

function safeReturnTo(path: string | null) {
  return path?.startsWith('/') && !path.startsWith('//') && path !== '/callback'
    ? path
    : '/rentals'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const callbackResult = useRef<Promise<User> | null>(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    const restoreSession = async () => {
      try {
        if (location.pathname === '/callback') {
          callbackResult.current ??= oidcUserManager.signinRedirectCallback()
          const callbackUser = await callbackResult.current
          if (!active) return
          setUser(callbackUser)
          setAccessToken(callbackUser.access_token)
          const returnTo = safeReturnTo(sessionStorage.getItem('kaja:return-to'))
          sessionStorage.removeItem('kaja:return-to')
          navigate(returnTo, { replace: true })
        } else {
          const storedUser = await oidcUserManager.getUser()
          if (!active) return
          const activeUser = storedUser && !storedUser.expired ? storedUser : null
          setUser(activeUser)
          setAccessToken(activeUser?.access_token ?? null)
        }
      } catch {
        if (!active) return
        setUser(null)
        setAccessToken(null)
        navigate('/sign-in', { replace: true, state: { loginFailed: true } })
      } finally {
        if (active) setLoading(false)
      }
    }

    void restoreSession()
    return () => { active = false }
  }, [location.pathname, navigate])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      sessionStorage.setItem('kaja:return-to', `${location.pathname}${location.search}`)
      setUser(null)
      setAccessToken(null)
      void oidcUserManager.removeUser()
      navigate('/sign-in', { replace: true, state: { sessionExpired: true } })
    })

    return () => setUnauthorizedHandler(null)
  }, [location.pathname, location.search, navigate])

  const signIn = async (returnTo: string) => {
    sessionStorage.setItem('kaja:return-to', safeReturnTo(returnTo))
    await oidcUserManager.signinRedirect()
  }

  const signOut = async () => {
    setAccessToken(null)
    setUser(null)
    try {
      await oidcUserManager.signoutRedirect()
    } catch {
      await oidcUserManager.removeUser()
      navigate('/sign-in', { replace: true })
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}