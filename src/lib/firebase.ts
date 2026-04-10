import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
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

// Check if Firebase config is valid
const isFirebaseConfigValid = () => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.authDomain &&
    firebaseConfig.apiKey !== 'your_api_key_here'
  );
};

// Singleton pattern to prevent multiple initializations in Next.js dev mode
let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;
let storage: FirebaseStorage | undefined;
let rtdb: Database | null = null;

// Only initialize Firebase on the client side and if config is valid
if (typeof window !== 'undefined' && isFirebaseConfigValid()) {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      
      // Initialize Firestore with modern persistent cache only ONCE
      try {
        db = initializeFirestore(app, {
          localCache: persistentLocalCache({ 
            tabManager: persistentMultipleTabManager() 
          })
        });
      } catch (firestoreError) {
        console.error("Error initializing Firestore with cache:", firestoreError);
        // Fallback to standard Firestore without cache
        db = getFirestore(app);
      }
    } else {
      app = getApp();
      try {
        db = getFirestore(app);
      } catch (firestoreError) {
        console.error("Error getting Firestore instance:", firestoreError);
      }
    }

    if (app) {
      auth = getAuth(app);
      storage = getStorage(app);
      
      // Initialize RTDB only if URL is valid
      if (firebaseConfig.databaseURL && firebaseConfig.databaseURL.startsWith('https://') && firebaseConfig.databaseURL !== 'https://your-database-url.firebaseio.com') {
        try {
          rtdb = getDatabase(app);
        } catch (error) {
          console.warn("RTDB Init failed - continuing without realtime database:", error);
          rtdb = null;
        }
      }
    }
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
} else if (typeof window !== 'undefined') {
  console.warn('Firebase configuration is missing or invalid. Check your environment variables.');
  console.warn('Expected config:', {
    hasApiKey: !!firebaseConfig.apiKey,
    hasProjectId: !!firebaseConfig.projectId,
    hasAuthDomain: !!firebaseConfig.authDomain,
  });
}

// Helper function to check if Firebase is initialized
export const isFirebaseInitialized = () => {
  return !!(app && db && auth && storage);
};

// Helper function to get db with error handling
export const getDb = (): Firestore => {
  if (!db) {
    throw new Error('Firestore is not initialized. Please check your Firebase configuration.');
  }
  return db;
};

// Helper function to get auth with error handling
export const getAuthInstance = (): Auth => {
  if (!auth) {
    throw new Error('Auth is not initialized. Please check your Firebase configuration.');
  }
  return auth;
};

// Helper function to get storage with error handling
export const getStorageInstance = (): FirebaseStorage => {
  if (!storage) {
    throw new Error('Storage is not initialized. Please check your Firebase configuration.');
  }
  return storage;
};

export { app, auth, storage, rtdb, db };
