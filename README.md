# Copper Pan — Cozy Bistro Cooking Game

A fast-paced, clay-crafted bistro cooking game for mobile and desktop featuring **Solo Rush**, **Bot Challenge (VS Rival Chef Coco)**, **Daily Missions**, kitchen upgrades, unlockable themes, and tap-to-cook A* pathfinding.

---

## Download Android APK (via GitHub Releases)

Once this repository is pushed to GitHub, the included GitHub Actions workflow (`.github/workflows/build-apk.yml`) automatically builds an installable Android APK and publishes it under **Releases**:

1. Open your repository's **Releases** tab on GitHub.
2. Download **`CopperPan.apk`** from the latest release.
3. Open `CopperPan.apk` on your Android phone (allow *Install unknown apps* if prompted) and play!

You can also trigger a fresh APK build anytime from **Actions → Build & Release Android APK → Run workflow**.

---

## Install Instantly as a Mobile Web App (PWA)

Copper Pan is also a full Progressive Web App:
- **Android (Chrome)**: Tap **Install App** on the title screen (or Chrome menu → *Install app*).
- **iPhone / iPad (Safari)**: Tap **Share** → **Add to Home Screen**.

---

## Push to GitHub (First Time)

If you exported this project from AI Studio as a ZIP or folder, push it to a new GitHub repository:

```bash
git init
git add .
git commit -m "Initial commit: Copper Pan game + Android APK workflow"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

GitHub Actions will start building `CopperPan.apk` automatically within seconds of pushing to `main`.

---

## Local Development & Optional Local APK Build

```bash
# Run web dev server
npm install
npm run dev

# Run unit tests & typecheck
npm run lint
npx tsx --test src/game/rules.test.ts

# Build Android APK locally (requires Node.js 22+, Java 21, and Android SDK)
npm run build
npm install --no-save @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```
