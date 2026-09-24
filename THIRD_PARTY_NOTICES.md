# Third-party notices

The root MIT license covers this project's original code and original documentation. It does not relicense material from other sources or grant rights to names, logos, artwork, sounds or trademarks.

| Material | Source / terms |
| --- | --- |
| Pokémon Showdown engine and derived mechanics/data | [Upstream](https://github.com/smogon/pokemon-showdown), pinned in `showdown.lock.json`; retain the bundled [MIT notice](docs/wiki/evidence/showdown-LICENSE.txt) |
| Pokémon Showdown client | [Pinned upstream license information](https://github.com/smogon/pokemon-showdown-client/blob/f2faebd6892b314d785a0038f77309afed36970c/README.md#license): the client as a whole is **AGPLv3**, while the standalone battle replay/animation files carry MIT notices. Retain the downloaded `LICENSE` and per-file notices; this project's MIT license does not replace them |
| Plus Jakarta Sans, embedded as WOFF2 in arena CSS | Copyright 2020 The Plus Jakarta Sans Project Authors; [SIL Open Font License 1.1](src/public/brand/OFL.txt); [provenance](src/public/brand/README.md) |
| npm dependencies | Exact versions are in `package-lock.json`; retain each package's notices |
| Tournament teams, competitive sources and wiki evidence | Source links and dates remain in `teams/`, [wiki sources](docs/wiki/sources.md) and [competitive sources](docs/wiki/competitive-sources.md); citation alone does not grant permission to republish third-party material |

Pokémon names, characters, sprites and sounds belong to their respective rights holders. The app can load graphical/audio assets from Showdown services; those assets are not covered by this repository's MIT license. The NeuroGabo identity is not licensed as a trademark by the code license. Forks can replace the presentation while retaining required underlying attribution.

If you redistribute or publicly host a modified Showdown client, follow its AGPLv3 terms, including the applicable corresponding-source offer. The pinned source archive is recorded in `showdown.lock.json`; local build steps and integrations are in this repository. Preserve and make available the exact source and modifications for the client you distribute.
