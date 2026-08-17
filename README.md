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

**Passé (1975 → aujourd'hui) : des mesures observées.** Le pipeline
`scripts/build-data.mjs` interroge les API publiques [Hub'Eau](https://hubeau.eaufrance.fr)
et produit `static/data/real.json`, embarqué dans le site :

- **Débits d'été** : stations hydrométriques aux plus longues chroniques de chaque
  département (héritage Banque Hydro), moyenne des débits mensuels juin-août par année,
  exprimée en % d'écart à la référence 1975-2005 de la station, médiane entre stations.
- **Nappes** : piézomètres aux chroniques les plus longues, moyenne annuelle du niveau
  convertie en percentile dans l'historique de la station (indice type IPS), exprimée en
  écart au médian (±50), moyenne entre stations.

- **Jours sans arroser (2012 →)** : historique quotidien réel des arrêtés de restriction
  (Propluvia puis VigiEau, jeu « Donnée Sécheresse - VigiEau » sur data.gouv.fr, ~11 Go
  traités en streaming par `scripts/build-restrictions.py`). Par département et par été :
  moyenne par commune du nombre de jours de juin-août avec au moins un milieu (eau potable,
  souterraine, superficielle) au niveau alerte, alerte renforcée ou crise. Avant 2012 et
  pour le futur, la valeur reste modelée.

Un point turquoise ● dans le bulletin marque chaque valeur mesurée. Régénérer :
`node scripts/build-data.mjs` puis `python3 scripts/build-restrictions.py <historique.zip>`.

**Futur : une projection raccordée à l'observé.** Les trajectoires suivent les ordres de
grandeur publiés par [Explore2](https://www.drias-eau.fr) (INRAE / Météo-France — débits
d'été −20 % national en 2100, −40 % Sud-Ouest, recharge en baisse au sud-est), portées par
**10 archétypes hydro-climatiques** (`src/lib/data/archetypes.js`), et **ancrées sur la
moyenne des 5 dernières années observées** du département : pas de saut au passage
observé → projeté.

**Toujours simulé** : les jours de restriction hors 2012-aujourd'hui (avant 2012 et en
projection), l'indice mondial (inspiré des catégories
[WRI Aqueduct](https://www.wri.org/aqueduct), calibré sur « 51 pays sur 164 en stress
élevé en 2050 »), et tout département sans données réelles suffisantes (repli archétype).

## Dette d'acte 2 restante

1. Ingérer les vraies trajectoires locales Explore2 par secteur : indicateurs de
   changement des 540 chaînes de modélisation
   ([doi:10.57745/8CZUWN](https://doi.org/10.57745/8CZUWN), NetCDF, licence Etalab) —
   remplacera l'ancrage par archétype.
2. Remplacer l'indice mondial simulé par les données WRI Aqueduct réelles par pays.
3. Compléter les noms de pays FR (~95 couverts, repli anglais).
4. Carte OG côté serveur (edge function) pour le partage social sans action utilisateur.

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
