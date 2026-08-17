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

**Futur : les vraies projections locales Explore2.** Pour les débits d'été,
`scripts/build-explore2.mjs` ingère l'indicateur **delta-QMNA_summer** des
[narratifs Explore2](https://doi.org/10.57745/E7LHGT) (INRAE / Météo-France, licence
Etalab) : le changement relatif du débit mensuel minimal d'été, aux horizons 2035 / 2055 /
2085, référence 1976-2005. Conformément à la consigne des auteurs (« l'approche
multi-modèle doit être privilégiée »), aucune chaîne n'est isolée : on retient la
**médiane des 36 chaînes** (4 narratifs climatiques RCP 8.5 × 9 modèles hydrologiques),
après filtrage des chaînes jugées aberrantes
([doi:10.57745/YZNENQ](https://doi.org/10.57745/YZNENQ)), et on affiche l'**enveloppe
q10-q90** sous la valeur. Les ~4000 points de simulation sont rattachés à leur département
par point-dans-polygone. Couverture : 93 départements.

Pour les **nappes**, `scripts/build-recharge.mjs` ingère l'anomalie relative de **recharge
potentielle par masse d'eau souterraine** (modèle RECHARGE,
[doi:10.57745/F9QE5D](https://doi.org/10.57745/F9QE5D), RCP 8.5) : médiane des 17 modèles
climatiques et enveloppe Q5-Q95, aux mêmes horizons. Les masses d'eau sont rattachées aux
départements via les piézomètres Hub'Eau, qui déclarent leur masse d'eau — les aquifères
projetés sont donc exactement ceux qu'on mesure par ailleurs. Couverture : 93 départements.

> **La jauge change de grandeur entre passé et futur, et c'est assumé.** Le passé montre un
> *niveau* mesuré (percentile piézométrique) ; le futur montre une *recharge potentielle*
> (flux, en % vs 1976-2005). Deux quantités différentes — d'où l'étiquette qui passe de
> « Nappe » à « Recharge été ». Les projections de niveaux piézométriques (AquiFR) ne
> couvrent que quelques régions, pas la France entière.
>
> **Pourquoi la recharge d'été et pas l'annuelle ?** Parce que ce bulletin est un bulletin
> d'été, comme tous ses autres indicateurs. La distinction est majeure : en 2085, la
> recharge **annuelle** médiane est de +5 % alors que la recharge **d'été** est à −45 %.
> L'hiver plus humide masque l'effondrement estival — c'est exactement le message
> d'Explore2, et le bulletin le dit à voix haute plutôt que de le moyenner.

Les jours de restriction futurs suivent encore les ordres de grandeur des
**10 archétypes hydro-climatiques** (`src/lib/data/archetypes.js`).

Dans tous les cas la courbe future est **raccordée à la moyenne des 5 dernières années
observées** du département : pas de saut au passage observé → projeté.

> **Lire les chiffres correctement** : une année observée est *une* année (le débit d'été
> peut varier de ±50 % d'une année sur l'autre), tandis qu'une projection est une
> **moyenne climatique sur 30 ans**. Une année observée très sèche peut donc être « pire »
> que la moyenne projetée de 2055 sans que cela contredise la projection : c'est
> l'enveloppe q10-q90 qui dit à quel point ces années-là deviennent la norme.
> Nuance d'indicateur : l'observé mesure le débit *moyen* de juin-août, Explore2 le débit
> mensuel *minimal* d'été — deux mesures d'étiage proches mais pas identiques.

**Le monde : WRI Aqueduct 4.0.** `scripts/build-aqueduct.mjs` extrait les
[classements pays](https://www.wri.org/data/aqueduct-40-country-rankings) (CC BY 4.0,
Kuzma et al. 2023) : indicateur `bws` — la part de la ressource disponible qui est
prélevée — pondéré par la demande totale, pour 164 pays. La référence Aqueduct est une
moyenne **1979-2019**, donc constante sur tout le passé du bulletin (aucune série annuelle
n'existe) ; le futur suit le scénario *business as usual* aux horizons 2030 / 2050 / 2080,
et la fiche pays montre aussi la fourchette optimiste/pessimiste de 2050. Les 20 pays sans
donnée (Antarctique, Groenland, micro-États) sont **grisés**, jamais estimés.

> Le compteur retombe exactement sur les chiffres publiés par le WRI : **47 pays** en
> stress élevé en référence, **51 en 2050**. Il est calculé sur les 164 pays d'Aqueduct,
> pas sur les polygones du fond de carte, dont une vingtaine manquent.
>
> **Le stress hydrique n'est pas l'aridité.** L'indicateur rapporte les prélèvements
> humains à la ressource : le Tchad, en plein Sahel, est classé en stress *faible* parce
> qu'on y prélève peu, tandis que la Belgique ou l'Inde sont en stress élevé. La version
> simulée de ce projet se trompait précisément là-dessus.

**Toujours simulé** : les jours de restriction hors 2012-aujourd'hui (avant 2012 et en
projection), et tout département sans données réelles suffisantes (repli archétype).

## Dette restante

1. Compléter les noms de pays FR (~95 couverts, repli sur le nom anglais).
2. Carte OG côté serveur (edge function) pour le partage social sans action utilisateur.
3. Jours de restriction projetés : encore par archétype (les arrêtés ne se projettent pas,
   il faudrait un modèle reliant étiage et décision préfectorale).

## Régénérer les données

```bash
node scripts/build-data.mjs                              # Hub'Eau (débits, nappes)
python3 scripts/build-restrictions.py <historique.zip>   # arrêtés VigiEau
node scripts/build-explore2.mjs <dir>                    # projections de débits
node scripts/build-recharge.mjs <dir-dbf>                # projections de recharge
node scripts/build-aqueduct.mjs <rankings.xlsx>          # stress hydrique mondial
```

Le dernier attend dans `<dir>` : `qmna/*.parquet` (les 108 fichiers `delta-QMNA_summer` de
[E7LHGT](https://doi.org/10.57745/E7LHGT)), `stations_explore2.tab`
([UTKWR5](https://doi.org/10.57745/UTKWR5)) et `outliers.tab`
([YZNENQ](https://doi.org/10.57745/YZNENQ)). Lecture parquet : `npm i --no-save hyparquet`.
Le dernier attend les 6 `.dbf` de [F9QE5D](https://doi.org/10.57745/F9QE5D) nommés par leur
identifiant Recherche Data Gouv (JJA et DJF, RCP 8.5, 3 horizons) — le lecteur dBASE est
intégré au script, sans dépendance. Aqueduct : le `.xlsx` de
`files.wri.org/aqueduct/aqueduct-4-0-country-rankings.zip`, lu sans dépendance non plus
(un xlsx est un zip de XML).

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
