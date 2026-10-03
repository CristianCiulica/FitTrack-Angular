import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WeatherService } from './weather.service';

describe('Weather loading', () => {
  let service: WeatherService;
  let http: HttpTestingController;
  const forecast = {
    current: { temperature_2m: 20, wind_speed_10m: 2, weathercode: 0, time: '2026-10-03T12:00' },
    hourly: {
      time: ['2026-10-03T12:00'],
      temperature_2m: [20],
      precipitation_probability: [0],
      precipitation: [0],
      weathercode: [0],
      wind_speed_10m: [2],
    },
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WeatherService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('loads location, forecast and air in parallel, then reuses nearby fresh weather', () => {
    let city = '';
    service.getWeatherByCoords(44.4, 26.1).subscribe((value) => (city = value.cityLabel));
    const reverse = http.expectOne((request) => request.url.includes('reverse-geocode'));
    const weather = http.expectOne((request) => request.url.includes('/forecast?'));
    const air = http.expectOne((request) => request.url.includes('/air-quality?'));
    weather.flush(forecast);
    air.flush({});
    reverse.flush({ city: 'Bucharest' });
    expect(city).toBe('Bucharest');
    service.getWeatherByCoords(44.40001, 26.10001).subscribe();
    http.expectNone(() => true);
  });
  it('shows the valid forecast when optional air quality fails', () => {
    let temperature = 0;
    service.getWeatherByCoords(44.4, 26.1).subscribe((value) => (temperature = value.temperature));
    http
      .expectOne((request) => request.url.includes('reverse-geocode'))
      .flush({ city: 'Bucharest' });
    http.expectOne((request) => request.url.includes('/forecast?')).flush(forecast);
    http
      .expectOne((request) => request.url.includes('/air-quality?'))
      .flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    expect(temperature).toBe(20);
  });
});

describe('Weather forecast time alignment', () => {
  it('uses the containing hour and current air quality instead of midnight or the last forecast sample', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(WeatherService);
    const http = TestBed.inject(HttpTestingController);
    let result: any;
    service.getWeatherByCoords(44.4, 26.1).subscribe((value) => (result = value));
    http
      .expectOne((request) => request.url.includes('reverse-geocode'))
      .flush({ city: 'Bucharest' });
    http
      .expectOne((request) => request.url.includes('/forecast?'))
      .flush({
        current: {
          temperature_2m: 20,
          wind_speed_10m: 2,
          weathercode: 0,
          time: '2026-10-03T14:15',
        },
        hourly: {
          time: ['2026-10-03T00:00', '2026-10-03T14:00', '2026-10-03T15:00'],
          precipitation_probability: [0, 10, 80],
          precipitation: [0, 0, 1],
          uv_index: [0, 6, 5],
        },
      });
    http
      .expectOne((request) => request.url.includes('/air-quality?'))
      .flush({
        hourly: {
          time: ['2026-10-03T00:00', '2026-10-03T14:00', '2026-10-05T00:00'],
          us_aqi: [30, 20, 180],
          pm2_5: [5, 3, 80],
        },
      });
    expect(result.uvIndex).toBe(6);
    expect(result.aqi).toBe(20);
    expect(result.pm25).toBe(3);
    expect(result.willRain).toBe(true);
    expect(result.rainProbability).toBe(80);
    http.verify();
  });
});
