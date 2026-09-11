import AsyncStorage, * as AsyncStoragePackage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, initializeAuth, type Auth, type Persistence } from "firebase/auth";
import * as FirebaseAuth from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

type AsyncStorageValue = typeof AsyncStorage;
type AsyncStorageCompatModule = typeof AsyncStoragePackage & {
  createAsyncStorage?: (name: string) => AsyncStorageValue;
  default?: AsyncStorageValue;
};
type FirebaseAuthCompatModule = typeof FirebaseAuth & {
  getReactNativePersistence?: (storage: AsyncStorageValue) => Persistence;
};

const getReactNativePersistence = (
  FirebaseAuth as FirebaseAuthCompatModule
).getReactNativePersistence;
const asyncStoragePackage = AsyncStoragePackage as AsyncStorageCompatModule;
const createAsyncStorage = asyncStoragePackage.createAsyncStorage;

const asyncStorage =
  typeof createAsyncStorage === "function"
    ? createAsyncStorage("splitverse-auth")
    : (asyncStoragePackage.default ?? AsyncStorage);

let authInstance: Auth;

try {
  if (typeof getReactNativePersistence === "function") {
    authInstance = initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(asyncStorage),
    });
  } else {
    authInstance = getAuth(firebaseApp);
  }
} catch {
  authInstance = getAuth(firebaseApp);
}

export const auth = authInstance;
