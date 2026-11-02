import { redirectPath } from '#api/redirects'
import type { ResponseDto } from '#api/response-dto'
import { apiClient } from '#lib/api-client'

export interface Link {
  id: string
  type: 'redirect'
  destination: string | null
  expiresAt: string | null
  disabled: boolean
  createdAt: string
  updatedAt: string
}

export interface DailyClicks {
  date: string
  clicks: number
}

export interface RefererClicks {
  referer: string | null
  clicks: number
}

export interface CountryClicks {
  country: string | null
  clicks: number
}

export interface LinkStats {
  id: string
  days: number
  since: string
  timeZone: string
  total: number
  daily: DailyClicks[]
  referers: RefererClicks[]
  countries: CountryClicks[]
}

export interface CreateLinkPayload {
  destination: string
  slug?: string
  expiresAt?: string | null
}

export interface UpdateLinkPayload {
  destination?: string
  slug?: string
  expiresAt?: string | null
  disabled?: boolean
}

const LINKS_PATH = '/links'

function linkPath(id: string): string {
  return `${LINKS_PATH}/${encodeURIComponent(id)}`
}

export function linkUrl(id: string, origin = window.location.origin): string {
  return `${origin}${redirectPath(id)}`
}

export async function listLinks(): Promise<Link[]> {
  const { data } = await apiClient.get<ResponseDto<Link[]>>(LINKS_PATH)
  return data.data
}

export async function getLink(id: string, signal?: AbortSignal): Promise<Link> {
  const { data } = await apiClient.get<ResponseDto<Link>>(linkPath(id), { signal })
  return data.data
}

export async function getLinkStats(id: string, days: number, signal?: AbortSignal): Promise<LinkStats> {
  const { data } = await apiClient.get<ResponseDto<LinkStats>>(`${linkPath(id)}/stats`, { params: { days }, signal })
  return data.data
}

export async function createLink(payload: CreateLinkPayload): Promise<Link> {
  const { data } = await apiClient.post<ResponseDto<Link>>(LINKS_PATH, payload)
  return data.data
}

export async function updateLink(id: string, payload: UpdateLinkPayload): Promise<Link> {
  const { data } = await apiClient.patch<ResponseDto<Link>>(linkPath(id), payload)
  return data.data
}

export async function deleteLink(id: string): Promise<void> {
  await apiClient.delete(linkPath(id))
}
