export interface DailyClicksDto {
  date: string;
  clicks: number;
}

export interface RefererHostClicksDto {
  host: string | null;
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
  referers: RefererHostClicksDto[];
  countries: CountryClicksDto[];
}
