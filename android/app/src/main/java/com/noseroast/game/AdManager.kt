package com.noseroast.game

import android.app.Activity
import android.view.Gravity
import android.util.Log
import android.view.View
import android.view.View.OnAttachStateChangeListener
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.google.android.gms.ads.AdRequest.ERROR_CODE_INVALID_REQUEST
import com.google.android.gms.ads.AdRequest.ERROR_CODE_NETWORK_ERROR
import com.google.android.gms.ads.AdRequest.ERROR_CODE_NO_FILL
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback

class AdManager(private val activity: Activity) {
    private var interstitialAd: InterstitialAd? = null
    private var bannerAdView: AdView? = null
    private var bannerContainer: FrameLayout? = null
    private var isInitialized = false
    private var isLoadingInterstitial = false
    private var isShowingInterstitial = false
    private var isBannerLoaded = false
    private var isBannerLoading = false
    private var hasAttachedBanner = false
    private val bannerRetryRunnable = Runnable { loadBanner(force = true) }

    // Debug builds use Google's universal test ad unit IDs so ads always fill.
    // Release builds use the real unit IDs.
    private val bannerId = if (BuildConfig.DEBUG)
        "ca-app-pub-3940256099942544/6300978111"
    else
        "ca-app-pub-4814181825408625/4014345081"

    private val interstitialId = if (BuildConfig.DEBUG)
        "ca-app-pub-3940256099942544/1033173712"
    else
        "ca-app-pub-4814181825408625/4469818263"

    init {
        Log.d("NRAds", "Initializing MobileAds... debug=${BuildConfig.DEBUG}")
        runCatching {
            // Tell AdMob the device is a test device so it never throttles or blocks requests
            if (BuildConfig.DEBUG) {
                val config = com.google.android.gms.ads.RequestConfiguration.Builder()
                    .setTestDeviceIds(listOf(
                        com.google.android.gms.ads.AdRequest.DEVICE_ID_EMULATOR,
                        "CHECKSUM" // replace with your device ID from logcat if needed
                    ))
                    .build()
                MobileAds.setRequestConfiguration(config)
            }
            MobileAds.initialize(activity) { initStatus ->
                isInitialized = true
                Log.d("NRAds", "MobileAds initialized: $initStatus")
                loadBanner()
                loadInterstitial()
            }
        }.onFailure { error ->
            Log.e("NRAds", "MobileAds init failed: ${error.message}", error)
        }
    }

    /** Creates and returns a banner view for Compose. Falls back to an empty view if ads fail. */
    fun createBannerAdView(): View {
        bannerContainer?.let { existing ->
            return existing
        }

        return runCatching {
            val adView = AdView(activity).apply {
                setAdSize(AdSize.BANNER)
                adUnitId = bannerId
                visibility = View.VISIBLE
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT
                )
                adListener = object : AdListener() {
                    override fun onAdLoaded() {
                        isBannerLoading = false
                        isBannerLoaded = true
                        activity.window.decorView.removeCallbacks(bannerRetryRunnable)
                        bannerContainer?.visibility = if (isShowingInterstitial) View.GONE else View.VISIBLE
                        bannerContainer?.requestLayout()
                        Log.d("NRAds", "Banner LOADED")
                    }

                    override fun onAdFailedToLoad(error: LoadAdError) {
                        isBannerLoading = false
                        isBannerLoaded = false
                        Log.e("NRAds", "Banner FAILED: ${error}")
                        when (error.code) {
                            ERROR_CODE_INVALID_REQUEST -> {
                                Log.e("NRAds", "Banner invalid request; not retrying automatically")
                            }
                            ERROR_CODE_NO_FILL -> scheduleBannerRetry(30000L)
                            ERROR_CODE_NETWORK_ERROR -> scheduleBannerRetry(15000L)
                            else -> scheduleBannerRetry(20000L)
                        }
                    }

                    override fun onAdImpression() {
                        Log.d("NRAds", "Banner IMPRESSION")
                    }

                    override fun onAdClicked() {
                        Log.d("NRAds", "Banner CLICKED")
                    }
                }
            }

            val container = FrameLayout(activity).apply {
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT
                )
                minimumHeight = AdSize.BANNER.getHeightInPixels(activity)
                visibility = View.VISIBLE
                clipToPadding = false
                clipChildren = false
                setPadding(0, 0, 0, 0)
            }
            container.addView(
                adView,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
                )
            )
            container.addOnAttachStateChangeListener(object : OnAttachStateChangeListener {
                override fun onViewAttachedToWindow(v: View) {
                    loadBanner(force = true)
                }

                override fun onViewDetachedFromWindow(v: View) = Unit
            })

            bannerAdView = adView
            bannerContainer = container
            container
        }.getOrElse { error ->
            Log.e("NRAds", "Banner view creation failed: ${error.message}", error)
            FrameLayout(activity).apply {
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT
                )
            }
        }
    }

    fun attachBannerOverlay() {
        val root = activity.findViewById<ViewGroup>(android.R.id.content) ?: return
        val bannerView = createBannerAdView()
        if (bannerView.parent === root) {
            updateBannerLayout(bannerView, root)
            bannerView.visibility = if (isShowingInterstitial) View.GONE else View.VISIBLE
            if (!isBannerLoaded && !isBannerLoading) {
                loadBanner()
            }
            return
        }

        (bannerView.parent as? ViewGroup)?.removeView(bannerView)
        val layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
        )
        root.addView(bannerView, layoutParams)
        ViewCompat.setOnApplyWindowInsetsListener(bannerView) { view, insets ->
            updateBannerLayout(view, root)
            insets
        }
        ViewCompat.requestApplyInsets(bannerView)
        updateBannerLayout(bannerView, root)
        bannerView.bringToFront()
        bannerView.visibility = if (isShowingInterstitial) View.GONE else View.VISIBLE
        hasAttachedBanner = true
        if (!isBannerLoaded && !isBannerLoading) {
            loadBanner()
        }
    }

    private fun updateBannerLayout(bannerView: View, root: View) {
        val layoutParams = (bannerView.layoutParams as? FrameLayout.LayoutParams) ?: return
        val insets: Insets = ViewCompat.getRootWindowInsets(root)
            ?.getInsets(WindowInsetsCompat.Type.navigationBars())
            ?: Insets.NONE
        val newBottomMargin = insets.bottom
        if (layoutParams.bottomMargin != newBottomMargin) {
            layoutParams.bottomMargin = newBottomMargin
            bannerView.layoutParams = layoutParams
        }
    }

    private fun scheduleBannerRetry(delayMs: Long) {
        activity.window.decorView.removeCallbacks(bannerRetryRunnable)
        activity.window.decorView.postDelayed(bannerRetryRunnable, delayMs)
    }

    fun loadBanner(force: Boolean = false) {
        if (!isInitialized) return
        val adView = bannerAdView ?: return
        if (!hasAttachedBanner) return
        if (!force && (isBannerLoaded || isBannerLoading)) return
        runCatching {
            isBannerLoading = true
            adView.setAdSize(AdSize.BANNER)
            adView.loadAd(AdRequest.Builder().build())
            Log.d("NRAds", "Banner ad loading...")
        }.onFailure { error ->
            isBannerLoading = false
            isBannerLoaded = false
            Log.e("NRAds", "Banner load failed: ${error.message}", error)
            scheduleBannerRetry(20000L)
        }
    }

    fun preloadInterstitial() {
        loadInterstitial()
    }

    private fun loadInterstitial() {
        if (!isInitialized || isLoadingInterstitial || interstitialAd != null) return

        isLoadingInterstitial = true
        Log.d("NRAds", "Loading interstitial...")
        val adRequest = AdRequest.Builder().build()
        runCatching {
            InterstitialAd.load(
                activity,
                interstitialId,
                adRequest,
                object : InterstitialAdLoadCallback() {
                    override fun onAdLoaded(ad: InterstitialAd) {
                        isLoadingInterstitial = false
                        interstitialAd = ad
                        Log.d("NRAds", "Interstitial LOADED")
                    }

                    override fun onAdFailedToLoad(error: LoadAdError) {
                        isLoadingInterstitial = false
                        interstitialAd = null
                        Log.e("NRAds", "Interstitial FAILED: ${error.message}")
                    }
                }
            )
        }.onFailure { error ->
            isLoadingInterstitial = false
            interstitialAd = null
            Log.e("NRAds", "Interstitial load failed: ${error.message}", error)
        }
    }

    fun onGameOver() {
        if (interstitialAd == null) loadInterstitial()
    }

    /** Shows an interstitial on retry, then resumes the game only after the ad is dismissed or unavailable. */
    fun showInterstitialThen(onFinished: () -> Unit) {
        if (isShowingInterstitial) return

        val ad = interstitialAd
        if (ad == null) {
            Log.d("NRAds", "Interstitial unavailable, continuing without showing")
            loadInterstitial()
            onFinished()
            return
        }

        isShowingInterstitial = true
        interstitialAd = null
        bannerContainer?.visibility = View.GONE
        pauseBanner()
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdShowedFullScreenContent() {
                Log.d("NRAds", "Interstitial SHOWED")
            }

            override fun onAdDismissedFullScreenContent() {
                Log.d("NRAds", "Interstitial DISMISSED")
                isShowingInterstitial = false
                bannerContainer?.visibility = View.VISIBLE
                resumeBanner()
                if (!isBannerLoaded && !isBannerLoading) {
                    loadBanner()
                }
                loadInterstitial()
                onFinished()
            }

            override fun onAdFailedToShowFullScreenContent(error: AdError) {
                Log.e("NRAds", "Interstitial SHOW FAILED: ${error.message}")
                isShowingInterstitial = false
                bannerContainer?.visibility = View.VISIBLE
                resumeBanner()
                if (!isBannerLoaded && !isBannerLoading) {
                    loadBanner()
                }
                loadInterstitial()
                onFinished()
            }
        }

        runCatching {
            ad.show(activity)
        }.onFailure { error ->
            Log.e("NRAds", "Interstitial show failed: ${error.message}", error)
            isShowingInterstitial = false
            bannerContainer?.visibility = View.VISIBLE
            resumeBanner()
            if (!isBannerLoaded && !isBannerLoading) {
                loadBanner()
            }
            loadInterstitial()
            onFinished()
        }
    }

    /** Call this when embedding the banner as an inline AndroidView (not as a root overlay). */
    fun setupInlineBanner() {
        hasAttachedBanner = true
        loadBanner()
    }

    fun pauseBanner() {
        runCatching { bannerAdView?.pause() }
            .onFailure { Log.w("NRAds", "Banner pause failed: ${it.message}") }
    }

    fun resumeBanner() {
        runCatching { bannerAdView?.resume() }
            .onFailure { Log.w("NRAds", "Banner resume failed: ${it.message}") }
    }

    fun destroyBanner() {
        activity.window.decorView.removeCallbacks(bannerRetryRunnable)
        (bannerContainer?.parent as? ViewGroup)?.removeView(bannerContainer)
        hasAttachedBanner = false
        bannerAdView?.destroy()
        bannerAdView = null
        bannerContainer?.removeAllViews()
        bannerContainer = null
        isBannerLoaded = false
        isBannerLoading = false
    }
}
