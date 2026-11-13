# Flutter's own rules are added by the Flutter Gradle plugin. Keep the Play Core deferred-component classes that the
# engine references optionally, so R8 does not fail on them when the app does not use deferred components.
-dontwarn com.google.android.play.core.**
