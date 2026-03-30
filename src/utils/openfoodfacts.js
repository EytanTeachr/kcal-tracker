// Open Food Facts API - free, no API key needed

export async function lookupBarcode(barcode) {
  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`
  );

  if (!response.ok) {
    throw new Error('Erreur lors de la recherche du produit');
  }

  const data = await response.json();

  if (data.status !== 1 || !data.product) {
    throw new Error('Produit non trouvé dans la base de données');
  }

  const product = data.product;
  const nutriments = product.nutriments || {};

  // Get kcal per 100g
  const kcalPer100g = nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || null;

  // Get serving size info
  const servingSize = product.serving_size || null;
  const kcalPerServing = nutriments['energy-kcal_serving'] || null;

  return {
    name: product.product_name || product.product_name_fr || 'Produit inconnu',
    brand: product.brands || '',
    image: product.image_front_small_url || product.image_url || null,
    kcalPer100g,
    kcalPerServing,
    servingSize,
    barcode,
  };
}
