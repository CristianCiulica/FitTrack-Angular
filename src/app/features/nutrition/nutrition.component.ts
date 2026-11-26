import { WeekCalendarComponent } from '../../shared/components/week-calendar/week-calendar.component';
import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import {
  Food,
  FoodEntry,
  ImportedRecipe,
  Meal,
  NutritionRecord,
  Portion,
  Recipe,
  SavedFood,
  SavedMeal,
  meals,
} from '../../core/models/nutrition.model';
import { ApiService } from '../../core/services/api.service';
import { ProfileService } from '../../core/services/profile.service';
import { WeightService } from '../../core/services/weight.service';
import { profileCalorieTarget } from '../../core/utils/nutrition-target';
import { localDateKey } from '../../core/utils/weight-progress';
import { AppMenuComponent } from '../../shared/components/app-menu/app-menu.component';
import {
  barcodePattern,
  emptyNutrients,
  moveDate,
  portionNutrients,
  recipeFood,
  suggestTarget,
  summarize,
  weeklyNutrition,
} from './nutrition-math';
import { scanFood } from './food-scanner';

const manualFood = (name = '', barcode?: string): Food => ({
  name,
  barcode,
  origin: 'manual',
  basis: 'serving',
  values: emptyNutrients(),
});
const fromApi = '/nutrition';

@Component({
  selector: 'app-nutrition',
  imports: [
    AppMenuComponent,
    WeekCalendarComponent,
    DatePipe,
    DecimalPipe,
    NgTemplateOutlet,
    FormsModule,
    RouterLink,
  ],
  templateUrl: './nutrition.component.html',
  styleUrl: './nutrition.component.scss',
})
export class NutritionComponent {
  private readonly zone = inject(NgZone);
  private readonly api = inject(ApiService);
  private readonly profile = inject(ProfileService);
  private readonly weight = inject(WeightService);
  private readonly destroy = inject(DestroyRef);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('editor');
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly scannerFrame = viewChild.required<ElementRef<HTMLElement>>('scannerFrame');
  private scanner?: AbortController;
  private loadVersion = 0;
  private catalogVersion = 0;
  private catalogRequest?: AbortController;
  private transfer?: { key: string; records: NutritionRecord[] };
  private alive = true;

  readonly today = localDateKey();
  readonly date = signal(this.today);
  readonly records = signal<NutritionRecord[]>([]);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly meals = meals;
  readonly portionUnits = [
    { id: 'g', label: 'Grams' },
    { id: 'ml', label: 'ml' },
    { id: 'serving', label: 'Servings' },
  ] as const;
  readonly moveDateForTemplate = moveDate;
  readonly macros = [
    { key: 'protein', label: 'Protein' },
    { key: 'carbs', label: 'Carbs' },
    { key: 'fat', label: 'Fat' },
  ] as const;
  readonly facts = [{ key: 'kcal', label: 'Calories (kcal)' }, ...this.macros] as const;
  readonly totals = computed(() => summarize(this.entriesFor(this.date())));
  readonly target = computed(() => {
    const profile = this.profile.profile();
    return profile ? profileCalorieTarget(profile) : null;
  });
  readonly reportOpen = signal(false);
  readonly foodDates = computed(
    () => new Set(this.records().flatMap((row) => (row.kind === 'entry' ? [row.date] : []))),
  );
  readonly calorieProgress = computed(() => {
    const target = this.target();
    return this.loaded() && target ? Math.min(100, (this.totals().values.kcal / target) * 100) : 0;
  });
  readonly remaining = computed(() => (this.target() ?? 0) - this.totals().values.kcal);
  readonly complete = computed(() => this.records().some((row) => row.id === `day-${this.date()}`));
  readonly week = computed(() => weeklyNutrition(this.records(), this.date()));
  readonly loggedDays = computed(() => this.week().filter((day) => day.count > 0).length);
  readonly average = computed(() =>
    Object.fromEntries(
      this.facts.map(({ key }) => {
        const days = this.week().filter((day) => day.count && !day.incomplete[key]);
        return [
          key,
          {
            count: days.length,
            value: days.length
              ? days.reduce((sum, day) => sum + day.values[key], 0) / days.length
              : 0,
          },
        ];
      }),
    ),
  );
  readonly suggestion = signal<number | null>(null);

  readonly pane = signal<'find' | 'portion' | 'library' | 'recipe' | 'copy' | 'save-meal'>('find');
  readonly activeMeal = signal<Meal>('breakfast');
  readonly scanning = signal(false);
  readonly detectedCode = signal('');
  readonly results = signal<Food[]>([]);
  readonly editorError = signal('');
  readonly catalogMessage = signal('');
  readonly searching = signal(false);
  readonly importsBusy = signal(false);
  readonly library = computed(() =>
    this.records().filter(
      (row) => row.kind === 'food' || row.kind === 'recipe' || row.kind === 'meal',
    ),
  );
  readonly recent = computed(() => {
    const entries = this.records().filter((row) => row.kind === 'entry');
    const foods = new Map<string, Food>();
    for (const entry of [...entries].reverse().sort((a, b) => b.date.localeCompare(a.date))) {
      if (entry.food.values.kcal === null) continue;
      const key = entry.food.barcode ?? entry.food.name.toLocaleLowerCase();
      if (!foods.has(key)) foods.set(key, entry.food);
    }
    return Array.from(foods.values()).slice(0, 8);
  });

  food = signal<Food>(manualFood());
  amount: number | null = 1;
  editId: string | null = null;
  ingredientIndex: number | null = null;
  private entryId = '';
  private favoriteId = '';
  name = '';
  query = '';
  missingCode = '';
  copiedDate = moveDate(this.today, -1);
  copiedMeal: Meal = 'breakfast';
  recipe = signal<Recipe>(this.emptyRecipe());
  recipeUrl = '';
  recipeNotes: string[] = [];

  constructor() {
    this.profile
      .load()
      .pipe(takeUntilDestroyed())
      .subscribe({ error: () => {} });
    this.destroy.onDestroy(() => {
      this.alive = false;
      this.stopCamera();
      this.invalidateCatalog();
    });
    void this.load(this.today);
  }

  amountText(portion: Portion) {
    const unit = portion.food.basis;
    return `${portion.amount} ${unit === 'serving' && portion.amount !== 1 ? 'servings' : unit}`;
  }
  portionEnergy(portion: Portion) {
    return portionNutrients(portion).kcal;
  }
  entriesFor(date: string, meal?: Meal): FoodEntry[] {
    return this.records().filter(
      (row): row is FoodEntry =>
        row.kind === 'entry' && row.date === date && (!meal || row.meal === meal),
    );
  }
  async load(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '1900-01-01' || date > this.today) return;
    if (this.busy()) return;
    const version = ++this.loadVersion;
    this.date.set(date);
    this.error.set('');
    this.loaded.set(false);
    this.suggestion.set(null);
    const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
    const weekEnd = moveDate(date, (7 - weekday) % 7);
    const to = weekEnd < this.today ? weekEnd : this.today;
    const from = moveDate(
      date,
      -Math.min(28, Math.round((Date.parse(date) - Date.parse('1900-01-01')) / 86_400_000)),
    );
    try {
      const { records } = await firstValueFrom(
        this.api
          .get<{
            records: NutritionRecord[];
          }>(fromApi, { params: { from, to }, timeout: 20_000 })
          .pipe(takeUntilDestroyed(this.destroy)),
      );
      if (!this.alive || version !== this.loadVersion) return;
      this.records.set(records);
      this.loaded.set(true);
    } catch {
      if (this.alive && version === this.loadVersion)
        this.error.set('Your diary could not load. Try again.');
    }
  }
  macroShare(
    values: { protein: number; carbs: number; fat: number },
    key: 'protein' | 'carbs' | 'fat',
  ) {
    const energy = values.protein * 4 + values.carbs * 4 + values.fat * 9;
    return energy ? ((values[key] * (key === 'fat' ? 9 : 4)) / energy) * 100 : 0;
  }
  readonly summarize = summarize;
  readonly portionNutrients = portionNutrients;

  openAdd(meal: Meal, camera = false) {
    this.open(meal, 'find');
    if (camera) void this.startCamera();
  }
  openEdit(entry: FoodEntry) {
    this.open(entry.meal, 'portion');
    this.chooseFood(entry.food, entry.amount);
    this.editId = entry.id;
  }
  openLibrary() {
    this.open('breakfast', 'library');
  }
  openCopy(meal: Meal) {
    this.open(meal, 'copy');
    this.copiedDate = moveDate(this.date(), -1);
    this.copiedMeal = meal;
  }
  openSaveMeal(meal: Meal) {
    this.open(meal, 'save-meal');
    this.name = meals.find((item) => item.id === meal)!.name;
  }

  private open(meal: Meal, pane: ReturnType<typeof this.pane>) {
    if (!this.loaded() || this.busy()) return;
    this.activeMeal.set(meal);
    this.pane.set(pane);
    this.editorError.set('');
    this.catalogMessage.set('');
    this.query = '';
    this.results.set([]);
    this.missingCode = '';
    this.detectedCode.set('');
    this.editId = null;
    this.ingredientIndex = null;
    this.transfer = undefined;
    this.dialog().nativeElement.showModal();
  }

  close() {
    if (this.busy()) return;
    this.stopCamera();
    this.invalidateCatalog();
    this.dialog().nativeElement.close();
  }
  editorClosed() {
    if (this.dialog().nativeElement.open) return;
    this.stopCamera();
    this.invalidateCatalog();
  }

  setMeal(meal: Meal) {
    this.activeMeal.set(meal);
  }

  quickAdd() {
    this.chooseFood(manualFood('Quick add'));
  }

  manual(code = '') {
    this.chooseFood(manualFood('', barcodePattern.test(code) ? code : undefined));
  }

  chooseFood(food: Food, amount = food.basis === 'serving' ? 1 : 100) {
    this.invalidateCatalog();
    this.stopCamera();
    if (this.ingredientIndex !== null) {
      const previous = this.recipe().ingredients[this.ingredientIndex];
      this.patchIngredient(this.ingredientIndex, {
        food,
        amount: previous.food.basis === food.basis ? previous.amount : amount,
      });
      this.returnToRecipe();
      return;
    }
    this.food.set({ ...food, values: { ...food.values } });
    this.amount = amount;
    this.entryId = crypto.randomUUID();
    this.favoriteId = crypto.randomUUID();
    this.editorError.set('');
    this.pane.set('portion');
  }

  setFood(patch: Partial<Food>) {
    this.food.update((food) => ({ ...food, ...patch }));
  }
  setNutrient(key: keyof Food['values'], value: number | null) {
    this.food.update((food) => ({ ...food, values: { ...food.values, [key]: value } }));
  }

  async startCamera() {
    if (this.scanning()) return;
    this.invalidateCatalog();
    this.catalogMessage.set('');
    this.editorError.set('');
    const request = new AbortController();
    this.scanner = request;
    this.detectedCode.set('');
    this.scanning.set(true);
    try {
      await scanFood(
        this.video().nativeElement,
        this.scannerFrame().nativeElement,
        request.signal,
        (code) => {
          this.zone.run(() => {
            if (request.signal.aborted) return;
            this.detectedCode.set(code);
            void this.search(code, true);
          });
        },
      );
    } catch {
      if (!request.signal.aborted) {
        this.stopCamera();
        this.editorError.set('Camera unavailable. Allow camera access or enter the barcode below.');
      }
    }
  }
  stopCamera() {
    this.scanner?.abort();
    this.scanner = undefined;
    this.scanning.set(false);
  }

  private invalidateCatalog() {
    this.catalogVersion++;
    this.catalogRequest?.abort();
    this.searching.set(false);
  }

  async search(value = this.query, scanned = false) {
    this.stopCamera();
    this.invalidateCatalog();
    const query = value.trim();
    this.query = query;
    const code = barcodePattern.test(query);
    this.results.set([]);
    this.editorError.set('');
    this.missingCode = code ? query : '';
    if (query.length < 2 || (/^\d+$/.test(query) && !code)) {
      this.catalogMessage.set('Enter a food name or an 8, 12, 13 or 14 digit barcode.');
      return;
    }
    const saved = this.library().find(
      (row): row is SavedFood => row.kind === 'food' && code && row.food.barcode === query,
    );
    if (saved) {
      this.chooseFood(saved.food);
      return;
    }
    const local = this.library().filter(
      (row): row is SavedFood =>
        row.kind === 'food' &&
        row.food.values.kcal !== null &&
        row.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    );
    this.catalogMessage.set('');
    this.searching.set(true);
    const version = this.catalogVersion;
    // Use HttpClient through ApiService and cancel stale subscriptions, including retry timers.
    const cancel = new AbortController();
    this.catalogRequest = cancel;
    try {
      const response = await this.getCatalog(code, query, cancel.signal);
      if (version !== this.catalogVersion) return;
      if (code && response.foods.length === 1) {
        this.chooseFood(response.foods[0]);
        return;
      }
      const choices = [...local.map((row) => row.food), ...response.foods];
      this.results.set(choices);
      if (!choices.length) {
        if (scanned && this.ingredientIndex === null) {
          this.manual(query);
          this.editorError.set('Barcode detected. Add the product name and values from the label.');
        } else this.catalogMessage.set('Food not found. You can add it from the label.');
      }
    } catch {
      if (version !== this.catalogVersion) return;
      if (scanned && this.ingredientIndex === null) {
        this.manual(query);
        this.editorError.set(
          'Barcode detected. The catalog did not respond. You can enter the label here.',
        );
        return;
      }
      this.results.set(local.map((row) => row.food));
      this.catalogMessage.set(
        'Catalog unavailable. You can still use a saved food or add it from the label.',
      );
    } finally {
      if (version === this.catalogVersion) this.searching.set(false);
    }
  }

  private getCatalog(code: boolean, query: string, signal: AbortSignal) {
    return firstValueFrom(
      this.api
        .getOnce<{
          foods: Food[];
        }>(code ? `${fromApi}/catalog/${query}` : `${fromApi}/catalog`, {
          params: code ? {} : { q: query },
          timeout: 8_000,
        })
        .pipe(takeUntilDestroyed(this.destroy), takeUntil(fromEvent(signal, 'abort'))),
    );
  }

  private validFood(food: Food) {
    return (
      !!food.name.trim() &&
      (!food.barcode || barcodePattern.test(food.barcode)) &&
      Object.values(food.values).every(
        (value) => value === null || (Number.isFinite(value) && value >= 0 && value <= 100_000),
      )
    );
  }
  private validAmount(amount: number | null): amount is number {
    return amount !== null && Number.isFinite(amount) && amount > 0 && amount <= 100_000;
  }
  private async write(records: NutritionRecord[]) {
    if (this.busy()) return false;
    this.busy.set(true);
    this.editorError.set('');
    try {
      const response = await firstValueFrom(
        this.api.put<{ records: NutritionRecord[] }>(fromApi, records),
      );
      if (!this.alive) return false;
      this.records.update((current) => {
        const rows = new Map(current.map((row) => [row.id, row]));
        for (const row of response.records) rows.set(row.id, row);
        return [...rows.values()];
      });
      return true;
    } catch {
      if (this.alive) this.editorError.set('Could not save. Check your connection and try again.');
      return false;
    } finally {
      this.busy.set(false);
    }
  }
  async saveEntry() {
    const food = this.food();
    if (!this.validFood(food) || food.values.kcal === null || !this.validAmount(this.amount)) {
      this.editorError.set('Enter the food name, portion and calories from the label.');
      return;
    }
    const existing = this.library().find(
      (row): row is SavedFood =>
        row.kind === 'food' && !!food.barcode && row.food.barcode === food.barcode,
    );
    const entry: FoodEntry = {
      kind: 'entry',
      id: this.editId ?? this.entryId,
      date: this.date(),
      meal: this.activeMeal(),
      food,
      amount: this.amount,
    };
    const rows: NutritionRecord[] = [entry];
    if (food.barcode && food.origin === 'manual')
      rows.push({
        kind: 'food',
        id: existing?.id ?? this.favoriteId,
        name: food.name,
        food,
      });
    if (await this.write(rows)) this.close();
  }
  async favorite() {
    const food = this.food();
    if (!this.validFood(food) || food.values.kcal === null) {
      this.editorError.set('Enter the food name and calories before saving.');
      return;
    }
    const existing = this.library().find(
      (row) =>
        row.kind === 'food' &&
        (food.barcode ? row.food.barcode === food.barcode : row.name === food.name),
    );
    const saved = await this.write([
      { kind: 'food', id: existing?.id ?? this.favoriteId, name: food.name, food },
    ]);
    if (saved) this.editorError.set('Saved to your foods.');
  }
  async remove(id: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.editorError.set('');
    let removed = false;
    try {
      await firstValueFrom(this.api.delete(`${fromApi}/${id}`));
      if (this.alive) this.records.update((rows) => rows.filter((row) => row.id !== id));
      removed = true;
    } catch {
      this.editorError.set('Could not remove this item. Try again.');
    } finally {
      this.busy.set(false);
    }
    if (removed && this.editId === id && this.alive) this.close();
  }

  private async transferItems(items: Portion[], key: string) {
    if (!items.length || items.length > 100) {
      this.editorError.set('Choose a meal with between 1 and 100 foods.');
      return;
    }
    const transferKey = `${this.date()}:${this.activeMeal()}:${key}`;
    if (this.transfer?.key !== transferKey) {
      this.transfer = {
        key: transferKey,
        records: items.map(
          ({ food, amount }): FoodEntry => ({
            id: crypto.randomUUID(),
            kind: 'entry',
            date: this.date(),
            meal: this.activeMeal(),
            food,
            amount,
          }),
        ),
      };
    }
    if (await this.write(this.transfer.records)) this.close();
  }

  async copyMeal() {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(this.copiedDate) ||
      this.copiedDate < '1900-01-01' ||
      this.copiedDate >= this.date() ||
      this.busy()
    )
      return;
    const sourceDate = this.copiedDate;
    const sourceMeal = this.copiedMeal;
    let entries: FoodEntry[];
    this.busy.set(true);
    try {
      const data = await firstValueFrom(
        this.api.getOnce<{ records: NutritionRecord[] }>(fromApi, {
          params: { from: sourceDate, to: sourceDate },
          timeout: 20_000,
        }),
      );
      if (!this.alive) return;
      entries = data.records.filter(
        (row): row is FoodEntry =>
          row.kind === 'entry' && row.date === sourceDate && row.meal === sourceMeal,
      );
    } catch {
      this.editorError.set('Could not read that day. Try again.');
      return;
    } finally {
      this.busy.set(false);
    }
    await this.transferItems(entries, `${sourceDate}:${sourceMeal}`);
  }

  async saveMeal() {
    const name = this.name.trim();
    const items = this.entriesFor(this.date(), this.activeMeal()).map(({ amount, food }) => ({
      amount,
      food,
    }));
    if (!name || !items.length || items.length > 100) {
      this.editorError.set('Name a meal with up to 100 foods.');
      return;
    }
    const row: SavedMeal = {
      id: this.transfer?.records[0].id ?? crypto.randomUUID(),
      name,
      kind: 'meal',
      items,
    };
    this.transfer = { key: 'save-meal', records: [row] };
    if (await this.write([row])) this.close();
  }
  addSavedMeal(meal: SavedMeal) {
    return this.transferItems(meal.items, meal.id);
  }

  private emptyRecipe(): Recipe {
    return {
      id: crypto.randomUUID(),
      kind: 'recipe',
      name: '',
      ingredients: [],
      servings: 1,
      cookedGrams: null,
    };
  }
  openRecipe(row?: Recipe) {
    this.editorError.set('');
    this.recipe.set(row ? structuredClone(row) : this.emptyRecipe());
    this.recipeUrl = '';
    this.recipeNotes = [];
    this.pane.set('recipe');
  }
  patchRecipe(patch: Partial<Recipe>) {
    this.recipe.update((recipe) => ({ ...recipe, ...patch }));
  }
  addIngredient(food = manualFood()) {
    if (this.recipe().ingredients.length >= 100) return;
    this.patchRecipe({
      ingredients: [
        ...this.recipe().ingredients,
        { food, amount: food.basis === 'serving' ? 1 : 100 },
      ],
    });
    this.recipeNotes.push('');
  }
  findIngredient(index: number) {
    this.ingredientIndex = index;
    this.query = this.recipe().ingredients[index].food.name;
    this.results.set([]);
    this.catalogMessage.set('');
    this.editorError.set('');
    this.pane.set('find');
  }
  returnToRecipe() {
    this.invalidateCatalog();
    this.stopCamera();
    this.ingredientIndex = null;
    this.editorError.set('');
    this.pane.set('recipe');
  }
  patchIngredientFood(index: number, patch: Partial<Food>) {
    this.patchIngredient(index, { food: { ...this.recipe().ingredients[index].food, ...patch } });
  }
  patchIngredientNutrient(index: number, key: keyof Food['values'], value: number | null) {
    this.patchIngredientFood(index, {
      values: { ...this.recipe().ingredients[index].food.values, [key]: value },
    });
  }
  patchIngredient(index: number, patch: Partial<Portion>) {
    this.patchRecipe({
      ingredients: this.recipe().ingredients.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    });
  }
  removeIngredient(index: number) {
    this.patchRecipe({ ingredients: this.recipe().ingredients.filter((_, i) => i !== index) });
    this.recipeNotes.splice(index, 1);
  }
  async importRecipe() {
    if (this.importsBusy() || !this.recipeUrl.trim() || this.recipe().ingredients.length) return;
    this.importsBusy.set(true);
    this.editorError.set('');
    const id = this.recipe().id;
    try {
      const result = await firstValueFrom(
        this.api.post<ImportedRecipe>(`${fromApi}/recipe-import`, { url: this.recipeUrl.trim() }),
      );
      if (
        !this.alive ||
        !this.dialog().nativeElement.open ||
        this.recipe().id !== id ||
        this.pane() !== 'recipe'
      )
        return;
      this.recipeNotes = result.ingredients;
      const ingredients = result.ingredients.map((line) => {
        const match = line.match(/^(\d+(?:[.,]\d+)?)\s*(kg|ml|g|l)\b\s*(?:of\s+|de\s+)?(.+)/i);
        if (!match) return { food: manualFood(line.slice(0, 160)), amount: 1 };
        const unit = match[2].toLowerCase();
        return {
          food: {
            ...manualFood(match[3].slice(0, 160)),
            basis: unit === 'ml' || unit === 'l' ? ('ml' as const) : ('g' as const),
          },
          amount: Number(match[1].replace(',', '.')) * (unit === 'kg' || unit === 'l' ? 1000 : 1),
        };
      });
      this.patchRecipe({ name: result.name, servings: result.servings ?? 1, ingredients });
    } catch {
      if (
        this.alive &&
        this.dialog().nativeElement.open &&
        this.recipe().id === id &&
        this.pane() === 'recipe'
      ) {
        this.editorError.set(
          'Could not read a recipe from that link. You can add the ingredients yourself.',
        );
      }
    } finally {
      this.importsBusy.set(false);
    }
  }
  async saveRecipe() {
    const recipe = this.recipe();
    if (
      !recipe.name.trim() ||
      !recipe.ingredients.length ||
      !Number.isInteger(recipe.servings) ||
      recipe.servings < 1 ||
      recipe.servings > 1000 ||
      (recipe.cookedGrams !== null && !this.validAmount(recipe.cookedGrams)) ||
      recipe.ingredients.some((row) => !this.validFood(row.food) || !this.validAmount(row.amount))
    ) {
      this.editorError.set('Enter a recipe name, portions and valid ingredient amounts.');
      return;
    }
    if (await this.write([recipe])) {
      this.editorError.set('');
      this.pane.set('library');
    }
  }
  logRecipe(recipe: Recipe, byWeight: boolean) {
    this.chooseFood(recipeFood(recipe, byWeight));
  }

  async toggleComplete() {
    const id = `day-${this.date()}`;
    if (this.complete()) await this.remove(id);
    else await this.write([{ id, date: this.date(), kind: 'complete' }]);
    this.error.set(this.editorError());
    this.suggestion.set(null);
  }
  async checkSuggestion() {
    const profile = this.profile.profile(),
      target = this.target();
    if (!profile || !target || this.busy() || this.date() !== this.today) return;
    const reviewDate = profile.nutritionCalorieReviewDate;
    if (reviewDate && reviewDate > moveDate(this.today, -7)) {
      this.error.set('Your calorie target was reviewed this week.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const weights = await firstValueFrom(
        this.weight.getEntries().pipe(takeUntilDestroyed(this.destroy)),
      );
      const suggestion = suggestTarget(this.records(), weights, this.today, profile, target);
      this.suggestion.set(suggestion);
      if (!suggestion)
        this.error.set(
          'A suggestion needs 21 complete food days and at least four weigh-ins in each end week. With enough data, small differences keep your current target.',
        );
    } catch {
      this.error.set('Could not check your weight history. Try again.');
    } finally {
      this.busy.set(false);
    }
  }
  async applySuggestion() {
    const target = this.suggestion();
    if (!target || this.busy()) return;
    this.busy.set(true);
    try {
      await firstValueFrom(
        this.profile.patch({
          nutritionCalorieOverride: target,
          nutritionCalorieReviewDate: this.today,
        }),
      );
      this.suggestion.set(null);
    } catch {
      this.error.set('Could not update your calorie target. Try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
