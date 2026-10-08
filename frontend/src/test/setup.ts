import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Unmount rendered components after every test (automatic only with `globals: true`).
afterEach(cleanup)
