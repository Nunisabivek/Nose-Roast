
import { AdMob, BannerAdSize, BannerAdPosition, AdOptions, BannerAdOptions } from '@capacitor-community/admob';

// PRODUCTION IDs
const BANNER_ID = 'ca-app-pub-4814181825408625/4014345081';
const INTERSTITIAL_ID = 'ca-app-pub-4814181825408625/4469818263';

let isAdMobInitialized = false;

export const AdMobService = {
    async initialize() {
        if (isAdMobInitialized) return;

        try {
            await AdMob.initialize({
                initializeForTesting: false,
            });
            isAdMobInitialized = true;
            console.log('AdMob Initialized');
        } catch (e) {
            console.error('AdMob init failed', e);
        }
    },

    async showBanner() {
        try {
            const options: BannerAdOptions = {
                adId: BANNER_ID,
                adSize: BannerAdSize.BANNER,
                position: BannerAdPosition.BOTTOM_CENTER,
                margin: 0,
                isTesting: false
            };
            await AdMob.showBanner(options);
        } catch (e) {
            console.error('Show banner failed', e);
        }
    },

    async hideBanner() {
        try {
            await AdMob.hideBanner();
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
            const options: AdOptions = {
                adId: INTERSTITIAL_ID,
                isTesting: false
            };
            await AdMob.prepareInterstitial(options);
        } catch (e) {
            console.error('Prepare interstitial failed', e);
        }
    },

    async showInterstitial() {
        try {
            await AdMob.showInterstitial();
        } catch (e) {
            console.error('Show interstitial failed', e);
        }
    }
};
