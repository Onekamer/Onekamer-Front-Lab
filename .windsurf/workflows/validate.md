---
description: Prépare un commit Git local sans le pousser vers GitHub.
auto_execution_mode: 1
---

# Validate Workflow

Prépare un commit Git local (sans push).  
Toujours demander confirmation avant l'exécution.

## Étapes

1. Vérifie les fichiers modifiés :
   ```bash
   git status
   ```

2. Ajoute les changements :
   ```bash
   git add .
   ```

3. Demande un message de commit à l’utilisateur :
   > Entrez le message du commit :

4. Crée le commit local :
   ```bash
   git commit -m "Validation OneKamer : [MESSAGE_DE_COMMIT]"
   ```

5. Informe l'utilisateur :
   ✅ Commit local créé avec succès (non poussé).
