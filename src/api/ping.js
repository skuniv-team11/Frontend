import { request } from './client'

export const fetchPing = (signal) => request('/api/ping', { signal })
