import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

interface GeoResponse {
  results?: Array<{
    name: string;
    country: string;
    admin1?: string;
    latitude: number;
    longitude: number;
  }>;
}

interface ForecastResponse {
  current?: {
    temperature_2m: number;
    wind_speed_10m: number;
    weathercode: number;
    time: string;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    precipitation: number[];
    weathercode: number[];
    wind_speed_10m: number[];
    uv_index?: number[];
  };
}

interface AirQualityResponse {
  hourly?: {
    time: string[];
    pm2_5: number[];
    pm10: number[];
    us_aqi: number[];
  };
}

export interface WeatherSummary {
  cityLabel: string;
  temperature: number;
  windSpeed: number;
  weatherCode: number;
  conditionLabel: string;
  willRain: boolean;
  rainProbability: number;
  rainWindow?: string;
  score: number;
  scoreLabel: string;
  aqi?: number;
  pm25?: number;
  uvIndex?: number;
}

interface ReverseGeoResponse {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  constructor(private http: HttpClient) {}

  // integrare Open Meteo
  getCityWeather(city: string) {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    return this.http.get<GeoResponse>(geoUrl).pipe(
      map((geo) => {
        const hit = geo.results?.[0];
        if (!hit) {
          throw new Error('City not found');
        }
        return hit;
      }),
      switchMap((hit) => {
        const cityLabel = hit.admin1 ? `${hit.name}, ${hit.admin1}` : `${hit.name}, ${hit.country}`;
        return this.fetchByCoordinates(hit.latitude, hit.longitude, cityLabel);
      }),
    );
  }

  // foloseste GPS-ul telefonului: ia vremea pentru locatia curenta, oriunde ar fi
  getWeatherByCoords(latitude: number, longitude: number) {
    const reverseUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;

    return this.http.get<ReverseGeoResponse>(reverseUrl).pipe(
      map((geo) => {
        const place = geo.city || geo.locality;
        if (place && geo.principalSubdivision) return `${place}, ${geo.principalSubdivision}`;
        if (place) return place;
        return 'Your location';
      }),
      catchError(() => of('Your location')),
      switchMap((cityLabel) => this.fetchByCoordinates(latitude, longitude, cityLabel)),
    );
  }

  private fetchByCoordinates(latitude: number, longitude: number, cityLabel: string) {
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,wind_speed_10m&hourly=temperature_2m,precipitation_probability,precipitation,weathercode,wind_speed_10m,uv_index&timezone=auto`;
    const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&hourly=pm2_5,pm10,us_aqi&timezone=auto`;

    return forkJoin({
      forecast: this.http.get<ForecastResponse>(forecastUrl),
      air: this.http.get<AirQualityResponse>(airUrl),
    }).pipe(map(({ forecast, air }) => this.buildSummary(cityLabel, forecast, air)));
  }

  private buildSummary(
    cityLabel: string,
    forecast: ForecastResponse,
    air: AirQualityResponse,
  ): WeatherSummary {
    if (!forecast.current || !forecast.hourly) {
      throw new Error('Forecast unavailable');
    }

    const currentTime = forecast.current.time;
    const currentIndex = Math.max(0, forecast.hourly.time.indexOf(currentTime));

    const rainInfo = this.findRainWindow(forecast.hourly, currentIndex);
    const conditionLabel = this.weatherCodeToLabel(forecast.current.weathercode);

    const { score, scoreLabel } = this.calculateScore({
      temp: forecast.current.temperature_2m,
      wind: forecast.current.wind_speed_10m,
      code: forecast.current.weathercode,
      willRain: rainInfo.willRain,
      aqi: this.pickLatestValue(air.hourly?.us_aqi),
    });

    return {
      cityLabel,
      temperature: forecast.current.temperature_2m,
      windSpeed: forecast.current.wind_speed_10m,
      weatherCode: forecast.current.weathercode,
      conditionLabel,
      willRain: rainInfo.willRain,
      rainProbability: rainInfo.maxProbability,
      rainWindow: rainInfo.window,
      score,
      scoreLabel,
      aqi: this.pickLatestValue(air.hourly?.us_aqi),
      pm25: this.pickLatestValue(air.hourly?.pm2_5),
      uvIndex: forecast.hourly.uv_index?.[currentIndex],
    };
  }

  private findRainWindow(hourly: ForecastResponse['hourly'], startIndex: number) {
    const horizon = Math.min(hourly.time.length, startIndex + 12);
    let maxProbability = 0;
    let firstRainIndex: number | null = null;

    for (let i = startIndex; i < horizon; i += 1) {
      const probability = hourly.precipitation_probability[i] ?? 0;
      const precip = hourly.precipitation[i] ?? 0;
      if (probability > maxProbability) maxProbability = probability;
      if ((probability >= 50 || precip > 0.1) && firstRainIndex === null) {
        firstRainIndex = i;
      }
    }

    const willRain = firstRainIndex !== null;
    const window = willRain ? this.formatHour(hourly.time[firstRainIndex!]) : undefined;

    return { willRain, maxProbability, window };
  }

  // folosim codurile default de vreme de la openAPI
  private calculateScore(params: {
    temp: number;
    wind: number;
    code: number;
    willRain: boolean;
    aqi?: number;
  }) {
    let score = 70;
    const niceCodes = [0, 1, 2];
    const rainCodes = [51, 53, 55, 61, 63, 65, 80, 81, 82];
    const snowCodes = [71, 73, 75, 77, 85, 86];

    if (niceCodes.includes(params.code) && !params.willRain) score += 15;
    if (rainCodes.includes(params.code) || params.willRain) score -= 25;
    if (snowCodes.includes(params.code)) score -= 35;

    if (params.temp >= 8 && params.temp <= 24) score += 10;
    if (params.temp <= 0 || params.temp >= 30) score -= 15;

    if (params.wind >= 8) score -= 10;
    if (params.wind >= 12) score -= 15;

    if (params.aqi && params.aqi >= 100) score -= 15;
    if (params.aqi && params.aqi >= 150) score -= 30;

    score = Math.max(0, Math.min(100, Math.round(score)));

    let scoreLabel = 'Okay';
    if (score >= 80) scoreLabel = 'Great';
    if (score < 50) scoreLabel = 'Poor';

    return { score, scoreLabel };
  }

  private weatherCodeToLabel(code: number) {
    const map: Record<number, string> = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Fog',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Light rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      71: 'Light snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      80: 'Rain showers',
      81: 'Rain showers',
      82: 'Violent rain showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with hail',
      99: 'Thunderstorm with hail',
    };
    return map[code] ?? 'Mixed conditions';
  }

  private pickLatestValue(values?: number[]) {
    if (!values || values.length === 0) return undefined;
    return values[values.length - 1];
  }

  private formatHour(time: string) {
    const date = new Date(time);
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
}
