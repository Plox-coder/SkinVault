# SkinVault

**SkinVault** is an unofficial League of Legends collection tracker. Import your collection, browse your owned and missing cosmetics, and see reference values for skins in RP and Mythic Essence.

🎮 **[Try SkinVault Online](https://plox-coder.github.io/SkinVault/)** · [Source repository](https://github.com/Plox-coder/SkinVault)

## Features

- **Collection overview:** Track skins, summoner icons, ward skins, and chromas.
- **Pengu Loader import:** Load a JSON file exported with the SkinVault integration for Pengu Loader.
- **Ownership tracking:** Browse owned and missing items, and update their status when needed.
- **Search and filters:** Find cosmetics by name, champion, or ID.
- **Skin values:** View historical RP prices, Mythic Essence costs, and special acquisition categories.
- **Sanctum skins:** See maximum guaranteed RP costs separately from direct-purchase prices.
- **Collection backup:** Export and import your collection as JSON.
- **Share Collection:** Copy a link to a read-only snapshot of your owned skins. Friends can search and filter by rarity without importing a JSON file. Links work directly on GitHub Pages.
- **Languages:** English, Spanish, and Catalan.

## How to Use

1. Open League of Legends with **Pengu Loader** and the SkinVault integration.
2. Export your collection as a `.json` file using the integration.
3. Open **[SkinVault](https://plox-coder.github.io/SkinVault/)** in your browser.
4. Select **Import Collection** and choose your JSON file.
5. Explore your collection, check your statistics, and export a backup whenever you need one.

You do **not** need to enter your Riot account password into SkinVault.

## Skin Values

SkinVault displays historical RP prices when available and tracks Mythic Essence costs separately. Exclusive and reward skins without a direct RP price are identified accordingly.

For Sanctum skins, the app shows the maximum guaranteed acquisition cost rather than a fixed purchase price. These values are not added to direct-purchase RP totals.

**Displayed values are estimates and references, not a record of what you spent or an account resale valuation.** Newly released skins may not have a reference value yet.

## Share your collection

After importing your JSON, select **Share Collection** and then **Copy link**.
The recipient can open the link to see your owned skins, reference RP/ME values, search, and filter by rarity. No account login or JSON import is needed. Shared views are read-only and never overwrite the recipient's local collection.

The link contains only numeric IDs of owned skins, **not your account name or original JSON**. Anyone with the link can view the snapshot, and the link does not automatically update if you acquire new skins. Generate a new link to share an updated collection. Longer collections produce longer links, so some messaging services may have URL length limits.

Shared skin names, rarities and artwork require access to CommunityDragon/Riot data services; some skins may appear by ID if those services are unavailable.

## Privacy and Data

Your imported collection is processed in your browser and saved locally using `localStorage`. SkinVault has no backend that uploads or synchronizes your inventory. Your data will not automatically appear in another browser or device, so keep a JSON backup.

**Never commit personal collection export files to a public repository.**

Some artwork and game data are loaded from Riot Data Dragon and CommunityDragon, so an internet connection is needed for those resources.

## Disclaimer

SkinVault is an unofficial fan project and is **not affiliated with or endorsed by Riot Games**. League of Legends and related assets belong to Riot Games. Game data and artwork remain subject to their respective owners' terms and availability.
