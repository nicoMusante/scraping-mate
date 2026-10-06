# Validación de Mate Finder — 6 de octubre de 2026

Esta comprobación es histórica e incluye combos. La validación del filtro de mates individuales y precios por transferencia está en [validacion-transferencia.md](validacion-transferencia.md).

La consulta real al endpoint local devolvió HTTP 200 en 16,3 segundos: **327 publicaciones de mates torpedo en stock**, con 15 tiendas accesibles de 17 y 13 búsquedas completas. Los datos pueden variar en futuras actualizaciones.

## Problemas encontrados y corregidos

- Las búsquedas de Tiendanube usaban parámetros de WooCommerce y consultaban la portada en varias tiendas.
- Sólo se leía una página y se recortaban los resultados a 20 productos por tienda.
- Se exigía que la descripción abreviada incluyera calabaza. A pedido de la persona usuaria se incluyen ahora todos los materiales.
- Las fichas de WooCommerce no se consultaban, aunque son las que publican los datos estructurados del producto.
- Sólo se examinaba la primera oferta y se perdían precios numéricos o publicados en priceSpecification.
- La interfaz no distinguía una tienda accesible de una búsqueda completa.

En el HTML consultado, la lógica anterior habría mostrado 66 productos. La diferencia con los 327 actuales combina la ampliación a todos los materiales y la recuperación de publicaciones omitidas.

## Resultados por fuente

| Tienda | Torpedos en stock | Publicaciones revisadas | Páginas de listado | Cobertura |
| --- | ---: | ---: | ---: | --- |
| [Yerbas Calzada](https://yerbascalzada.com/search/?q=torpedo) | 26 | 40 | 8 | Completa |
| [Unidos por un Mate](https://www.unidosporunmate.com/search/?q=torpedo) | 13 | 49 | 6 | Completa |
| [Arcano Mates](https://arcanomates.com/search/?q=torpedo) | 67 | 73 | 12 | Completa |
| [Mónaco Mates](https://monacomates.com/search/?q=torpedo) | 18 | 24 | 5 | Parcial |
| [Deal Matera](https://dealmatera2.mitiendanube.com/search/?q=torpedo) | 0 | 0 | 0 | Fallida |
| [Teko Mates](https://tekomates.com.ar/search/?q=torpedo) | 29 | 47 | 1 | Completa |
| [Matessn](https://www.matessn.com/search/?q=torpedo) | 31 | 39 | 1 | Completa |
| [Mate Style](https://matesstyle.emprentienda.com.ar/?q=torpedo) | 0 | 0 | 0 | Fallida |
| [Estilo Austral](https://estiloaustral.com/?s=torpedo&post_type=product) | 8 | 8 | 1 | Completa |
| [Soraka](https://www.soraka.com.ar/search/?q=torpedo) | 24 | 49 | 10 | Parcial |
| [Mates Bayres](https://www.matesbayres.com.ar/search/?q=torpedo) | 9 | 20 | 2 | Completa |
| [Mate Sur](https://matesur.net/search/?q=torpedo) | 13 | 29 | 4 | Completa |
| [Yerba Sip](https://www.yerbasip.com/search/?q=torpedo) | 20 | 28 | 6 | Completa |
| [Cala Mates](https://calamates.com.ar/search/?q=torpedo) | 37 | 71 | 3 | Completa |
| [Pa' Mate](https://pamate.com.ar/search/?q=torpedo) | 6 | 11 | 2 | Completa |
| [La Pampa Mates](https://lapampamates.com/?s=torpedo&post_type=product) | 6 | 8 | 1 | Completa |
| [Matermos](https://www.matermos.com/search/?q=torpedo) | 20 | 65 | 12 | Completa |

“Completa” indica que se recorrieron hasta el final las páginas del buscador y las categorías detectadas. No demuestra que el inventario de la tienda incluya todas sus publicaciones en esas páginas. “Publicaciones revisadas” también incluye otros modelos devueltos por los buscadores internos; sólo los identificados como torpedo y con disponibilidad InStock se muestran. Los combos con mate torpedo se incluyen.

## Limitaciones verificadas

- Deal Matera: HTTP 410; no se pudo consultar su catálogo.
- Mate Style: la conexión falla desde este entorno; no se pudo consultar su catálogo.
- Mónaco Mates y Soraka: su paginación repite publicaciones, por lo que no se pudo verificar el final de la búsqueda. Sus resultados recuperados se conservan y su cobertura se marca como parcial.
- Los productos agotados, en preventa o sin stock declarado no se muestran.
- Los límites de tiempo o páginas se reportan como cobertura incompleta, sin truncar resultados silenciosamente.

## Comprobaciones

- 12 pruebas del scraper: productos reales sin calabaza en el resumen, torpedos de madera, variantes disponibles, precios, paginación con fragmentos, más de 20 resultados, fichas de WooCommerce, agotados, errores parciales y concurrencia máxima de tres tiendas.
- npm run build completado.
- GET /api/buscar real: HTTP 200, 327 resultados, 17 informes por tienda, enlaces originales válidos y sin URLs duplicadas.

No se puede afirmar que se recupera el 100% de las 17 tiendas mientras las cuatro fuentes indicadas mantengan esas limitaciones. Los cambios están preparados en el repositorio; esta validación se realizó localmente, sin publicar un despliegue.
