import { redirectPath } from '#api/redirects'
import type { LinkOrganization, LinkOrganizationPayload } from '#api/link-organization'
import type { AllLinkState, LinkType, ListParams, Page } from '#api/list-params'
import type { ResponseDto } from '#api/response-dto'
import { apiClient } from '#lib/api-client'

export const LINK_CHECK_ERROR_KINDS = ['dns', 'connection', 'tls', 'timeout', 'too_many_redirects', 'invalid_redirect'] as const

export type LinkCheckOutcome = 'ok' | 'broken' | 'skipped'
export type LinkCheckErrorKind = (typeof LINK_CHECK_ERROR_KINDS)[number]

export interface LinkLastCheck {
  outcome: LinkCheckOutcome
  statusCode: number | null
  errorKind: LinkCheckErrorKind | null
  checkedAt: string
  broken: boolean
}

export interface LinkCheckResult {
  id: string
  outcome: LinkCheckOutcome
  statusCode: number | null
  errorKind: LinkCheckErrorKind | null
  consecutiveFailures: number
  checkedAt: string
}

export interface LinksHealth {
  broken: number
}

export interface Link extends LinkOrganization {
  id: string
  type: 'redirect'
  destination: string | null
  expiresAt: string | null
  disabled: boolean
  lastCheck: LinkLastCheck | null
  createdAt: string
  updatedAt: string
}

export interface DailyClicks {
  date: string
  clicks: number
}

export interface RefererHostClicks {
  host: string | null
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
  referers: RefererHostClicks[]
  countries: CountryClicks[]
}

export interface CreateLinkPayload extends LinkOrganizationPayload {
  destination: string
  slug?: string
  expiresAt?: string | null
}

export interface UpdateLinkPayload extends LinkOrganizationPayload {
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

export async function listLinks(params?: ListParams): Promise<Page<Link>> {
  const { data } = await apiClient.get<ResponseDto<Page<Link>>>(LINKS_PATH, { params })
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

export async function getLinksHealth(): Promise<LinksHealth> {
  const { data } = await apiClient.get<ResponseDto<LinksHealth>>(`${LINKS_PATH}/health`)
  return data.data
}

export async function checkLink(id: string): Promise<LinkCheckResult> {
  const { data } = await apiClient.post<ResponseDto<LinkCheckResult>>(`${linkPath(id)}/check`)
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

export interface AnyLink extends LinkOrganization {
  type: LinkType
  id: string
  destination: string | null
  title: string | null
  state: AllLinkState
  expiresAt: string | null
  disabled: boolean
  createdAt: string
  updatedAt: string
}

export async function listAllLinks(params?: ListParams): Promise<Page<AnyLink>> {
  const { data } = await apiClient.get<ResponseDto<Page<AnyLink>>>(`${LINKS_PATH}/all`, { params })
  return data.data
}
