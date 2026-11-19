# Copper Pan — Cozy Bistro Cooking Game

A fast-paced, clay-crafted bistro cooking game for mobile and desktop featuring **Solo Rush**, **Bot Challenge (VS Rival Chef Coco)**, **Daily Missions**, **7-Day Daily Login Rewards**, an interactive canvas tutorial, kitchen upgrades, unlockable themes, and tap-to-cook A* pathfinding.

---

## How to Clone & Build the Android APK

You can build an installable Android `.apk` directly from this repository using **Capacitor** and **Gradle**.

### 1. Prerequisites
Install the following tools on your computer:
- **Git**
- **Node.js 20+** (Node 22 recommended)
- **Java 21 JDK** (required by Android Gradle Plugin — e.g., [Eclipse Temurin JDK 21](https://adoptium.net/))
- **Android Studio** (or Android Command-Line Tools with Android SDK Platform 35 & `ANDROID_HOME` configured)

### 2. Clone the Repository & Install Dependencies
Replace `<your-username>/<your-repo>` with your GitHub repository URL:

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
npm install
```

### 3. Build the Production Web Bundle
```bash
npm run build
```
This outputs the optimized game bundle into `dist/`.

### 4. Add & Sync the Capacitor Android Project
This project already includes `capacitor.config.json` (`appId: com.copperpan.bistro`, `appName: Copper Pan`, `webDir: dist`).

```bash
npm install --no-save @capacitor/core@^7.0.0 @capacitor/cli@^7.0.0 @capacitor/android@^7.0.0
npx cap add android
npx cap sync android
```

### 5. (Optional) Apply the Copper Pan App Launcher Icons
Copy the included Copper Pan PNG icons into Android's density `mipmap` folders (skipping `mipmap-anydpi-v26` to avoid XML conflicts):

```bash
for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  dir="android/app/src/main/res/mipmap-${density}"
  if [ -d "$dir" ]; then
    cp public/pwa-512x512.png "$dir/ic_launcher.png"
    cp public/pwa-512x512.png "$dir/ic_launcher_round.png"
    cp public/pwa-maskable-512x512.png "$dir/ic_launcher_foreground.png"
  fi
done
```

### 6. Build the Android APK
#### Option A — Build via Command Line (Fastest)
**macOS / Linux:**
```bash
cd android
chmod +x gradlew
./gradlew assembleDebug
```

**Windows (PowerShell / CMD):**
```powershell
cd android
.\gradlew.bat assembleDebug
```

Your installable APK will be generated at:
```text
android/app/build/outputs/apk/debug/app-debug.apk
```

#### Option B — Build Signed Release APK in Android Studio
```bash
npx cap open android
```
In Android Studio:
1. Wait for Gradle Sync to finish.
2. Go to **Build → Generate Signed App Bundle / APK → APK**.
3. Create or select your keystore and finish the build.

### 7. Install the APK on Your Android Phone
- **Direct file copy**: Transfer `app-debug.apk` to your phone (or upload it to your GitHub repo's **Releases** page), tap the file on Android, and allow *Install unknown apps* if prompted.
- **Via USB (`adb`)**:
  ```bash
  adb install android/app/build/outputs/apk/debug/app-debug.apk
  ```

---

## Install Instantly Without Building an APK (PWA)

Copper Pan also works as a full offline-ready Progressive Web App:
- **Android (Chrome)**: Open the live web app and tap **Install App** on the title screen (or Chrome menu → *Install app*).
- **iPhone / iPad (Safari)**: Tap **Share** → **Add to Home Screen**.

---

## Local Web Development & Tests

```bash
# Start local dev server on http://localhost:3000
npm run dev

# Typecheck
npm run lint

# Run game engine unit tests
npx tsx --test src/game/rules.test.ts
```
