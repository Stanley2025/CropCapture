/**
 * Weather Provider Interface for CropCapture
 * 
 * Allows hot-swapping weather providers (Open-Meteo, Tomorrow.io, ECMWF, Liberia Met Service)
 * without altering application business logic.
 */

import { WeatherForecast } from '../../types/weather';

export interface WeatherQueryOptions {
  districtId: string;
  districtName: string;
  countyName: string;
  latitude: number;
  longitude: number;
  apiKey?: string;
}

export interface IWeatherProvider {
  name: string;
  fetchForecast(options: WeatherQueryOptions): Promise<WeatherForecast>;
}
