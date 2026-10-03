import { ApplicationConfig, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withPreloading } from '@angular/router';
import { IdlePreloadingService } from './core/services/idle-preloading.service';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { firebaseAuthInterceptor } from './core/interceptors/auth.interceptor';
import { provideServiceWorker } from '@angular/service-worker';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import {
  LineChartOutline,
  CalendarOutline,
  DashboardOutline,
  DeleteOutline,
  EditOutline,
  FileExcelOutline,
  FilePdfOutline,
  FireOutline,
  InboxOutline,
  PlusOutline,
  RiseOutline,
  SearchOutline,
  ThunderboltOutline,
  TrophyOutline,
  UserOutline,
  PlayCircleOutline,
  CheckCircleOutline,
  CheckOutline,
  ForwardOutline,
  HeartOutline,
  CloseOutline,
  EyeInvisibleOutline,
  EyeOutline,
  SettingOutline,
  LogoutOutline,
  GlobalOutline,
  DownloadOutline,
  LoadingOutline,
  HeartFill,
  MessageOutline,
  ReloadOutline,
  ArrowLeftOutline,
  ArrowRightOutline,
  PlayCircleFill,
  BulbOutline,
  UpOutline,
  DownOutline,
  FilterOutline,
  IdcardOutline,
  CameraOutline,
} from '@ant-design/icons-angular/icons';
import { getFirebaseConfig } from './core/config/runtime-config';
import { routes } from './app.routes';
import { NZ_I18N, en_US } from 'ng-zorro-antd/i18n';
import { registerLocaleData } from '@angular/common';
import en from '@angular/common/locales/en';

registerLocaleData(en);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }), withPreloading(IdlePreloadingService)),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([firebaseAuthInterceptor])),
    // PWA service worker
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    // Firebase/Auth
    provideFirebaseApp(() => initializeApp(getFirebaseConfig())),
    provideAuth(() => getAuth()),

    provideNzIcons([
      LineChartOutline,
  CalendarOutline,
      DashboardOutline,
      DeleteOutline,
      EditOutline,
      FileExcelOutline,
      FilePdfOutline,
      FireOutline,
      InboxOutline,
      PlusOutline,
      RiseOutline,
      SearchOutline,
      ThunderboltOutline,
      TrophyOutline,
      UserOutline,
      PlayCircleOutline,
      CheckCircleOutline,
      CheckOutline,
      ForwardOutline,
      HeartOutline,
      CloseOutline,
      EyeOutline,
      EyeInvisibleOutline,
      SettingOutline,
      LogoutOutline,
      GlobalOutline,
      DownloadOutline,
      LoadingOutline,
      HeartFill,
      MessageOutline,
      ReloadOutline,
      ArrowLeftOutline,
  ArrowRightOutline,
  PlayCircleFill,
  BulbOutline,
  UpOutline,
  DownOutline,
      FilterOutline,
      IdcardOutline,
      CameraOutline,
    ]),
    { provide: NZ_I18N, useValue: en_US },
  ],
};
