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
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import {
  getCurrentDbUser,
  syncCurrentUser,
  type DbUser,
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
        await touchSessionActivity();

        const response = await syncCurrentUser();
        setDbUser(response.user);
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

        await touchSessionActivity();

        const response = await syncCurrentUser();
        setDbUser(response.user);
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