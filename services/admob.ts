
import {
    AdMob,
    BannerAdSize,
    BannerAdPosition,
    AdOptions,
    BannerAdOptions,
    BannerAdPluginEvents,
    InterstitialAdPluginEvents
} from '@capacitor-community/admob';

// PRODUCTION IDs
const BANNER_ID = 'ca-app-pub-4814181825408625/4014345081';
const INTERSTITIAL_ID = 'ca-app-pub-4814181825408625/4469818263';

let isAdMobInitialized = false;
let isInterstitialReady = false;
let isBannerShowing = false;

export const AdMobService = {
    async initialize() {
        if (isAdMobInitialized) return;

        try {
            // Initialize AdMob
            await AdMob.initialize({
                initializeForTesting: false,
            });
            isAdMobInitialized = true;
            console.log('✅ AdMob Initialized Successfully');

            // Add event listeners for debugging - Banner events
            AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
                console.log('✅ Banner Ad Loaded Successfully');
                isBannerShowing = true;
            });

            AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (error) => {
                console.error('❌ Banner Ad Failed to Load:', JSON.stringify(error));
                isBannerShowing = false;
            });

            AdMob.addListener(BannerAdPluginEvents.Opened, () => {
                console.log('📺 Banner Ad Opened');
            });

            // Add event listeners for debugging - Interstitial events
            AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
                console.log('✅ Interstitial Ad Loaded Successfully');
                isInterstitialReady = true;
            });

            AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (error) => {
                console.error('❌ Interstitial Ad Failed to Load:', JSON.stringify(error));
                isInterstitialReady = false;
            });

            AdMob.addListener(InterstitialAdPluginEvents.Showed, () => {
                console.log('📺 Interstitial Ad Showed');
            });

            AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
                console.log('🔄 Interstitial Ad Dismissed - Preparing next ad');
            });

            // Pre-load the first interstitial
            await this.prepareInterstitial();

            // Pre-load banner ad for instant display
            console.log('📢 Pre-loading banner ad...');
            await this.showBanner();
        } catch (e) {
            console.error('❌ AdMob init failed:', e);
        }
    },

    async showBanner() {
        if (isBannerShowing) {
            console.log('Banner already showing, resuming...');
            await this.resumeBanner();
            return;
        }

        try {
            console.log('📢 Attempting to show banner ad...');
            const options: BannerAdOptions = {
                adId: BANNER_ID,
                adSize: BannerAdSize.BANNER,
                position: BannerAdPosition.BOTTOM_CENTER,
                margin: 0,
                isTesting: false
            };
            await AdMob.showBanner(options);
            console.log('📢 Banner showBanner() called successfully');
        } catch (e) {
            console.error('❌ Show banner failed:', e);
        }
    },

    async hideBanner() {
        try {
            await AdMob.hideBanner();
            isBannerShowing = false;
        } catch (e) {
            // Ignore if no banner exists
        }
    },

    async resumeBanner() {
        try {
            await AdMob.resumeBanner();
        } catch (e) {
            // Ignore
        }
    },

    async prepareInterstitial() {
        try {
            console.log('🔄 Preparing interstitial ad...');
            const options: AdOptions = {
                adId: INTERSTITIAL_ID,
                isTesting: false
            };
            await AdMob.prepareInterstitial(options);
            isInterstitialReady = true;
            console.log('✅ Interstitial prepared and ready');
        } catch (e) {
            console.error('❌ Prepare interstitial failed:', e);
            isInterstitialReady = false;
        }
    },

    async showInterstitial() {
        try {
            // If not ready, try to prepare first
            if (!isInterstitialReady) {
                console.log('⏳ Interstitial not ready, preparing now...');
                await this.prepareInterstitial();
            }

            if (isInterstitialReady) {
                console.log('📺 Showing interstitial ad...');
                await AdMob.showInterstitial();
                isInterstitialReady = false; // Mark as used

                // Pre-load the next interstitial for future use
                setTimeout(() => {
                    this.prepareInterstitial();
                }, 1000);
            } else {
                console.log('⚠️ Interstitial still not ready after preparation');
            }
        } catch (e) {
            console.error('❌ Show interstitial failed:', e);
            isInterstitialReady = false;
            // Try to prepare for next time
            this.prepareInterstitial();
        }
    }
};
