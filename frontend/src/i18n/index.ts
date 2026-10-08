import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { setApiLanguage } from '../api/client'
import { en } from './en'
import { ru } from './ru'

export const LANGUAGES = ['en', 'ru'] as const
export type Language = (typeof LANGUAGES)[number]

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem('lang')
    if (saved === 'en' || saved === 'ru') return saved
  } catch {
    // storage can be blocked (private mode): fall back to the browser language
  }
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

const lang = initialLanguage()
setApiLanguage(lang)
document.documentElement.lang = lang

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ru: { translation: ru } },
  lng: lang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes values
})

export function changeLanguage(next: Language) {
  void i18n.changeLanguage(next)
  setApiLanguage(next) // the API answers in the same language (Accept-Language header)
  document.documentElement.lang = next
  try {
    localStorage.setItem('lang', next)
  } catch {
    // ignore: the choice just will not be remembered
  }
}

export default i18n
