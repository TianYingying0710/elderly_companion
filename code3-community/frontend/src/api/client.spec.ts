import { describe, expect, it, vi } from 'vitest'

import { createApiClient } from './client'

describe('community mini-program API client', () => {
  it('joins the configured base URL and request path', async () => {
    const request = vi.fn((options: UniApp.RequestOptions) => {
      options.success?.({ data: { status: 'ok' }, statusCode: 200, header: {}, cookies: [] })
      return {} as UniApp.RequestTask
    })
    const apiRequest = createApiClient('http://127.0.0.1:8003/', request)

    await expect(apiRequest('/health')).resolves.toEqual({ status: 'ok' })
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: 'http://127.0.0.1:8003/health' }))
  })

  it('rejects non-success responses', async () => {
    const request = vi.fn((options: UniApp.RequestOptions) => {
      options.success?.({ data: {}, statusCode: 503, header: {}, cookies: [] })
      return {} as UniApp.RequestTask
    })
    const apiRequest = createApiClient('http://127.0.0.1:8003', request)

    await expect(apiRequest('/health')).rejects.toThrow('API request failed: 503')
  })

  it('surfaces the backend error code and field paths for validation failures', async () => {
    const request = vi.fn((options: UniApp.RequestOptions) => {
      options.success?.({
        data: {
          error: {
            code: 'validation_failed',
            message: '请求参数不合法',
            fields: [{ path: 'body.result', code: 'missing', message: 'Field required' }],
          },
        },
        statusCode: 422,
        header: {},
        cookies: [],
      })
      return {} as UniApp.RequestTask
    })
    const apiRequest = createApiClient('http://127.0.0.1:8003', request)

    await expect(apiRequest('/rescue-incidents/1/transitions')).rejects.toMatchObject({
      statusCode: 422,
      code: 'validation_failed',
      fields: [{ path: 'body.result', code: 'missing', message: 'Field required' }],
    })
  })
})
