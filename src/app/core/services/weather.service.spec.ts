import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WeatherService } from './weather.service';

describe('Weather loading', () => {
  let service: WeatherService;
  let http: HttpTestingController;
  const forecast = { current: { temperature_2m: 20, wind_speed_10m: 2, weathercode: 0, time: '2026-10-03T12:00' },
    hourly: { time: ['2026-10-03T12:00'], temperature_2m: [20], precipitation_probability: [0], precipitation: [0], weathercode: [0], wind_speed_10m: [2] } };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(WeatherService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('loads location, forecast and air in parallel, then reuses nearby fresh weather', () => {
    let city = '';
    service.getWeatherByCoords(44.4, 26.1).subscribe(value => city = value.cityLabel);
    const reverse = http.expectOne(request => request.url.includes('reverse-geocode'));
    const weather = http.expectOne(request => request.url.includes('/forecast?'));
    const air = http.expectOne(request => request.url.includes('/air-quality?'));
    weather.flush(forecast); air.flush({}); reverse.flush({ city: 'Bucharest' });
    expect(city).toBe('Bucharest');
    service.getWeatherByCoords(44.40001, 26.10001).subscribe();
    http.expectNone(() => true);
  });
  it('shows the valid forecast when optional air quality fails', () => {
    let temperature = 0;
    service.getWeatherByCoords(44.4, 26.1).subscribe(value => temperature = value.temperature);
    http.expectOne(request => request.url.includes('reverse-geocode')).flush({ city: 'Bucharest' });
    http.expectOne(request => request.url.includes('/forecast?')).flush(forecast);
    http.expectOne(request => request.url.includes('/air-quality?')).flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    expect(temperature).toBe(20);
  });
});
