export interface DailyClicksDto {
  date: string;
  clicks: number;
}

export interface RefererClicksDto {
  referer: string | null;
  clicks: number;
}

export interface CountryClicksDto {
  country: string | null;
  clicks: number;
}

export interface LinkStatsResponseDto {
  id: string;
  days: number;
  since: string;
  timeZone: string;
  total: number;
  daily: DailyClicksDto[];
  referers: RefererClicksDto[];
  countries: CountryClicksDto[];
}
