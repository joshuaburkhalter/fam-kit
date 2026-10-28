import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';

export async function initCapacitorPlugins(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Style status bar for dark theme
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#080b12' });
    }
  } catch (err) {
    console.debug('StatusBar setup note:', err);
  }

  try {
    // Hide splash screen smoothly once the web view has loaded
    await SplashScreen.hide();
  } catch (err) {
    console.debug('SplashScreen setup note:', err);
  }

  try {
    // Handle Android hardware back button
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  } catch (err) {
    console.debug('App backButton listener note:', err);
  }
}
