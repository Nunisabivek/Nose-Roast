
import {
    AdMob,
    BannerAdSize,
    BannerAdPosition,
    AdOptions,
    BannerAdOptions,
    BannerAdPluginEvents,
    InterstitialAdPluginEvents,
    MaxAdContentRating
} from '@capacitor-community/admob';

// PRODUCTION IDs
const BANNER_ID = 'ca-app-pub-4814181825408625/4014345081';
const INTERSTITIAL_ID = 'ca-app-pub-4814181825408625/4469818263';

let isAdMobInitialized = false;
let isInterstitialReady = false;
let isBannerShowing = false;

export const AdMobService = {
    async initialize() {
        if (isAdMobInitialized) {
            console.log('⚠️ AdMob already initialized');
            return;
        }

        try {
            console.log('🔄 Initializing AdMob...');
            // Initialize AdMob
            // SETTINGS FOR 13+ AUDIENCE (Higher Revenue)
            await AdMob.initialize({
                initializeForTesting: false,
                tagForChildDirectedTreatment: false, // App is NOT directed at children (allows personalized ads)
                tagForUnderAgeOfConsent: false,
                maxAdContentRating: MaxAdContentRating.Teen, // Allows T-rated ads (larger inventory than G)
            });
            isAdMobInitialized = true;
            console.log('✅ AdMob Initialized (Settings: 13+ / Teen / Personalized)');

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

            AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => {
                console.log('📏 Banner Ad Size Changed:', JSON.stringify(size));
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
                isInterstitialReady = false;
                // Pre-load the next interstitial automatically
                setTimeout(() => {
                    this.prepareInterstitial();
                }, 1000);
            });

            // Pre-load the first interstitial
            await this.prepareInterstitial();

            // Pre-load banner ad for instant display
            console.log('📢 Pre-loading banner ad...');
            await this.showBanner();
        } catch (e) {
            console.error('❌ AdMob init failed:', e);
            isAdMobInitialized = false;
        }
    },

    async showBanner() {
        if (!isAdMobInitialized) {
            console.log('⚠️ AdMob not initialized yet, skipping banner');
            return;
        }

        if (isBannerShowing) {
            console.log('✅ Banner already showing, resuming...');
            try {
                await AdMob.resumeBanner();
            } catch (e) {
                console.warn('⚠️ Resume banner failed:', e);
            }
            return;
        }

        try {
            console.log('📢 Attempting to show banner ad...');
            const options: BannerAdOptions = {
                adId: BANNER_ID,
                adSize: BannerAdSize.BANNER,
                position: BannerAdPosition.BOTTOM_CENTER,
                margin: 0,
                isTesting: false  // Real ads for production
            };
            await AdMob.showBanner(options);
            isBannerShowing = true;
            console.log('✅ Banner ad shown successfully');
        } catch (e) {
            console.error('❌ Show banner failed:', e);
            isBannerShowing = false;
        }
    },

    async hideBanner() {
        if (!isAdMobInitialized) return;
        try {
            await AdMob.hideBanner();
            isBannerShowing = false;
            console.log('✅ Banner hidden');
        } catch (e) {
            console.warn('⚠️ Hide banner failed:', e);
        }
    },

    async resumeBanner() {
        if (!isAdMobInitialized) return;
        try {
            await AdMob.resumeBanner();
            isBannerShowing = true;
            console.log('✅ Banner resumed');
        } catch (e) {
            console.warn('⚠️ Resume banner failed:', e);
        }
    },

    async prepareInterstitial() {
        if (!isAdMobInitialized) {
            console.log('⚠️ AdMob not initialized, skipping interstitial prep');
            return;
        }

        try {
            console.log('🔄 Preparing interstitial ad...');
            const options: AdOptions = {
                adId: INTERSTITIAL_ID,
                isTesting: false  // Real ads for production
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
        if (!isAdMobInitialized) {
            console.log('⚠️ AdMob not initialized, skipping interstitial');
            return;
        }

        try {
            // If not ready, try to prepare first
            if (!isInterstitialReady) {
                console.log('⏳ Interstitial not ready, preparing now...');
                await this.prepareInterstitial();
                // Wait a bit for it to load
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (isInterstitialReady) {
                console.log('📺 Showing interstitial ad...');
                await AdMob.showInterstitial();
                isInterstitialReady = false; // Mark as used
                console.log('✅ Interstitial shown');
            } else {
                console.log('⚠️ Interstitial not ready after preparation, skipping');
            }
        } catch (e) {
            console.error('❌ Show interstitial failed:', e);
            isInterstitialReady = false;
            // Try to prepare for next time
            setTimeout(() => {
                this.prepareInterstitial();
            }, 1000);
        }
    }
};
