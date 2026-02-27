import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { enableIndexedDbPersistence, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID
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

export { app, auth, db, persistenceReady };
