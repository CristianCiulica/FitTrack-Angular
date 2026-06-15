import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import {
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
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(),
    provideFirebaseApp(() => initializeApp(getFirebaseConfig())),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideNzIcons([
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
    ]),
    { provide: NZ_I18N, useValue: en_US },
  ],
};
