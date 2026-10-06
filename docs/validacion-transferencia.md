# Validación de mates individuales y transferencia — 6 de octubre de 2026

GET /api/buscar respondió HTTP 200 en 16,8 segundos con **236 mates individuales en stock**, de los cuales **231 tienen precio por transferencia identificado**. Se consultaron 15 de las 17 fuentes y se completaron 13 búsquedas. Los resultados son una comprobación local y pueden cambiar al actualizar.

## Comportamiento

- Se excluyen combos, kits, packs, boxes y publicaciones de mate con bombilla, termo, matera u otros accesorios. Una base o virola propia del mate no se considera un combo.
- El importe por transferencia aparece destacado con la etiqueta “Con transferencia”, junto al precio habitual como referencia. Se conservan los centavos publicados.
- Se asocian el método de pago y los precios a la tarjeta o ficha de cada producto. No se toman precios del carrito, de otros mates, de cuotas, sin impuestos ni descuentos de tarjeta.
- También se calculan porcentajes explícitos de transferencia sin condiciones. Las promociones con mínimos, cupones o restricciones no se aplican como precio disponible para cualquier compra.
- Se usan variantes disponibles; si sus precios varían, se indica “Desde” y el precio habitual corresponde a la misma variante que el precio por transferencia.
- Cuando no se verifica un descuento, se conserva el precio publicado.

## Resultados por tienda

| Tienda | Mates en stock | Precios por transferencia | Cobertura |
| --- | ---: | ---: | --- |
| Yerbas Calzada | 24 | 24 | Completa |
| Unidos por un Mate | 11 | 11 | Completa |
| Arcano Mates | 36 | 36 | Completa |
| Mónaco Mates | 13 | 13 | Parcial |
| Deal Matera | 0 | 0 | Fallida |
| Teko Mates | 29 | 29 | Completa |
| Matessn | 10 | 10 | Completa |
| Mate Style | 0 | 0 | Fallida |
| Estilo Austral | 8 | 8 | Completa |
| Soraka | 2 | 2 | Parcial |
| Mates Bayres | 9 | 9 | Completa |
| Mate Sur | 8 | 8 | Completa |
| Yerba Sip | 19 | 19 | Completa |
| Cala Mates | 36 | 36 | Completa |
| Pa' Mate | 6 | 6 | Completa |
| La Pampa Mates | 5 | 0 | Completa |
| Matermos | 20 | 20 | Completa |

## Ejemplos verificados

| Publicación | Precio habitual | Por transferencia |
| --- | ---: | ---: |
| [Torpedo joyero avejentado](https://www.matessn.com/productos/torpedo-joyero-avejentado-15ktk/) (Matessn) | ARS 63000.00 | ARS 50400.00 |
| [TORPEDO PRIME](https://www.matesbayres.com.ar/productos/torpedo-prime/) (Mates Bayres) | ARS 179890.00 | ARS 152906.50 |
| [Mate Torpedo de Cuero Crudo con Alpaca y Base](https://estiloaustral.com/producto/mate-torpedo-de-cuero-crudo-con-alpaca-y-base/) (Estilo Austral) | ARS 88330.00 | ARS 79497.00 |

## Comprobaciones y límites

- 22 pruebas aprobadas, incluidos ejemplos de precios publicados por seis tiendas y regresiones de combos, variantes agotadas, promociones condicionadas y fichas con descuento sólo en el detalle.
- npm run build aprobado.
- El endpoint devolvió enlaces originales válidos, sin duplicados; todos los precios por transferencia son positivos e inferiores al precio habitual asociado.
- Deal Matera sigue devolviendo HTTP 410 y Mate Style no permite la conexión desde este entorno. Mónaco y Soraka repiten páginas, por lo que siguen marcadas como búsquedas parciales.
