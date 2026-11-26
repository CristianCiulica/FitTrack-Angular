import catalog from '../data/usda-sr-legacy.json';

const aliases: Record<string, string> = {
  alb: 'white',
  albus: 'egg white',
  ananas: 'pineapple',
  ardei: 'pepper',
  banana: 'banana',
  banane: 'banana',
  branza: 'cheese',
  broccoli: 'broccoli',
  cartof: 'potato',
  cartofi: 'potato',
  castravete: 'cucumber',
  ceapa: 'onion',
  ciuperci: 'mushrooms',
  conopida: 'cauliflower',
  crud: 'raw',
  cruda: 'raw',
  curcan: 'turkey',
  dovleac: 'pumpkin',
  fasole: 'beans',
  ficat: 'liver',
  fiert: 'boiled',
  fierte: 'boiled',
  fulgi: 'flakes',
  iaurt: 'yogurt',
  lapte: 'milk',
  lamaie: 'lemon',
  linte: 'lentils',
  mar: 'apple',
  mere: 'apple',
  miere: 'honey',
  morcov: 'carrot',
  morcovi: 'carrot',
  naut: 'chickpeas',
  nuci: 'walnuts',
  orez: 'rice',
  ou: 'egg',
  oua: 'egg',
  ovaz: 'oats',
  paine: 'bread',
  para: 'pear',
  paste: 'pasta',
  pepene: 'melon',
  peste: 'fish',
  piept: 'breast',
  porc: 'pork',
  portocala: 'orange',
  prajit: 'fried',
  pui: 'chicken',
  rosie: 'tomato',
  rosii: 'tomato',
  somon: 'salmon',
  spanac: 'spinach',
  struguri: 'grapes',
  ton: 'tuna',
  unt: 'butter',
  usturoi: 'garlic',
  ulei: 'oil',
  varza: 'cabbage',
  vita: 'beef',
  zahar: 'sugar',
};

function normalizedWords(label: string): string[] {
  return (
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .match(/[a-z0-9]+/g) ?? []
  );
}

const foods = (catalog as [number, string, number, number, number, number][]).map(
  ([fdcId, name, kcal, protein, carbs, fat]) => ({
    words: normalizedWords(name),
    food: {
      fdcId,
      name,
      basis: 'g' as const,
      origin: 'usda' as const,
      values: { kcal, protein, carbs, fat },
    },
  }),
);

export function findUsdaFoods(query: string) {
  const terms = normalizedWords(query)
    .filter((word) => !['de', 'cu', 'si', 'fara'].includes(word))
    .flatMap((word) => (aliases[word] ?? word).split(' '));
  if (!terms.length) return [];
  return foods
    .flatMap(({ words, food }) => {
      const positions = terms.map((term) =>
        words.findIndex((word) => word === term || (term.length >= 3 && word.startsWith(term))),
      );
      if (positions.some((position) => position < 0)) return [];
      const score = positions.reduce(
        (total, position, index) => total + position + (words[position] !== terms[index] ? 4 : 0),
        0,
      );
      return [{ food, score }];
    })
    .sort((a, b) => a.score - b.score || a.food.name.length - b.food.name.length)
    .slice(0, 12)
    .map((match) => match.food);
}
