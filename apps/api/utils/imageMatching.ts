import sharp from "sharp";
import fetch from "node-fetch";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

interface RGBCount extends RGB {
  count: number;
}

export interface ImageMetadata {
  width: number | undefined;
  height: number | undefined;
  format: string | undefined;
  hasAlpha: boolean | undefined;
}

/**
 * Extract dominant colors from an image buffer
 * @param imageBuffer - Image buffer
 * @returns Array of dominant colors in RGB format
 */
export async function extractDominantColors(
  imageBuffer: Buffer
): Promise<RGB[]> {
  try {
    const image = sharp(imageBuffer);
    const { data, info } = await image
      .resize(100, 100, { fit: "inside" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Sample colors from the image
    const colors: RGB[] = [];
    const sampleSize = 10; // Sample every 10th pixel to reduce processing time

    for (let i = 0; i < data.length; i += info.channels * sampleSize) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Skip very dark or very light colors (likely background)
      if (
        (r + g + b) / 3 > 30 &&
        (r + g + b) / 3 < 225 &&
        r !== undefined &&
        g !== undefined &&
        b !== undefined
      ) {
        colors.push({ r, g, b });
      }
    }

    // Group similar colors and find dominant ones
    const dominantColors = findDominantColors(colors, 5);
    return dominantColors;
  } catch (error) {
    console.error("Error extracting colors:", error);
    return [];
  }
}

/**
 * Extract dominant colors from a URL
 * @param imageUrl - Image URL
 * @returns Array of dominant colors in RGB format
 */
export async function extractColorsFromUrl(imageUrl: string): Promise<RGB[]> {
  try {
    // Handle cloudinary URLs
    let fetchUrl = imageUrl;
    if (imageUrl.includes("cloudinary.com")) {
      // Use a smaller version for faster processing
      fetchUrl = imageUrl.replace("/upload/", "/upload/w_100,h_100,c_fill/");
    }

    const response = await fetch(fetchUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return await extractDominantColors(buffer);
  } catch (error) {
    console.error("Error extracting colors from URL:", error);
    return [];
  }
}

/**
 * Find dominant colors using simple clustering
 * @param colors - Array of color objects {r, g, b}
 * @param numColors - Number of dominant colors to find
 * @returns Array of dominant colors
 */
function findDominantColors(colors: RGB[], numColors = 5): RGB[] {
  if (colors.length === 0) return [];

  // Simple k-means-like clustering
  const clusters: RGBCount[] = [];

  // Initialize clusters with first few colors
  for (let i = 0; i < Math.min(numColors, colors.length); i++) {
    clusters.push({
      r: colors[i].r,
      g: colors[i].g,
      b: colors[i].b,
      count: 0,
    });
  }

  // Assign colors to nearest cluster
  colors.forEach((color) => {
    let minDistance = Infinity;
    let nearestCluster = 0;

    clusters.forEach((cluster, index) => {
      const distance = colorDistance(color, cluster);
      if (distance < minDistance) {
        minDistance = distance;
        nearestCluster = index;
      }
    });

    clusters[nearestCluster].count++;
  });

  // Sort by count and return top colors
  return clusters
    .sort((a, b) => b.count - a.count)
    .slice(0, numColors)
    .map(({ r, g, b }) => ({ r, g, b }));
}

/**
 * Calculate color distance (Euclidean distance in RGB space)
 * @param color1 - First color {r, g, b}
 * @param color2 - Second color {r, g, b}
 * @returns Distance between colors
 */
export function colorDistance(color1: RGB, color2: RGB): number {
  return Math.sqrt(
    Math.pow(color1.r - color2.r, 2) +
      Math.pow(color1.g - color2.g, 2) +
      Math.pow(color1.b - color2.b, 2)
  );
}

/**
 * Calculate similarity between two sets of dominant colors
 * @param colors1 - First set of dominant colors
 * @param colors2 - Second set of dominant colors
 * @returns Similarity score (0-100, higher is more similar)
 */
export function calculateColorSimilarity(
  colors1: RGB[],
  colors2: RGB[]
): number {
  if (!colors1.length || !colors2.length) return 0;

  let totalSimilarity = 0;
  let comparisons = 0;

  // Compare each color in set1 with closest color in set2
  colors1.forEach((color1) => {
    let minDistance = Infinity;

    colors2.forEach((color2) => {
      const distance = colorDistance(color1, color2);
      if (distance < minDistance) {
        minDistance = distance;
      }
    });

    // Convert distance to similarity (0-100)
    // Max distance in RGB space is sqrt(255^2 * 3) ≈ 441
    // Use stricter threshold - only consider good matches
    const similarity = Math.max(0, 100 - (minDistance / 300) * 100);
    totalSimilarity += similarity;
    comparisons++;
  });

  // Also check reverse - colors from set2 to set1
  let reverseSimilarity = 0;
  let reverseComparisons = 0;

  colors2.forEach((color2) => {
    let minDistance = Infinity;

    colors1.forEach((color1) => {
      const distance = colorDistance(color1, color2);
      if (distance < minDistance) {
        minDistance = distance;
      }
    });

    const similarity = Math.max(0, 100 - (minDistance / 300) * 100);
    reverseSimilarity += similarity;
    reverseComparisons++;
  });

  // Average both directions for better accuracy
  const forwardScore = comparisons > 0 ? totalSimilarity / comparisons : 0;
  const reverseScore =
    reverseComparisons > 0 ? reverseSimilarity / reverseComparisons : 0;

  return (forwardScore + reverseScore) / 2;
}

/**
 * Get image dimensions and format
 * @param imageBuffer - Image buffer
 * @returns Image metadata
 */
export async function getImageMetadata(
  imageBuffer: Buffer
): Promise<ImageMetadata | null> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      hasAlpha: metadata.hasAlpha,
    };
  } catch (error) {
    console.error("Error getting image metadata:", error);
    return null;
  }
}
