export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8002'

type Request = typeof uni.request
type RequestOptions = Omit<UniApp.RequestOptions, 'url' | 'success' | 'fail'>

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code?: string,
    readonly fields: string[] = [],
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
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
          const payload = response.data as { error?: { code?: string; message?: string; fields?: string[] } } | undefined
          reject(
            new ApiError(
              payload?.error?.message ?? `API request failed: ${response.statusCode}`,
              response.statusCode,
              payload?.error?.code,
              payload?.error?.fields ?? [],
            ),
          )
        },
        fail(error) {
          reject(new ApiError(`API request failed: ${error.errMsg}`, null))
        },
      })
    })
  }
}

export const apiRequest = createApiClient(apiBaseUrl)
