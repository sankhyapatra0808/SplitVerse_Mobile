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
import { normalizeAppError } from "../lib/errors";
import {
  getCurrentDbUser,
  requestEmailLoginOtp,
  requestPasswordResetOtp as requestPasswordResetOtpApi,
  resetPasswordWithOtp as resetPasswordWithOtpApi,
  syncCurrentUser,
  verifyEmailLoginOtp,
  type DbUser,
  type EmailLoginOtpSession,
  type ResetPasswordWithOtpPayload,
} from "../lib/api";
import {
  clearRememberSession,
  clearSessionActivity,
  isSessionExpired,
  setRememberSession,
  touchSessionActivity,
} from "../lib/session";

type AuthContextValue = {
  user: User | null;
  dbUser: DbUser | null;
  initializing: boolean;
  login: (
    email: string,
    password: string,
    remember?: boolean,
  ) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  loginWithGoogleIdToken: (
    idToken: string,
    remember?: boolean,
  ) => Promise<void>;
  startEmailLoginOtp: (
    email: string,
    password: string,
    remember?: boolean,
  ) => Promise<EmailLoginOtpSession>;
  completeEmailLoginWithOtp: (
    email: string,
    password: string,
    sessionId: string,
    otp: string,
    remember?: boolean,
  ) => Promise<void>;
  requestPasswordResetOtp: (
    email: string,
  ) => Promise<{ message: string; expiresInSeconds: number }>;
  resetPasswordWithOtp: (
    payload: ResetPasswordWithOtpPayload,
  ) => Promise<{ message: string }>;
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
    try {
      setDbUser(null);
      await clearSessionActivity();
      await clearRememberSession();
      await signOut(auth);
    } catch (error) {
      throw normalizeAppError(error, {
        title: "Logout failed",
        fallbackMessage:
          "SplitVerse could not sign you out completely. Please try again.",
      });
    }
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
        const appError = normalizeAppError(error, {
          title: "Could not load your account",
          fallbackMessage:
            "SplitVerse could not sync your account details. Check your connection and try again.",
        });
        console.error("Failed to sync mobile user:", appError.message);
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

      login: async (email, password, remember = true) => {
        try {
          await setRememberSession(remember);
          await signInWithEmailAndPassword(auth, email.trim(), password);
          await syncSignedInUser();
        } catch (error) {
          throw normalizeAppError(error, {
            title: "Login failed",
            fallbackMessage:
              "SplitVerse could not sign you in. Check your details and try again.",
          });
        }
      },

      signup: async (email, password, name) => {
        try {
          await setRememberSession(true);
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
        } catch (error) {
          throw normalizeAppError(error, {
            title: "Account creation failed",
            fallbackMessage:
              "SplitVerse could not create your account. Check the entered details and try again.",
          });
        }
      },

      loginWithGoogleIdToken: async (idToken, remember = true) => {
        try {
          await setRememberSession(remember);
          const credential = GoogleAuthProvider.credential(idToken);
          await signInWithCredential(auth, credential);
          await syncSignedInUser();
        } catch (error) {
          throw normalizeAppError(error, {
            title: "Google sign-in failed",
            fallbackMessage:
              "SplitVerse could not finish Google sign-in. Please try again.",
          });
        }
      },

      startEmailLoginOtp: async (email, password, remember = true) => {
        let signedInForOtp = false;

        try {
          await setRememberSession(remember);
          await signInWithEmailAndPassword(auth, email.trim(), password);
          signedInForOtp = true;
          return await requestEmailLoginOtp();
        } catch (error) {
          throw normalizeAppError(error, {
            title: "Could not send login code",
            fallbackMessage:
              "SplitVerse could not send the email login code. Check your sign-in details and try again.",
          });
        } finally {
          if (signedInForOtp) {
            setDbUser(null);
            await clearSessionActivity();
            await signOut(auth);
          }
        }
      },

      completeEmailLoginWithOtp: async (
        email,
        password,
        sessionId,
        otp,
        remember = true,
      ) => {
        try {
          await verifyEmailLoginOtp(sessionId, otp);
          await setRememberSession(remember);
          await signInWithEmailAndPassword(auth, email.trim(), password);
          await syncSignedInUser();
        } catch (error) {
          throw normalizeAppError(error, {
            title: "Code verification failed",
            fallbackMessage:
              "The login code could not be verified. Request a new code and try again.",
          });
        }
      },

      requestPasswordResetOtp: async (email) => {
        try {
          return await requestPasswordResetOtpApi(email.trim().toLowerCase());
        } catch (error) {
          throw normalizeAppError(error, {
            title: "Could not send reset code",
            fallbackMessage:
              "SplitVerse could not send the password reset code. Check the email address and try again.",
          });
        }
      },

      resetPasswordWithOtp: async (payload) => {
        try {
          return await resetPasswordWithOtpApi({
            ...payload,
            email: payload.email.trim().toLowerCase(),
            otp: payload.otp.replace(/\D/g, "").slice(0, 6),
          });
        } catch (error) {
          throw normalizeAppError(error, {
            title: "Password reset failed",
            fallbackMessage:
              "SplitVerse could not reset your password. Check the OTP and try again.",
          });
        }
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
