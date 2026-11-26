import { findUsdaFoods } from './usda-catalog';
import { barcodeSchema } from '../validation/nutrition';

interface CatalogProduct {
  code?: unknown;
  product_name?: unknown;
  product_name_ro?: unknown;
  brands?: unknown;
  countries?: string[];
  nutrition_data_per?: unknown;
  product_quantity_unit?: unknown;
  nutriments?: Record<string, unknown>;
}

const fields = 'code,product_name,product_name_ro,brands,product_quantity_unit,nutriments';
const origin = 'https://world.openfoodfacts.org';
const cache = new Map<
  string,
  {
    expires: number;
    foods: (
      | NonNullable<ReturnType<typeof mapProduct>>
      | ReturnType<typeof findUsdaFoods>[number]
    )[];
  }
>();

export function mapProduct(product: CatalogProduct) {
  const title = [product.product_name_ro, product.product_name].find(
    (name): name is string => typeof name === 'string' && !!name.trim(),
  );
  const barcode = barcodeSchema.safeParse(product.code);
  if (!title || !barcode.success) return null;
  const basis = product.product_quantity_unit === 'ml' ? 'ml' : 'g';
  const value = (key: string, max: number) => {
    const raw = product.nutriments?.[`${key}_100g`];
    if (typeof raw !== 'number' && (typeof raw !== 'string' || !raw.trim())) return null;
    const amount = Number(raw);
    return Number.isFinite(amount) && amount >= 0 && amount <= max ? amount : null;
  };
  const brand =
    typeof product.brands === 'string'
      ? product.brands
      : Array.isArray(product.brands)
        ? product.brands
            .filter((part): part is string => typeof part === 'string')
            .map((part) => part.replace(/^\w{2}:/, '').replaceAll('-', ' '))
            .join(', ')
        : '';
  const kcal = value('energy-kcal', 1000);
  const kj = value('energy-kj', 4200) ?? value('energy', 4200);
  return {
    name: title.trim().slice(0, 160),
    brand: brand.slice(0, 120),
    barcode: barcode.data,
    basis,
    origin: 'open-food-facts' as const,
    values: {
      kcal: kcal ?? (kj === null ? null : kj / 4.184),
      protein: value('proteins', 100),
      carbs: value('carbohydrates', 100),
      fat: value('fat', 100),
    },
  };
}

export async function findFoods(query: string, exactCode: boolean) {
  const key = `${exactCode}:${query.toLocaleLowerCase('ro')}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.foods;
  const params = new URLSearchParams({ fields });
  let endpoint = `${origin}/api/v2/product/${query}`;
  if (!exactCode) {
    endpoint = 'https://search.openfoodfacts.org/search';
    params.set('fields', fields + ',countries');
    params.set(
      'q',
      query
        .toLocaleLowerCase('ro')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .trim(),
    );
    params.set('langs', 'ro,en');
    params.set('page_size', '30');
    if (!params.get('q')) return [];
  }
  const generic = exactCode ? [] : findUsdaFoods(query);
  const unavailable = () =>
    Object.assign(new Error('The food catalog is temporarily unavailable.'), { status: 503 });
  let products: CatalogProduct[];
  try {
    const response = await fetch(`${endpoint}?${params}`, {
      headers: { 'User-Agent': 'FitTrack/1.0 (https://fittrack-angular-7ca07.web.app)' },
      signal: AbortSignal.timeout(5500),
    });
    if (exactCode && response.status === 404) return [];
    if (!response.ok) throw unavailable();
    const json = (await response.json()) as { product?: CatalogProduct; hits?: CatalogProduct[] };
    products = exactCode ? (json.product ? [json.product] : []) : (json.hits ?? []);
  } catch {
    if (generic.length) return generic;
    throw unavailable();
  }
  const soldInRomania = (product: CatalogProduct) =>
    Number(product.countries?.includes('en:romania') ?? false);
  if (!exactCode) products.sort((a, b) => soldInRomania(b) - soldInRomania(a));
  const packaged = products
    .map(mapProduct)
    .filter((food) => food !== null)
    .filter((food) => exactCode || Object.values(food.values).every((value) => value !== null))
    .slice(0, 15);
  const foods = [...packaged, ...generic];
  if (cache.size >= 250) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { expires: Date.now() + (foods.length ? 600_000 : 60_000), foods });
  return foods;
}
