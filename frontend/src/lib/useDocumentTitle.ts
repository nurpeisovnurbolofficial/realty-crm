import { useEffect } from 'react'

/** Sets the browser tab title, e.g. "Deals · Realty CRM" — handy with many tabs and in the history. */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Realty CRM` : 'Realty CRM'
  }, [title])
}
