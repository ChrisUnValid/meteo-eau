# Météo de l'Eau 💧

**Le bulletin météo personnel de ton eau, 1975 → 2075.**

**➜ En ligne : [meteo-eau.vercel.app](https://meteo-eau.vercel.app)**

Entre ton code postal et ton année de naissance : tu obtiens le bulletin de ton eau —
combien de jours sans arroser l'été de tes 75 ans, où en sera la nappe, quel sera le débit
des rivières — présenté comme une météo, pas comme un rapport hydrologique.

- 🌍 **Globe vectoriel** du stress hydrique mondial (SVG, projection orthographique D3 — net à toutes les tailles), pays cliquables, rotation en pause d'un clic
- 🎙 **Phrases « présentateur »** : ~17 gabarits pilotés par seuils (vigilance × époque × événements), déterministes
- 🇫🇷 **Carte de France** par départements, infobulle, clic pour changer de territoire
- ⏳ **Timeline 1975 → 2075** ancrée sur *ta* vie (« l'année de tes 10 ans », « toi à 75 ans »)
- ⚡ **Duel de communes** : compare ton eau à celle d'une autre commune
- 🕳 **Coupe de la nappe phréatique** qui se vide sous tes yeux
- 📤 **Carte de partage** générée côté client, avec mention de source obligatoire

## Lancer

```bash
npm install
npm run dev
```

Build statique (`npm run build`) — le site est 100 % statique, déployable sur n'importe quel CDN.

## D'où viennent ces chiffres ?

**Toutes les valeurs affichées sont des projections simulées**, calibrées sur les ordres de
grandeur publiés par la science publique française :

- **Futur** : [Explore2](https://www.drias-eau.fr) (INRAE / Météo-France) — projections
  hydrologiques jusqu'à 2100 pour 187 secteurs hydrographiques. Ordres de grandeur retenus :
  débits d'été −20 % national en 2100, jusqu'à −40 % dans le Sud-Ouest, recharge des nappes
  en baisse au sud-est.
- **Passé** : tendances [Hub'Eau](https://hubeau.eaufrance.fr) (piézométrie, hydrométrie).
- **Monde** : indice simulé inspiré des catégories du
  [WRI Aqueduct](https://www.wri.org/aqueduct), calibré sur « 51 pays sur 164 en stress
  hydrique élevé en 2050 ».

La France métropolitaine est couverte par **10 archétypes hydro-climatiques**
(`src/lib/data/archetypes.js`) mappant les 96 départements — couverture totale vérifiée.
Deux communes voisines du même archétype affichent les mêmes chiffres : c'est assumé,
le nom de commune personnalise le titre, pas la donnée.

## Dette d'acte 2 (avant toute prétention à l'exactitude locale)

1. Remplacer les archétypes simulés par les vraies séries : Hub'Eau (passé) + les
   187 secteurs Explore2/DRIAS-Eau (futur).
2. Remplacer l'indice mondial simulé par les données WRI Aqueduct réelles par pays.
3. Compléter les noms de pays FR (~95 couverts, repli anglais).
4. Carte OG côté serveur (edge function) pour que le partage social affiche la carte
   sans action de l'utilisateur.

## Données embarquées

- `static/data/depts.geojson` — contours simplifiés des départements,
  [france-geojson](https://github.com/gregoiredavid/france-geojson) (Grégoire David, licence ouverte)
- `static/data/world.geojson` — contours des pays,
  [world.geo.json](https://github.com/johan/world.geo.json)
- Autocomplétion communes : [geo.api.gouv.fr](https://geo.api.gouv.fr) (repli hors ligne intégré)

## Stack

SvelteKit (Svelte 5, adapter-static) · D3 — zéro WebGL, zéro backend

---

*Projet né d'une session de brainstorming le 9 août 2026. L'eau devient le nouvel or —
la question n'est plus « où ? », c'est « chez toi, quand ? ».*
