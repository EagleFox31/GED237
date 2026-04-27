import csv
from collections import Counter

csv_path = r"E:\tmp_ged_real_v2\classification_results.csv"
try:
    with open(csv_path, "r", encoding="utf-8") as fd:
        reader = csv.DictReader(fd)
        rows = list(reader)

        columns = reader.fieldnames
        print("Columns:", [c for c in columns])

        # Calculate stats
        total = len(rows)
        correct = sum(
            1
            for r in rows
            if r.get("expected_service") == r.get("predicted_service")
            and r.get("expected_service") != "Autre"
        )

        # Handle the new "Autre / Ambigu" or "À Revoir" logic
        # In our previous iterations, "Autre" means it was routed to Inbox because it failed to classify.
        ambiguous = sum(1 for r in rows if r.get("predicted_service") == "Autre")

        # If 'false_positive' or 'false_negative' exist
        fps = sum(1 for r in rows if r.get("false_positive") == "True")
        fns = sum(1 for r in rows if r.get("false_negative") == "True")

        print(f"\n--- RAPPORT DE CLASSIFICATION ({total} Documents) ---")
        print(f"✅ Classés Correctement : {correct}")
        print(f"⚠️ Ambiguïtés (Envoyés en Arbitrage / Autre) : {ambiguous}")
        print(f"❌ Faux Positifs : {fps}")
        print(f"❌ Faux Négatifs : {fns}")

        print("\n=> Répartition des Services Prédits :")
        for k, v in Counter(r.get("predicted_service") for r in rows).items():
            print(f"  {k}: {v}")

except Exception as e:
    print("Error:", e)
