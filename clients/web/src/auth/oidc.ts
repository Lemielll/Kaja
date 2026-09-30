import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

const issuer = import.meta.env.VITE_OIDC_ISSUER || 'http://localhost:8080/realms/kaja'

export const oidcUserManager = new UserManager({
  authority: issuer,
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID || 'web-app',
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: `${window.location.origin}/sign-in`,
  response_type: 'code',
  scope: 'openid profile email equipment:read rentals:read rentals:write inspections:write',
  userStore: new WebStorageStateStore({ store: new MemoryStorage() }),
  automaticSilentRenew: false,
  monitorSession: false,
})