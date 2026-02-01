import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.luxeaura.app',
  appName: 'Luxe Aura',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: "#08090a",
      androidScaleType: "CENTER",
      showSpinner: true,
      androidSpinnerStyle: "large",
      spinnerColor: "#c1a571",
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
