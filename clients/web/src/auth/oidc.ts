import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

function normalizeIssuer(raw?: string): string {
  if (!raw) return 'http://localhost:8080/realms/kaja'
  let url = raw.trim()
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`
  }
  return url.replace(/\/+$/, '')
}

const issuer = normalizeIssuer(import.meta.env.VITE_OIDC_ISSUER)

export const oidcUserManager = new UserManager({
  authority: issuer,
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID || 'web-app',
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: `${window.location.origin}/sign-in`,
  response_type: 'code',
  scope: 'openid profile email equipment:read rentals:read rentals:write inspections:write',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  stateStore: new WebStorageStateStore({ store: window.localStorage }),
  automaticSilentRenew: false,
  monitorSession: false,
})