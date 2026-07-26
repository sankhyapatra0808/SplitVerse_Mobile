# SplitVerse Mobile App

Open the SplitVerse website: **[https://split-verse.vercel.app/](https://split-verse.vercel.app/)**

## Download and Install the Android App

**[Download SplitVerse Mobile APK](https://github.com/sankhyapatra0808/SplitVerse_Mobile/releases/download/v1.0.0-preview/SplitVerse-Mobile-v1.0.0-preview.apk)**

After downloading:

1. Open the APK on your Android phone.
2. Allow installation from the browser or file manager when Android asks.
3. Tap **Install**.
4. Open SplitVerse after installation finishes.

This APK is a preview build for direct Android installation.

## Run the Mobile Project on Your PC

### Requirements

Install these first:

- Git
- Node.js 20 or newer
- npm
- Android Studio with an Android emulator, or a physical Android phone
- Expo and EAS accounts
- Your own Firebase and Razorpay credentials
- Your own deployed SplitVerse backend

### 1. Clone the Project

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_MOBILE_REPOSITORY.git
cd YOUR_MOBILE_REPOSITORY
```

### 2. Install Packages

```bash
npm install
npm install -g eas-cli
```

### 3. Add Your Environment Variables

Create a `.env` file in the mobile project root and replace every value with credentials from your own accounts:

```env
EXPO_PUBLIC_API_URL=https://your-backend-domain.com

EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
EXPO_PUBLIC_MEASUREMENT_ID=your_measurement_id

EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_your_key_id
```

Keep any additional environment variables already included in the project and replace their placeholder values with your own credentials.

### 4. Create and Install a Development Build

Log in to Expo:

```bash
eas login
```

Create the Expo project configuration when required:

```bash
eas build:configure
```

Build the Android development client:

```bash
eas build --platform android --profile development
```

Install the generated development build on your phone or emulator.

### 5. Start the Project

```bash
npx expo start --dev-client -c
```

Open the installed development build and connect it to the running project.

## Make the Mobile App Yours

1. Fork the repository or copy it into your own GitHub repository.
2. Replace the app name, logo, icons, splash screen, text and other branding.
3. In `app.json` or `app.config.*`, change the Expo `name`, `slug`, Android package name and project identifiers to your own unique values.
4. Replace the API, Firebase, Google sign-in and Razorpay credentials with credentials from your own accounts.
5. Add your Android package name and SHA certificate fingerprints to your own Firebase project.
6. Point `EXPO_PUBLIC_API_URL` to your own deployed backend.
7. Never upload `.env`, service-account files, keystores or secrets to GitHub.
8. Connect the project to your own repository:

```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/YOUR_MOBILE_REPOSITORY.git
git add .
git commit -m "Set up my version of the mobile app"
git branch -M main
git push -u origin main
```

## Build and Publish Your Own App

### Installable Testing APK

```bash
eas build --platform android --profile preview --clear-cache
```

Download the generated APK and install it directly on Android devices.

### Production Build

```bash
eas build --platform android --profile production --clear-cache
```

Use the generated production Android build for your own store release or distribution.

To make the APK downloadable from your GitHub README, place the APK in the same folder as `README.md` and keep this link:

```md
[Download SplitVerse Mobile APK](./SplitVerse-Mobile-v1.0.0-preview.apk?raw=1)
```

Replace the filename in the link whenever you upload a newer APK.

## Change the Currency

After signing in, open **Settings** and change the **App Currency**. The selected currency will be used across the mobile app.
