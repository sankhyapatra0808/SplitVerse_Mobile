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
  configureGoogleSignIn();

  await GoogleSignin.hasPlayServices({
    showPlayServicesUpdateDialog: true,
  });

  const result = await GoogleSignin.signIn();

  const idToken =
    (result as any).idToken ||
    (result as any).data?.idToken ||
    "";

  if (!idToken) {
    throw new Error(
      "Google did not return an ID token. Check your Web client ID and SHA-1 setup.",
    );
  }

  return idToken;
}

export async function signOutFromGoogleProvider() {
  try {
    configureGoogleSignIn();
    await GoogleSignin.signOut();
  } catch {
    // Ignore Google sign-out failure. Firebase logout still runs.
  }
}