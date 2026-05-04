export interface RGB {
  r: number;
  g: number;
  b: number;
}

type ExtractColorsFunction = (imageUrl: string) => Promise<RGB[]>;

// In-memory cache for product image colors
// In production, you should use Redis or store in database
const colorCache = new Map<string, RGB[]>();

/**
 * Get product image colors with caching
 * @param imageUrl - Product image URL
 * @param extractColorsFromUrl - Function to extract colors from URL
 * @returns Dominant colors
 */
export async function getCachedProductColors(
  imageUrl: string,
  extractColorsFromUrl: ExtractColorsFunction
): Promise<RGB[]> {
  const cached = colorCache.get(imageUrl);
  if (cached) {
    return cached;
  }

  const colors = await extractColorsFromUrl(imageUrl);

  // Cache for 1 hour
  colorCache.set(imageUrl, colors);

  // Clear cache after 1 hour
  setTimeout(
    () => {
      colorCache.delete(imageUrl);
    },
    60 * 60 * 1000
  );

  return colors;
}

/**
 * Clear the color cache (useful for testing or manual refresh)
 */
export function clearColorCache(): void {
  colorCache.clear();
}

export { colorCache };
