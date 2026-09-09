# Merihcare — App Store & Google Play Store Publishing Guide

This guide provides the complete, production-ready process for building, signing, and publishing the **Merihcare** Flutter mobile app to the **Google Play Store** (Android) and **Apple App Store** (iOS).

---

## 1. App Identifiers & General Information

| Parameter | Configuration |
| :--- | :--- |
| **App Name** | `Merihcare` |
| **Android Application ID (Package Name)** | `com.merihcare.app` |
| **iOS Bundle Identifier** | `com.merihcare.app` |
| **Primary Category** | Medical / Health & Fitness |
| **Default Production API Backend** | `https://app-merihcare-prod-backend.agreeablemoss-f06ffa43.uaenorth.azurecontainerapps.io/api/v1` |
| **Default Production Realtime URL** | `https://app-merihcare-prod-backend.agreeablemoss-f06ffa43.uaenorth.azurecontainerapps.io` |

---

## 2. Prerequisites & Developer Accounts

### A. Google Play Console (Android)
1. Register at [Google Play Console](https://play.google.com/console/signup).
2. One-time developer registration fee: **$25 USD**.
3. Complete Identity Verification (requires government ID / business verification).

### B. Apple Developer Program (iOS)
1. Enroll at [Apple Developer Program](https://developer.apple.com/programs/enroll/).
2. Annual membership fee: **$99 USD/year**.
3. You will need access to a **Mac (macOS)** with Xcode installed to create the final iOS signing certificates and archive the app.

---

## 3. Google Play Store Release (Step-by-Step)

Google Play strictly requires apps to be submitted as an **Android App Bundle (.aab)** signed with a private release keystore.

### Step 3.1: Generate Your Release Upload Keystore
Run the following command in PowerShell or Terminal (from your `mobile` directory):

```powershell
keytool -genkey -v -keystore upload-keystore.jks -storetype JKS -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

You will be prompted to:
- Enter a secure password (e.g., `MerihcareStore2026!`).
- Enter your name/organization (`Merihcare Healthcare`).
- Confirm details with `yes`.

> [!WARNING]
> **Backup your `upload-keystore.jks` immediately to a secure cloud drive / password manager!**
> If you lose this keystore file, Google will not allow you to release updates to your app.

### Step 3.2: Configure `key.properties`
1. Move the generated `upload-keystore.jks` file into `mobile/android/`:
   ```powershell
   mv upload-keystore.jks android/
   ```
2. Create a file named `key.properties` inside `mobile/android/` (already in `.gitignore`):
   ```properties
   keyAlias=upload
   keyPassword=YourKeystorePasswordHere
   storeFile=../upload-keystore.jks
   storePassword=YourKeystorePasswordHere
   ```

### Step 3.3: Build the Android App Bundle (.aab)
From the `mobile` directory, run:

```powershell
flutter build appbundle --release
```

The output bundle will be generated at:
```
mobile/build/app/outputs/bundle/release/app-release.aab
```

### Step 3.4: Upload to Google Play Console
1. In the Google Play Console, click **Create App**:
   - App Name: `Merihcare`
   - Default Language: `English (United States)`
   - App or Game: `App`
   - Free or Paid: `Free`
2. Under **Release > Testing > Internal testing** (or **Production**):
   - Click **Create new release**.
   - Enable **Google Play App Signing**.
   - Drag and drop your `app-release.aab`.
   - Enter Release Notes: *"Initial production release of Merihcare home healthcare platform."*
3. Complete the **Store Presence > Main store listing**:
   - Short description (up to 80 chars): *"On-demand home healthcare, nursing, and clinical visits in Ethiopia."*
   - Full description: Explain features (doctor visits, emergency dispatch, booking, lab sample collection).
   - Upload **App Icon (512x512 PNG)**, **Feature Graphic (1024x500 PNG)**, and **Phone Screenshots**.
4. Complete **Policy > App content**:
   - Privacy Policy URL.
   - Target audience (18+ or all ages).
   - Medical & Health disclosure declaration.
5. Click **Review and Release** -> **Start rollout to Production**.

---

## 4. Apple App Store Release (Step-by-Step)

Apple requires signing via an Apple Distribution Certificate and Provisioning Profile using Xcode on a Mac.

### Step 4.1: Open the Project in Xcode
1. Open the iOS project on your Mac:
   ```bash
   cd mobile
   open ios/Runner.xcworkspace
   ```
2. In Xcode:
   - Select the top **Runner** project in the left navigation sidebar.
   - Select the **Runner** target -> **Signing & Capabilities**.
   - Check **Automatically manage signing**.
   - Select your registered **Team** (your Apple Developer account).
   - Confirm Bundle Identifier is `com.merihcare.app`.

### Step 4.2: Build the iOS Release Archive
From your terminal in `mobile/`:
```bash
flutter build ipa --release
```
Or directly from Xcode:
1. Select the destination as **Any iOS Device (arm64)** in the top bar.
2. In the menu bar, click **Product > Archive**.
3. Once compilation finishes, the **Organizer** window opens.
4. Click **Distribute App** -> **App Store Connect** -> **Upload**.

### Step 4.3: App Store Connect Setup
1. Go to [App Store Connect](https://appstoreconnect.apple.com).
2. Click **My Apps > + (New App)**:
   - Platform: `iOS`
   - Name: `Merihcare`
   - Primary Language: `English`
   - Bundle ID: `com.merihcare.app`
   - SKU: `merihcare-ios-app`
3. Fill in:
   - **Privacy Policy URL**.
   - **Screenshots**:
     - 6.7-inch display (iPhone 15 Pro Max / 16 Pro Max).
     - 6.5-inch display (iPhone 11 Pro Max / XS Max).
   - **Review Information**:
     - Provide a demo reviewer login credentials (e.g. `patient@merihcare.et` / password).
4. Select the uploaded build from Step 4.2 and click **Submit for Review**.

---

## 5. Mandatory App Store Compliance Checklist

Both Google and Apple enforce strict policies for health and user-data applications:

| Requirement | How Merihcare Complies |
| :--- | :--- |
| **In-App Account Deletion** | Implemented under **Account Settings > Delete Account** and calls `DELETE /api/v1/auth/account`. |
| **iOS Privacy Descriptions** | Configured in `ios/Runner/Info.plist` for Camera, Photo Library, Location, and Microphone. |
| **Privacy Policy URL** | Host on your live domain (e.g., `https://merihcare.et/privacy` or on Azure Admin Web). |
| **App Reviewer Credentials** | Provide a pre-verified test patient and provider account in the review submission notes so Apple/Google testers can log in immediately. |
| **Medical Disclaimer** | Must state in description: *"Merihcare connects patients with licensed home healthcare professionals. In case of life-threatening emergencies, call national emergency services immediately."* |

---

## 6. Incrementing Versions for Future Releases

Every time you build a new update for the stores, increase the version in `mobile/pubspec.yaml`:

```yaml
version: 1.0.1+2   # 1.0.1 is the visible version, 2 is the incremental build number
```

- **Version Name (`1.0.1`)**: What users see in the App Store / Play Store.
- **Build Number (`+2`, `+3`, `+4`)**: Must strictly increase with every single upload to Google Play or TestFlight.
