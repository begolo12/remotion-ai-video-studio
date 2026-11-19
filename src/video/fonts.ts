import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";

/**
 * Font di-bundle lewat @remotion/google-fonts (OFL) dan `loadFont()` otomatis
 * menahan render sampai file font siap. Tanpa ini, frame pertama memakai font
 * fallback lalu "melompat" saat font selesai dimuat.
 */
const anton = loadAnton("normal", { weights: ["400"], subsets: ["latin"] });
const inter = loadInter("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] });
const playfair = loadPlayfair("normal", { weights: ["500", "700", "800"], subsets: ["latin"] });
const spaceGrotesk = loadSpaceGrotesk("normal", { weights: ["500", "600", "700"], subsets: ["latin"] });

export const FONT = {
  impact: anton.fontFamily,
  sans: inter.fontFamily,
  serif: playfair.fontFamily,
  grotesk: spaceGrotesk.fontFamily,
} as const;

/** Dipakai test/skrip untuk memastikan semua font selesai dimuat. */
export const waitForFonts = async () => {
  await Promise.all([
    anton.waitUntilDone(),
    inter.waitUntilDone(),
    playfair.waitUntilDone(),
    spaceGrotesk.waitUntilDone(),
  ]);
};
