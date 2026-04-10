import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, Database, connectDatabaseEmulator } from 'firebase/database';

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
  if (typeof window === 'undefined') return false;
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.authDomain &&
    firebaseConfig.apiKey !== 'your_api_key_here' &&
    firebaseConfig.apiKey !== 'AIzaSyAvTjHbX2PpC_i4WgsGhTXIRDiDSWPANrc' // Check if it's the actual key
  );
};

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development';

// Singleton pattern to prevent multiple initializations in Next.js dev mode
let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;
let storage: FirebaseStorage | undefined;
let rtdb: Database | null = null;

// Export the configured flag
export const isFirebaseConfigured = isFirebaseConfigValid();

// Only initialize Firebase on the client side and if config is valid
if (typeof window !== 'undefined' && isFirebaseConfigured) {
  try {
    if (!getApps().length) {
      console.log('Initializing Firebase app...');
      app = initializeApp(firebaseConfig);
      
      // Initialize Firestore with modern persistent cache only ONCE
      try {
        db = initializeFirestore(app, {
          localCache: persistentLocalCache({ 
            tabManager: persistentMultipleTabManager() 
          })
        });
        console.log('Firestore initialized with persistent cache');
      } catch (firestoreError) {
        console.error("Error initializing Firestore with cache:", firestoreError);
        // Fallback to standard Firestore without cache
        db = getFirestore(app);
        console.log('Firestore initialized without cache (fallback)');
      }
    } else {
      console.log('Using existing Firebase app');
      app = getApp();
      try {
        db = getFirestore(app);
        console.log('Firestore instance retrieved');
      } catch (firestoreError) {
        console.error("Error getting Firestore instance:", firestoreError);
      }
    }

    if (app) {
      // Initialize Auth
      auth = getAuth(app);
      console.log('Auth initialized');
      
      // Initialize Storage
      storage = getStorage(app);
      console.log('Storage initialized');
      
      // Initialize RTDB only if URL is valid and exists
      if (firebaseConfig.databaseURL && 
          firebaseConfig.databaseURL.startsWith('https://') && 
          firebaseConfig.databaseURL !== 'https://your-database-url.firebaseio.com' &&
          firebaseConfig.databaseURL !== 'https://fintrack-tpsds-default-rtdb.firebaseio.com') {
        try {
          rtdb = getDatabase(app);
          console.log('Realtime Database initialized');
        } catch (error) {
          console.warn("RTDB Init failed - continuing without realtime database:", error);
          rtdb = null;
        }
      } else {
        console.log('No valid databaseURL provided, skipping RTDB initialization');
        rtdb = null;
      }

      // Optional: Connect to emulators in development
      if (isDev && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        try {
          // Uncomment these if you want to use Firebase emulators locally
          // connectFirestoreEmulator(db, 'localhost', 8080);
          // connectAuthEmulator(auth, 'http://localhost:9099');
          // connectStorageEmulator(storage, 'localhost', 9199);
          // if (rtdb) connectDatabaseEmulator(rtdb, 'localhost', 9000);
          console.log('Development mode: Emulators available (commented out)');
        } catch (emulatorError) {
          console.warn('Failed to connect to emulators:', emulatorError);
        }
      }
    }
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
} else if (typeof window !== 'undefined') {
  console.warn('Firebase configuration is missing or invalid. Check your environment variables.');
  console.warn('Current config status:', {
    hasApiKey: !!firebaseConfig.apiKey,
    hasProjectId: !!firebaseConfig.projectId,
    hasAuthDomain: !!firebaseConfig.authDomain,
    apiKeyValue: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'missing',
  });
}

// Helper function to check if Firebase is initialized
export const isFirebaseInitialized = (): boolean => {
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

// Helper function to get RTDB with error handling
export const getRtdb = (): Database | null => {
  return rtdb;
};

// Helper function to wait for Firebase initialization
export const waitForFirebase = (timeout: number = 10000): Promise<boolean> => {
  return new Promise((resolve) => {
    if (isFirebaseInitialized()) {
      resolve(true);
      return;
    }
    
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (isFirebaseInitialized()) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        console.error('Firebase initialization timeout');
        resolve(false);
      }
    }, 100);
  });
};

// Export all instances
export { app, auth, storage, rtdb, db };
