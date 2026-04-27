import csv
from collections import Counter

csv_path = r"E:\tmp_ged_real_v2\classification_results.csv"
try:
    with open(csv_path, "r", encoding="utf-8") as fd:
        reader = csv.DictReader(fd)
        rows = list(reader)

        print("Columns:", reader.fieldnames)

        if not rows:
            print("CSV is empty")
            exit(0)

        status_col = next((c for c in reader.fieldnames if c.lower() == "status"), None)
        pred_col = next(
            (c for c in reader.fieldnames if c.lower() == "predicted_service"), None
        )

        if status_col:
            print("\nStatus:")
            for k, v in Counter(r.get(status_col, "MISSING") for r in rows).items():
                print(f"  {k}: {v}")

        if pred_col:
            print("\nPredicted Service:")
            for k, v in Counter(r.get(pred_col, "MISSING") for r in rows).items():
                print(f"  {k}: {v}")
except Exception as e:
    print("Error:", e)
