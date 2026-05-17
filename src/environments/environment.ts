import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyCIZFrvA8Z6fwNDdLooJqXQ4-1dYOKcbGQ',
  authDomain: 'fittrack-angular-7ca07.firebaseapp.com',
  projectId: 'fittrack-angular-7ca07',
  storageBucket: 'fittrack-angular-7ca07.firebasestorage.app',
  messagingSenderId: '637608290982',
  appId: '1:637608290982:web:19cb049e5550090916e267',
  measurementId: 'G-PNELN5Z9J1',
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
