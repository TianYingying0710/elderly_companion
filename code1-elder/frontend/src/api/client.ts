export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8001'

export interface HealthPayload {
  status: 'ok'
  service: 'elder-backend'
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, init)
  if (!response.ok) throw new Error(`API request failed: ${response.status}`)
  return response.json() as Promise<T>
}

export function checkHealth(): Promise<HealthPayload> {
  return apiRequest<HealthPayload>('/health')
}
