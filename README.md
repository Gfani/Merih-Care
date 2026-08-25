# Merihcare 🩺🇪🇹

**Merihcare** is an on-demand home healthcare platform designed for the Ethiopian market, connecting patients with verified healthcare providers for home visits and remote consultations.

---

## 🚀 Project Overview & Vision
Merihcare solves coordination challenges in healthcare by centralizing service discovery, appointment scheduling, secure patient-provider communication, and digital payments into a single, scalable digital ecosystem.

The platform consists of four core components:
* **Patient Mobile App (Flutter):** Allows patients to discover healthcare services, request care, schedule appointments, communicate via chat, make payments, and manage medical records.
* **Provider Mobile App (Flutter):** Allows verified healthcare providers to manage profiles, credentials, availability, service requests, appointments, and earnings.
* **Admin Web Dashboard (React):** Provides administrators with governance tools to manage users, verify professional credentials, oversee bookings, handle complaints, and view operational analytics.
* **Backend API (NestJS):** Handles authentication, authorization, business logic, persistence, real-time communication via WebSockets, notifications, and security.

---

## 🛠️ Technology Stack

| Layer | Recommended Technology |
| :--- | :--- |
| **Patient Mobile App** | Flutter |
| **Provider Mobile App** | Flutter |
| **Admin Web Dashboard** | React (Vite + TypeScript) |
| **Backend API** | NestJS / Node.js |
| **Primary Database** | PostgreSQL |
| **Real-Time Communication** | WebSocket / Socket.IO |
| **Authentication** | JWT with Refresh Token Strategy |
| **Caching / Transient Data** | Redis |
| **Containerization** | Docker |

---

## 📂 Repository Structure

```text
merihcare/
├── .github/                 # GitHub workflows & CI/CD configurations
│   └── workflows/
│       └── ci.yml           # Continuous Integration workflow
├── admin-web/               # Admin web dashboard (Vite + React)
│   ├── src/                 # Application source code (pages, components, hooks, api, etc.)
│   ├── package.json         # Node dependencies & npm scripts
│   └── vite.config.ts       # Vite configuration
├── backend/                 # Backend REST API (NestJS + TypeScript)
│   ├── src/                 # Application modules, controllers, providers, and database configs
│   ├── test/                # Unit, integration, and E2E test suites
│   ├── Dockerfile           # Docker configuration for containerized deployment
│   ├── package.json         # Node dependencies & npm scripts
│   └── tsconfig.json        # TypeScript configuration
├── mobile/                  # Mobile patient & provider apps (Flutter)
│   ├── lib/                 # Flutter application entrypoint, features, and core utils
│   ├── test/                # Flutter unit & widget tests
│   └── pubspec.yaml         # Flutter dependencies & assets metadata
├── docker-compose.yml       # Docker Compose for local database/cache dependencies
└── README.md                # Project documentation
```

---

## 🚀 Getting Started

### 📋 Prerequisites

Before running the application, make sure you have the following installed on your machine:
*   [Node.js](https://nodejs.org/) (v18.x or later recommended) & npm
*   [Flutter SDK](https://docs.flutter.dev/get-started/install) (latest stable version)
*   [Docker & Docker Compose](https://www.docker.com/products/docker-desktop/) (for local services)
*   IDE of choice (e.g., [VS Code](https://code.visualstudio.com/) or [Android Studio](https://developer.android.com/studio)) with Flutter & Dart extensions

---

### 🗄️ 1. Infrastructure Setup (Docker)

To run the local database and other supporting services (such as PostgreSQL and Redis), utilize the Docker Compose setup:

1.  Navigate to the project root:
    ```bash
    cd merihcare
    ```
2.  Start the background services:
    ```bash
    docker-compose up -d
    ```

---

### ⚙️ 2. Backend Service Setup (NestJS)

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Set up environment variables:
    *   Create a `.env` file from the example template:
        ```bash
        cp .env.example .env
        ```
    *   Configure your database credentials and API secrets in `.env`.
4.  Run database migrations (if applicable):
    ```bash
    npm run migration:run
    ```
5.  Start the NestJS development server:
    ```bash
    npm run start:dev
    ```
    *   The API server will typically run on `http://localhost:3000`.

---

### 💻 3. Admin Web Setup (Vite + React)

1.  Navigate to the web dashboard directory:
    ```bash
    cd admin-web
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the Vite dev server:
    ```bash
    npm run dev
    ```
    *   Open your browser to the URL displayed in the terminal (usually `http://localhost:5173`).

---

### 📱 4. Mobile Client Setup (Flutter)

1.  Navigate to the mobile app directory:
    ```bash
    cd mobile
    ```
2.  Retrieve Dart dependencies:
    ```bash
    flutter pub get
    ```
3.  Ensure you have a simulator/emulator running, or a physical device connected. Verify via:
    ```bash
    flutter devices
    ```
4.  Run the application in debug mode:
    ```bash
    flutter run
    ```

---

## 🧑‍💻 Git Workflow & GitHub Setup

To push this codebase to GitHub and start tracking your development history:

### 1. Initialize Git Repository
Run these commands from the project root:
```bash
# Initialize a new git repository
git init

# Add all template files
git add .

# Create the initial commit
git commit -m "chore: initial project boilerplate"
```

### 2. Push to GitHub
Create a new blank repository on GitHub (do not initialize it with a README, `.gitignore`, or license, as we already have them). Then run the following:
```bash
# Rename default branch to main
git branch -M main

# Link to your remote GitHub repository
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git

# Push the code to the main branch
git push -u origin main
```

---

## 🔒 License

This project is licensed under the MIT License - see the LICENSE file for details.
