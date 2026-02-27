import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { enableIndexedDbPersistence, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyCoyn0qBxi3LrVivIWveX_bN79XAHXglQ8',
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'gbdeeplearn.firebaseapp.com',
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'gbdeeplearn',
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'gbdeeplearn.firebasestorage.app',
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '429412358887',
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID ?? '1:429412358887:web:44d97063fa7b086d6c6042',
  measurementId: import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID ?? 'G-4T5EW8RQJV'
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let persistenceReady = Promise.resolve();

if (typeof window !== 'undefined') {
  persistenceReady = enableIndexedDbPersistence(db).catch((error) => {
    if (error.code === 'failed-precondition') {
      console.warn('Firestore persistence disabled: multiple tabs open.');
      return;
    }

    if (error.code === 'unimplemented') {
      console.warn('Firestore persistence unsupported in this browser.');
      return;
    }

    throw error;
  });
}

let analyticsReady = Promise.resolve(null);

if (typeof window !== 'undefined') {
  analyticsReady = import('firebase/analytics').then(async ({ getAnalytics, isSupported }) => {
    if (!(await isSupported())) {
      return null;
    }

    return getAnalytics(app);
  });
}

export { app, auth, db, persistenceReady, analyticsReady };
