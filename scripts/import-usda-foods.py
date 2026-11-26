"""Build the compact FitTrack catalog from USDA FoodData Central SR Legacy CSV (CC0).
Download FoodData_Central_sr_legacy_food_csv_2018-04.zip from
https://fdc.nal.usda.gov/download-datasets/ and pass its path as the argument.
"""

import csv
import io
import json
import math
from pathlib import Path
import sys
from zipfile import ZipFile

NUTRIENTS = ("1008", "1003", "1005", "1004")  # kcal, protein, carbohydrate, fat


def read_rows(archive, filename):
    member = next(name for name in archive.namelist() if name.endswith("/" + filename))
    with archive.open(member) as entry:
        yield from csv.DictReader(io.TextIOWrapper(entry, encoding="utf-8-sig"))


def build_catalog(archive):
    nutrients = {}
    for row in read_rows(archive, "food_nutrient.csv"):
        nutrient = row["nutrient_id"]
        if nutrient in NUTRIENTS and row["amount"]:
            amount = float(row["amount"])
            limit = 1000 if nutrient == "1008" else 100
            if math.isfinite(amount) and 0 <= amount <= limit:
                nutrients.setdefault(row["fdc_id"], {})[nutrient] = amount

    catalog = []
    for row in read_rows(archive, "food.csv"):
        values = nutrients.get(row["fdc_id"], {})
        if all(nutrient in values for nutrient in NUTRIENTS):
            catalog.append([int(row["fdc_id"]), row["description"][:160], *[values[n] for n in NUTRIENTS]])
    return catalog


if __name__ == "__main__":
    with ZipFile(sys.argv[1]) as archive:
        catalog = build_catalog(archive)
    output = Path(__file__).resolve().parent.parent / "server/src/data/usda-sr-legacy.json"
    output.write_text("[\n" + ",\n".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in catalog) + "\n]\n")
    print(f"{len(catalog)} foods with all four nutrition values")
