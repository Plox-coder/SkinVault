# SkinVault

SkinVault is an unofficial League of Legends collection tracker. Import your collection, browse your owned and missing cosmetics, and see reference values for skins in RP and Mythic Essence.

 **[Try SkinVault Online](https://Plox-coder.github.io/SkinVault/)**

## Features

- Collection overview: Track skins, summoner icons, ward skins, and chromas.
- Pengu Loader import: Load a JSON file exported with the SkinVault integration for Pengu Loader.
- **Ownership tracking: Browse owned and missing items, and update their status when needed.
- Search and filters: Find cosmetics by name, champion, or ID.
- Skin values: View historical RP prices, Mythic Essence costs, and special acquisition categories.
- Sanctum skins: See maximum guaranteed RP costs separately from direct-purchase prices.
- Collection backup: Export and import your collection as JSON.
- Languages: English, Spanish, and Catalan.

## How to Use

1. Open League of Legends with Pengu Loader and the SkinVault integration.
2. Export your collection as a `.json` file using the integration.
3. Open **[SkinVault](https://Plox-coder.github.io/SkinVault/)** in your browser.
4. Select **Import Collection** and choose your JSON file.
5. Explore your collection, check your statistics, and export a backup whenever you need one.

You do **not** need to enter your Riot account password into SkinVault.

## Skin Values

SkinVault displays historical RP prices when available and tracks Mythic Essence costs separately. Exclusive and reward skins without a direct RP price are identified accordingly.

For Sanctum skins, the app shows the maximum guaranteed acquisition cost rather than a fixed purchase price. These values are not added to direct-purchase RP totals.

**Displayed values are estimates and references, not a record of what you spent or an account resale valuation.** Newly released skins may not have a reference value yet.

## Privacy and Data

Your imported collection is processed in your browser and saved locally using `localStorage`. SkinVault has no backend that uploads or synchronizes your inventory. Your data will not automatically appear in another browser or device, so keep a JSON backup.

Never commit personal collection export files to a public repository.

Some artwork and game data are loaded from Riot Data Dragon and CommunityDragon, so an internet connection is needed for those resources.

## Development

SkinVault is built with React, TypeScript, and Vite.

To run the project locally, install Node.js and npm, then run:

```bash
npm ci
npm run dev
```

Open the local address shown in the terminal (usually `http://localhost:5173/`).

To create a production build:

```bash
npm run build
```

The generated site will be available in the `dist/` directory.

## Disclaimer

SkinVault is an unofficial fan project and is **not affiliated with or endorsed by Riot Games**. League of Legends and related assets belong to Riot Games. Game data and artwork remain subject to their respective owners' terms and availability.