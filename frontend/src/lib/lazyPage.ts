import { type ComponentType, lazy } from 'react'

const RELOAD_KEY = 'reloaded-for-new-version'

/**
 * React.lazy() with a fix for a classic problem after a deploy:
 * a tab opened before the update asks for an old page file (e.g. TasksPage-abc123.js) that no longer exists.
 * Then we reload the page once to get the new version, instead of showing a blank screen.
 */
export function lazyPage<T extends ComponentType>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const module = await load()
      sessionStorage.removeItem(RELOAD_KEY)
      return module
    } catch (error) {
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, '1') // guard against an endless reload loop
        window.location.reload()
        return new Promise<{ default: T }>(() => {}) // keep the spinner until the page reloads
      }
      throw error
    }
  })
}
