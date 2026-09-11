import { normalizeAppError } from "./errors";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

let configured = false;

export function configureGoogleSignIn() {
  if (configured) return;

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  if (!webClientId) {
    throw new Error("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing.");
  }

  GoogleSignin.configure({
    webClientId,
    offlineAccess: false,
  });

  configured = true;
}

export async function signInWithGoogleAndGetIdToken() {
  try {
    configureGoogleSignIn();

    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });

    const result = await GoogleSignin.signIn();

    const tokenResult = result as {
      idToken?: string | null;
      data?: { idToken?: string | null } | null;
    };
    const idToken = tokenResult.idToken || tokenResult.data?.idToken || "";

    if (!idToken) {
      throw new Error(
        "Google did not return an ID token. Check your Web client ID and SHA-1 setup.",
      );
    }

    return idToken;
  } catch (error) {
    throw normalizeAppError(error, {
      title: "Google sign-in failed",
      fallbackMessage:
        "Google sign-in could not be completed. Please try again.",
    });
  }
}

export async function signOutFromGoogleProvider() {
  try {
    configureGoogleSignIn();
    await GoogleSignin.signOut();
  } catch {
    // Ignore Google sign-out failure. Firebase logout still runs.
  }
}
