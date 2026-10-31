import { afterEach, expect, it, vi } from 'vitest'
import { useElderApp } from './useElderApp'
afterEach(() => vi.unstubAllEnvs())
it('starts without demo records when disabled in build configuration', () => {
  vi.stubEnv('VITE_DEMO_MODE', 'false')
  const app=useElderApp()
  expect(app.state.demo).toBe(false)
  expect(app.state.data).toBeNull()
  app.help(); expect(app.state.modal).toBeNull()
  app.state.draft='hello'; app.send(); expect(app.state.messages).toEqual([])
})
it('restores the selected detail when returning from a nested page', () => {
  const app=useElderApp()
  app.go('message-detail','help'); app.go('requests'); app.back()
  expect(app.state.page).toBe('message-detail')
  expect(app.state.selected).toBe('help')
})
it('guards invalid SOS transitions and creates a new record after cancellation', () => {
  const app=useElderApp()
  app.help(); app.startHelp(); app.progress('responded')
  expect(app.state.sos).toBe('sending')
  app.help(); expect(app.state.modal).toBeNull()
  const count=app.state.data!.requests.length
  app.state.modal='cancel'; app.cancelHelp(); app.help(); app.startHelp()
  expect(app.state.data!.requests).toHaveLength(count+1)
  expect(app.state.sos).toBe('sending')
  app.toggleDemo(); expect(app.state.currentRequest).toBeNull()
  app.toggleDemo(); expect(app.state.data!.requests).toHaveLength(1)
})
