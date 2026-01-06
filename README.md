# Ping Pong Tracker PWA

A Progressive Web App for tracking ping pong matches between friends, including player statistics, ELO rankings, and match scores.

## Features

- 🏓 **Match Tracking** - Log matches with scores and automatic winner detection
- 📊 **ELO Rankings** - Competitive ranking system that updates after each match
- 📈 **Player Statistics** - View wins, losses, win rate, streaks, and head-to-head records
- 📱 **Mobile-First PWA** - Works on Android and iOS with "Add to Home Screen" support
- 🔐 **User Authentication** - Email/password login with Firebase Auth

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Firebase (Firestore + Auth)
- **Styling**: Tailwind CSS
- **PWA**: vite-plugin-pwa

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Firebase project (free tier works)

### Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or use existing)
3. Enable **Authentication** → **Email/Password** sign-in method
4. Create **Firestore Database** (start in test mode)
5. Go to Project Settings → General → Your apps → Add web app
6. Copy the configuration values

### Installation

1. Clone the repository:
   ```bash
   cd PingPong-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Firebase config:
   ```env
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open http://localhost:5173 in your browser

### Seeding Test Data

To populate the database with mock players and matches for testing:

1. Open the app in your browser
2. Open the browser console (F12)
3. Run:
   ```javascript
   await seedDatabase()
   ```

This creates 5 test players and 18 sample matches with realistic ELO progression.

To clear all data:
```javascript
await clearDatabase()
```

## Project Structure

```
src/
├── components/         # Reusable UI components
│   ├── layout/        # Navigation, Layout
│   ├── leaderboard/   # Leaderboard table
│   ├── match/         # Match form and cards
│   ├── profile/       # Player stats display
│   └── ui/            # Generic UI (Button, Input, Modal, etc.)
├── context/           # React context (Auth)
├── hooks/             # Custom hooks for data fetching
├── lib/               # Utilities (Firebase, ELO, validation)
├── pages/             # Page components
└── types/             # TypeScript type definitions
```

## ELO Rating System

The app uses a standard ELO rating system:

- All players start at 1000 ELO
- K-factor of 32 (standard for casual play)
- Ratings update after each match
- Beating higher-rated players rewards more points
- Minimum rating floor of 100

### ELO Calculation Example

```typescript
// Equal players (both 1000)
// Winner gains +16, loser loses -16

// Higher beats lower (1200 vs 1000)
// Winner gains +10, loser loses -10 (expected outcome)

// Lower beats higher (1000 vs 1200 - upset!)
// Winner gains +22, loser loses -22
```

## Match Validation Rules

- Winner must reach exactly 11 or 21 points (depending on match type)
- Win by 2 rule applies (deuce games like 12-10 or 22-20 are valid)
- Players cannot play against themselves
- Duplicate submissions are blocked (same match within 1 minute)

## Firestore Security Rules

Deploy the included `firestore.rules` file to your Firebase project:

```bash
firebase deploy --only firestore:rules
```

Key rules:
- Users can only update their own profile (except ELO which is managed by matches)
- Anyone authenticated can create matches
- Only match creators can delete their own matches
- Matches are immutable (no updates allowed)

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## PWA Installation

### Android
1. Open the app in Chrome
2. Tap the menu (⋮) → "Add to Home Screen"

### iOS
1. Open the app in Safari
2. Tap the Share button → "Add to Home Screen"

## License

MIT

