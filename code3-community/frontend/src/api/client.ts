export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8003'

type Request = typeof uni.request
type RequestOptions = Omit<UniApp.RequestOptions, 'url' | 'success' | 'fail'>

interface FieldError {
  path: string
  code: string
  message: string
}

export class ApiError extends Error {
  statusCode: number
  code: string
  fields: FieldError[]

  constructor(statusCode: number, code: string, message: string, fields: FieldError[] = []) {
    super(message || `API request failed: ${statusCode}`)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    this.fields = fields
  }
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

function readErrorBody(data: unknown): { code: string; message: string; fields: FieldError[] } {
  if (data && typeof data === 'object' && 'error' in data) {
    const error = (data as { error: unknown }).error
    if (error && typeof error === 'object') {
      const err = error as { code?: unknown; message?: unknown; fields?: unknown }
      const fields = Array.isArray(err.fields) ? (err.fields as FieldError[]) : []
      return {
        code: typeof err.code === 'string' ? err.code : 'unknown',
        message: typeof err.message === 'string' ? err.message : '',
        fields,
      }
    }
  }
  return { code: 'unknown', message: '', fields: [] }
}

export function createApiClient(baseUrl: string, request?: Request) {
  return function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const send = request ?? uni.request
      send({
        ...options,
        url: joinUrl(baseUrl, path),
        success(response) {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(response.data as T)
            return
          }
          const { code, message, fields } = readErrorBody(response.data)
          reject(new ApiError(response.statusCode, code, message, fields))
        },
        fail(error) {
          reject(new ApiError(0, 'network', error.errMsg))
        },
      })
    })
  }
}

export const apiRequest = createApiClient(apiBaseUrl)
