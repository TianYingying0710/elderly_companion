export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8002'

type Request = typeof uni.request
type RequestOptions = Omit<UniApp.RequestOptions, 'url' | 'success' | 'fail'>

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
          reject(new Error(`API request failed: ${response.statusCode}`))
        },
        fail(error) {
          reject(new Error(`API request failed: ${error.errMsg}`))
        },
      })
    })
  }
}

export const apiRequest = createApiClient(apiBaseUrl)
