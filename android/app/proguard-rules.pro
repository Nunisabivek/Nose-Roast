# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# Keep Capacitor classes
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }

# Keep AdMob classes
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.ads.** { *; }

# Keep WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Don't warn about missing classes
-dontwarn org.apache.**
-dontwarn org.xmlpull.**
-dontwarn com.google.android.gms.**

# Optimize aggressively
-optimizationpasses 5
-allowaccessmodification
-repackageclasses ''

# Remove logging
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}
