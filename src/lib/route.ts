import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'menu' }
  | { name: 'levels' }
  | { name: 'play'; id: string }
  | { name: 'sandbox' }
  | { name: 'test' }

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/')
  if (parts[0] === 'levels') return { name: 'levels' }
  if (parts[0] === 'play' && parts[1]) return { name: 'play', id: parts[1] }
  if (parts[0] === 'sandbox') return { name: 'sandbox' }
  if (parts[0] === 'test') return { name: 'test' }
  return { name: 'menu' }
}

function subscribe(fn: () => void) {
  window.addEventListener('hashchange', fn)
  return () => window.removeEventListener('hashchange', fn)
}

const getHash = () => window.location.hash

/** Tiny hash router: screens survive a refresh and the browser back button works. */
export function useRoute(): Route {
  return parse(useSyncExternalStore(subscribe, getHash))
}

export function go(path: string) {
  window.location.hash = path
}
