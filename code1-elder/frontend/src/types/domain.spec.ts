import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { demoData } from '../demo/data'

it('exposes stable domain-shaped demo data', () => {
  expect(demoData.courses[0]).toMatchObject({ id: expect.any(String), title: expect.any(String) })
  expect(demoData.family[0]?.permissions).toBeTypeOf('object')
  expect(demoData.devices[0]).toHaveProperty('battery')
  expect(demoData.services[0]).toHaveProperty('steps')
  expect(demoData.requests[0]).toHaveProperty('timeline')
})

it('keeps shared components independent from the demo data module', () => {
  const component = readFileSync(join(process.cwd(), 'src/components/CourseList.vue'), 'utf8')
  expect(component).not.toContain('../demo/data')
})
