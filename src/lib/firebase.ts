import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAuth, Auth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "fintrack-tpsds.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Singleton pattern to prevent multiple initializations in Next.js dev mode
let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let storage: FirebaseStorage;
let rtdb: Database | null = null;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  // Initialize Firestore with modern persistent cache only ONCE
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ 
      tabManager: persistentMultipleTabManager() 
    })
  });
} else {
  app = getApp();
  db = getFirestore(app);
}

auth = getAuth(app);
storage = getStorage(app);

if (firebaseConfig.databaseURL && firebaseConfig.databaseURL.startsWith('https://')) {
    try {
        rtdb = getDatabase(app);
    } catch (error) {
        console.warn("RTDB Init failed", error);
    }
}

export { app, auth, storage, rtdb, db };
export const getDb = (): Firestore => db;
