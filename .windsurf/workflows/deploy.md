---
description: Déploie le projet OneKamer sur Render via le hook de déploiement sécurisé.
auto_execution_mode: 1
---

# Deploy Workflow

Déploie le projet OneKamer sur Render via le hook de déploiement sécurisé.

## Étapes

1. Demande confirmation à l’utilisateur :
   > Souhaitez-vous lancer le déploiement Render maintenant ? (oui/non)

2. Si la réponse est "oui", exécute :
   ```bash
   curl -X POST https://api.render.com/deploy/srv-XXXXXXXXXXXX?key=YYYYYYYYYYYY
   ```

   ⚠️ Remplace `srv-XXXXXXXXXXXX` et `YYYYYYYYYYYY` par ton vrai **Deploy Hook Render**.

3. Confirme le résultat :
   🚀 Déploiement Render déclenché avec succès (vérifier le dashboard Render).
