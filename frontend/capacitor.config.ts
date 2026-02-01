import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.luxeaura.app',
  appName: 'Luxe Aura',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false, // Vamos esconder manualmente no App.tsx
      launchFadeOutDuration: 200,
      backgroundColor: "#08090a",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#c1a571",
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
