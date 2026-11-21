import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || '/api'
const REFRESH_PATH = '/auth/refresh'

export const AUTH_LOGOUT_EVENT = 'auth:logout'

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

let refreshPromise: Promise<void> | null = null

function refreshSession(): Promise<void> {
  refreshPromise ??= axios
    .post(`${API_URL}${REFRESH_PATH}`, {}, { withCredentials: true })
    .then(() => undefined)
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

function isRefreshable(error: AxiosError, request: RetryableRequestConfig | undefined): request is RetryableRequestConfig {
  return error.response?.status === 401 && request !== undefined && !request._retry && !request.url?.startsWith('/auth/')
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined
    if (!isRefreshable(error, originalRequest)) {
      return Promise.reject(error)
    }
    originalRequest._retry = true
    try {
      await refreshSession()
      return apiClient(originalRequest)
    } catch (refreshError) {
      window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT))
      return Promise.reject(refreshError)
    }
  },
)
