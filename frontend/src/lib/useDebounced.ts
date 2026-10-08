import { useEffect, useState } from 'react'

/** Returns `value` only after it stops changing for `delay` ms — so search does not hit the API on every key. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
