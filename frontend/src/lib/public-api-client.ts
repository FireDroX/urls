import axios from 'axios'
import { API_URL } from '#lib/api-client'

export const publicApiClient = axios.create({ baseURL: API_URL })
