import sys
import os
import asyncio

# Ajuster le path pour pouvoir importer `app`
print("Current dir:", os.getcwd())
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.rules.engine import RuleEngine, RuleDefinition
from app.core.rules.registry import hydrate_condition, hydrate_action


async def main():
    print("--- Démarrage du Test Réel IFTTT (Action Serveur Externe) ---")

    # 1. Création des dossiers "Réels" sur le disque
    source_dir = "e:/tmp_ged_local_storage"
    remote_server = "e:/tmp_remote_server_192_168_1_50"

    os.makedirs(source_dir, exist_ok=True)
    os.makedirs(remote_server, exist_ok=True)

    # Nettoyage précédent si besoin
    source_file = os.path.join(source_dir, "facture_0123.pdf")
    dest_file = os.path.join(remote_server, "facture_0123.pdf")
    if os.path.exists(dest_file):
        os.remove(dest_file)

    with open(source_file, "w", encoding="utf-8") as f:
        f.write(
            "Ceci est une VRAIE facture physique sur le disque de la GED. Date: 12 avril."
        )

    print(f"\n[+] Etape 1: Créé le fichier source réel dans la GED: {source_file}")

    # Configuration manuelle du système de règles (comme si elle venait de l'UI)
    rule_data = {
        "id": "my_test_rule",
        "name": "Export Auto des Factures vers le Serveur Externe",
        "conditions": [
            hydrate_condition({"type": "ocr_contains", "keyword": "facture"})
        ],
        "actions": [
            hydrate_action(
                {"type": "export_to_server", "destination_path": remote_server}
            )
        ],
    }

    rule_def = RuleDefinition(**rule_data)
    engine = RuleEngine()
    engine.load_rules([rule_def])

    print(
        f"[+] Etape 2: Règle d'export chargée dans le moteur IFTTT : '{rule_data['name']}'"
    )

    # Simulation du contexte du document (sans DB lourde)
    context = {
        "document_id": "test_facture_001",
        "ocr_content": "La facture est bien valide",  # Déclenche ocr_contains 'facture'
        "file_path": source_file,  # Permet au code fallback de l'Action de trouver le fichier
    }

    print("[+] Etape 3: Moteur en cours d'évaluation pour le document...")
    reports = await engine.process_document(context, None)  # db=None

    print("\n--- Rapport IFTTT ---")
    for r in reports:
        print(f"Règle évaluée : {r['rule_name']} (Conditions Remplies: {r['matched']})")
        if r["matched"]:
            for act in r["actions_results"]:
                print(f"  -> Action exécutée : {act}")

    # Vérification physique réelle
    print("\n--- Vérification Physique sur le Disque ---")
    if os.path.exists(dest_file):
        print(
            f"[SUCCÈS] Le fichier est bien physiquement apparu sur le 'serveur distant': {dest_file}"
        )
        with open(dest_file, "r", encoding="utf-8") as f:
            print(f"Contenu du fichier cloné  : '{f.read()}'")
    else:
        print("\n[ÉCHEC] Fichier non trouvé dans la destination !")


if __name__ == "__main__":
    asyncio.run(main())
