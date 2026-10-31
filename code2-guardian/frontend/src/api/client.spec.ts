import { describe, expect, it, vi } from 'vitest'

import { createApiClient } from './client'

describe('guardian mini-program API client', () => {
  it('joins the configured base URL and request path', async () => {
    const request = vi.fn((options: UniApp.RequestOptions) => {
      options.success?.({ data: { status: 'ok' }, statusCode: 200, header: {}, cookies: [] })
      return {} as UniApp.RequestTask
    })
    const apiRequest = createApiClient('http://127.0.0.1:8002/', request)

    await expect(apiRequest('/health')).resolves.toEqual({ status: 'ok' })
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: 'http://127.0.0.1:8002/health' }))
  })

  it('rejects non-success responses', async () => {
    const request = vi.fn((options: UniApp.RequestOptions) => {
      options.success?.({ data: {}, statusCode: 503, header: {}, cookies: [] })
      return {} as UniApp.RequestTask
    })
    const apiRequest = createApiClient('http://127.0.0.1:8002', request)

    await expect(apiRequest('/health')).rejects.toThrow('API request failed: 503')
  })
})
