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

  it('preserves structured backend error details', async () => {
    const request = vi.fn((options: UniApp.RequestOptions) => {
      options.success?.({
        data: { error: { code: 'health_data_source_unavailable', message: '健康数据源尚未接入', fields: [] } },
        statusCode: 503,
        header: {},
        cookies: [],
      })
      return {} as UniApp.RequestTask
    })
    const apiRequest = createApiClient('http://127.0.0.1:8002', request)

    await expect(apiRequest('/health-overview/elder_1')).rejects.toMatchObject({
      status: 503,
      code: 'health_data_source_unavailable',
      message: '健康数据源尚未接入',
      fields: [],
    })
  })
})
