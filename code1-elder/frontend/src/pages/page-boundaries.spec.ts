import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const pages = ['account/AccountHomePage.vue','account/SettingsPage.vue','account/ProfilePage.vue','account/DevicesPage.vue','account/FamilyPage.vue','account/FamilyDetailPage.vue','account/RequestsPage.vue','account/MessagesPage.vue','account/MessageDetailPage.vue','account/ChatHistoryPage.vue','service/ServicePage.vue','service/ServiceDetailPage.vue']

it('keeps account and service responsibilities in focused pages', () => {
  for (const page of pages) expect(existsSync(join(process.cwd(), 'src/pages', page)), page).toBe(true)
  const app = readFileSync(join(process.cwd(), 'src/App.vue'), 'utf8')
  expect(app).not.toContain("./pages/AccountPage.vue")
})
