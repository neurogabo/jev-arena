# Baltimore: diez equipos públicos

El evento se llama **2027 Baltimore Regional Championships**, por la temporada competitiva, y se jugó en **Baltimore, Estados Unidos, el 19 y 20 de septiembre de 2026**. Champions, Regulation M-C, Masters, 1,081 participantes. Joseph Ugarte ganó la final.

Fuentes: [organizador](https://www.trainerchampionships.com/event/baltimore-2027/), [resultados finales y enlaces a las listas](https://limitlessvgc.com/tournaments/441), [crónica y reglamento](https://victoryroad.pro/2027-baltimore/).

Se importan las diez primeras listas públicas de la clasificación final, enlazadas desde Limitless. El número refleja esa clasificación, no partidos adicionales por el tercer, quinto o noveno puesto. Cada fuente conserva su HTML público original y la transcripción en formato Showdown, **sin añadir puntos al texto de origen**.

| Clasificación | Jugador | Lista pública |
| --- | --- | --- |
| 1 | Joseph Ugarte | https://limitlessvgc.com/teams/6859 |
| 2 | Aditya Subramanian | https://limitlessvgc.com/teams/6860 |
| 3 | Brady Smith | https://limitlessvgc.com/teams/6861 |
| 4 | Blaik Thompson | https://limitlessvgc.com/teams/6862 |
| 5 | Lorenzo Arce | https://limitlessvgc.com/teams/6863 |
| 6 | Esa Ishaque | https://limitlessvgc.com/teams/6864 |
| 7 | Conner Pietrusinski | https://limitlessvgc.com/teams/6865 |
| 8 | Cole Basham | https://limitlessvgc.com/teams/6866 |
| 9 | Dorian Kang | https://limitlessvgc.com/teams/6867 |
| 10 | Billy Helm | https://limitlessvgc.com/teams/6868 |

## Qué es publicado y qué es reconstruido

Las fuentes incluyen las seis especies, objeto, habilidad inicial, naturaleza y cuatro movimientos. **No publican los puntos de entrenamiento de ninguno de los 60 Pokémon.** Los equipos jugables añaden una distribución existente de las fichas del wiki local; estas distribuciones no se atribuyen a los jugadores del torneo. El catálogo marca `provenance.reconstructedTraining: true` y documenta por Pokémon la ficha, el número de build, su hash, los puntos y el criterio de selección.

Se escoge el build por afinidad con la lista pública: tres puntos por movimiento compartido, tres por naturaleza coincidente, dos por objeto y uno por habilidad; empates por número de build. Cuando hay Megapiedra se consulta la ficha de esa Mega, pero el combate empieza con especie y habilidad base, tal como indica la lista pública. Se copia únicamente la asignación de entrenamiento. Todas las naturalezas y todos los movimientos, objetos y habilidades públicos se conservan, incluso cuando el build del wiki utiliza otros. La selección no pretende optimizar ni reproducir exactamente los cálculos privados de sus autores.

Se fija nivel 50 por reglamento. Se dejan apodos y aspecto brillante en sus valores predeterminados porque no se publican. Champions no usa IV configurables. Los valores `evs` son **stat points de Champions**, con máximo 32 por estadística y 66 totales, no EV tradicionales.

El sitio MetaVGC muestra distribuciones para algunos de estos equipos, pero no se encontró atribución verificable a los puntos originales del jugador. No se incorporaron como datos publicados.

## Reproducibilidad

Desde `decision-lab`, `node --import tsx scripts/import-tournament-teams.ts` regenera el catálogo **sin red**, usando las fuentes congeladas y las fichas locales. La opción explícita `--fetch` vuelve a obtener las listas y comprueba que las posiciones y los nombres continúan coincidiendo antes de importarlas. Cualquier incompatibilidad con el motor produce un error; no se sustituyen especies o movimientos.

`node --import tsx --test test/team-catalog-data.test.ts` verifica la procedencia, las asignaciones, las listas completas contra el validador fijado y el inicio nativo de los diez equipos: seis en la selección, cuatro participantes y dos activos.
