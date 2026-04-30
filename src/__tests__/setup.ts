import { vi } from 'vitest'
import i18n from 'i18next'

i18n.init({ lng: 'en', resources: {} })

Object.defineProperty(window, 'core', {
  value: { fs: { readFileSync: vi.fn().mockResolvedValue('') } },
  writable: true,
})

global.requestAnimationFrame = vi.fn().mockReturnValue(1)
global.cancelAnimationFrame = vi.fn()

Object.defineProperty(global, 'performance', {
  value: { now: vi.fn().mockReturnValue(0) },
  writable: true,
})

Object.defineProperty(URL, 'createObjectURL', {
  value: vi.fn().mockReturnValue('blob:mock'),
  writable: true,
})
