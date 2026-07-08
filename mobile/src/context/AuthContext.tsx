import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import {
  getCurrentDbUser,
  requestEmailLoginOtp,
  syncCurrentUser,
  verifyEmailLoginOtp,
  type DbUser,
  type EmailLoginOtpSession,
} from "../lib/api";
import {
  clearSessionActivity,
  isSessionExpired,
  touchSessionActivity,
} from "../lib/session";

type AuthContextValue = {
  user: User | null;
  dbUser: DbUser | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  loginWithGoogleIdToken: (idToken: string) => Promise<void>;
  startEmailLoginOtp: (email: string, password: string) => Promise<EmailLoginOtpSession>;
  completeEmailLoginWithOtp: (
    email: string,
    password: string,
    sessionId: string,
    otp: string,
  ) => Promise<void>;
  refreshDbUser: () => Promise<DbUser | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  async function refreshDbUser() {
    if (!auth.currentUser) {
      setDbUser(null);
      return null;
    }

    try {
      const response = await getCurrentDbUser();
      setDbUser(response.user);
      return response.user;
    } catch {
      const synced = await syncCurrentUser();
      setDbUser(synced.user);
      return synced.user;
    }
  }

  async function logout() {
    setDbUser(null);
    await clearSessionActivity();
    await signOut(auth);
  }

  async function syncSignedInUser() {
    await touchSessionActivity();
    const response = await syncCurrentUser();
    setDbUser(response.user);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setDbUser(null);
        setInitializing(false);
        return;
      }

      try {
        const expired = await isSessionExpired();

        if (expired) {
          await logout();
          setInitializing(false);
          return;
        }

        await touchSessionActivity();

        const synced = await syncCurrentUser();
        setDbUser(synced.user);
      } catch (error) {
        console.error("Failed to sync mobile user:", error);
        setDbUser(null);
      } finally {
        setInitializing(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state !== "active" || !auth.currentUser) {
        return;
      }

      const expired = await isSessionExpired();

      if (expired) {
        await logout();
        return;
      }

      await touchSessionActivity();
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      dbUser,
      initializing,

      login: async (email, password) => {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        await syncSignedInUser();
      },

      signup: async (email, password, name) => {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );

        if (name?.trim()) {
          await updateProfile(credential.user, {
            displayName: name.trim(),
          });

          await credential.user.getIdToken(true);
        }

        await syncSignedInUser();
      },

      loginWithGoogleIdToken: async (idToken) => {
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
        await syncSignedInUser();
      },

      startEmailLoginOtp: async (email, password) => {
        let signedInForOtp = false;

        try {
          await signInWithEmailAndPassword(auth, email.trim(), password);
          signedInForOtp = true;
          const session = await requestEmailLoginOtp();
          return session;
        } finally {
          if (signedInForOtp) {
            setDbUser(null);
            await clearSessionActivity();
            await signOut(auth);
          }
        }
      },

      completeEmailLoginWithOtp: async (email, password, sessionId, otp) => {
        await verifyEmailLoginOtp(sessionId, otp);
        await signInWithEmailAndPassword(auth, email.trim(), password);
        await syncSignedInUser();
      },

      refreshDbUser,

      logout,
    }),
    [user, dbUser, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
