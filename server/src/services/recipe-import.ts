import { Resolver } from 'node:dns/promises';
import { get } from 'node:https';
import { parse } from 'ipaddr.js';

const resolver = new Resolver({ timeout: 1500, tries: 1 });
const maxBytes = 1_500_000;
const invalid = () =>
  Object.assign(new Error('Could not import a recipe from this public HTTPS page.'), {
    status: 422,
  });

async function fetchRecipeHtml(url: URL, signal: AbortSignal, redirects = 0): Promise<string> {
  if (
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    redirects > 3 ||
    !url.hostname.includes('.') ||
    !/[a-z]$/i.test(url.hostname)
  )
    throw invalid();
  const addresses = await resolver.resolve4(url.hostname);
  const address = addresses.find((ip) => parse(ip).range() === 'unicast');
  if (!address || signal.aborted) throw invalid();

  // Pin the connection to the checked public address while preserving hostname and TLS validation.
  return new Promise((resolve, reject) => {
    const request = get(
      url,
      {
        family: 4,
        signal,
        lookup: (_host, options, callback) => {
          if (options.all) callback(null, [{ address, family: 4 }]);
          else callback(null, address, 4);
        },
        headers: { Accept: 'text/html', 'User-Agent': 'FitTrack/1.0' },
      },
      (response) => {
        if (
          [301, 302, 303, 307, 308].includes(response.statusCode ?? 0) &&
          response.headers.location
        ) {
          response.destroy();
          Promise.resolve()
            .then(() =>
              fetchRecipeHtml(new URL(response.headers.location!, url), signal, redirects + 1),
            )
            .then(resolve, reject);
          return;
        }
        if (
          response.statusCode !== 200 ||
          !response.headers['content-type']?.includes('text/html')
        ) {
          response.destroy();
          reject(invalid());
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            response.destroy();
            reject(invalid());
          } else chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      },
    );
    request.on('error', reject);
  });
}

function findRecipe(data: unknown, depth = 0): Record<string, unknown> | undefined {
  if (depth > 10 || typeof data !== 'object' || !data) return;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipe(item, depth + 1);
      if (found) return found;
    }
    return;
  }
  const node = data as Record<string, unknown>;
  if (
    [node['@type']].flat().some((type) => typeof type === 'string' && /(?:^|\/)Recipe$/.test(type))
  )
    return node;
  return findRecipe(node['@graph'], depth + 1) ?? findRecipe(node.mainEntity, depth + 1);
}

export function parseRecipeHtml(html: string) {
  for (const script of html.matchAll(
    /<script\b[^>]*\btype\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json\b)[^>]*>([\s\S]*?)<\/script\s*>/gi,
  )) {
    try {
      const recipe = findRecipe(JSON.parse(script[1]));
      if (!recipe || !Array.isArray(recipe.recipeIngredient)) continue;
      const ingredients = recipe.recipeIngredient
        .filter((value): value is string => typeof value === 'string' && !!value.trim())
        .slice(0, 100)
        .map((value) => value.trim().slice(0, 250));
      if (!ingredients.length) continue;
      const yieldText = String([recipe.recipeYield].flat()[0] ?? '');
      const count = Number(yieldText.match(/^\s*(\d{1,3})\b/)?.[1]);
      return {
        name: typeof recipe.name === 'string' ? recipe.name.trim().slice(0, 160) : '',
        ingredients,
        servings: count || null,
      };
    } catch {
      // Pages can include unrelated or invalid JSON-LD blocks.
    }
  }
  return null;
}

export async function importRecipe(raw: string) {
  try {
    const html = await fetchRecipeHtml(new URL(raw), AbortSignal.timeout(5500));
    const recipe = parseRecipeHtml(html);
    if (recipe) return recipe;
  } catch {
    throw invalid();
  }
  throw invalid();
}
