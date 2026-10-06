# Mate Finder — instrucciones para agentes

## Propósito

Esta aplicación busca **mates tipo torpedo de todos los materiales**, incluidos combos con mate, en tiendas argentinas. Al abrir la página o pulsar “Actualizar”, consulta las tiendas configuradas y muestra productos disponibles con imagen, precio, tienda y enlace original.

## Estado actual

- El proyecto vive directamente en la raíz de este repositorio.
- El objetivo de despliegue es **Vercel mediante GitHub**, no ChatGPT Sites.
- No hay base de datos, autenticación, claves API ni variables de entorno requeridas.
- La aplicación compila con npm run build.
- El sitio anteriormente se publicó con ChatGPT Sites, pero la configuración de hosting de ese servicio fue removida. No reintroducir .openai/hosting.json ni flujos de Cloudflare/Sites para desplegar.

## Stack y archivos importantes

- Next.js 16, React, TypeScript y Tailwind CSS.
- Página principal: app/page.tsx.
- Endpoint de búsqueda: app/api/buscar/route.ts.
- Fuentes, extractor y recorrido de catálogos: lib/mate-scraper.ts.
- Pruebas del scraper: tests/mate-scraper.test.mjs.
- Estilos globales: app/globals.css.
- Metadatos: app/layout.tsx.
- Configuración de Next: next.config.ts.
- Instrucciones para la persona usuaria: README.md.

La ruta GET /api/buscar corre en Node.js como Vercel Function. Declara:

- runtime = "nodejs"
- dynamic = "force-dynamic"
- maxDuration = 300 (la búsqueda tiene un presupuesto global de 240 segundos)

No transformar esta ruta en una consulta ejecutada exclusivamente en el navegador: las tiendas externas pueden bloquear CORS.

## Cómo funciona el scraper

1. La lista de tiendas está en el array sources de lib/mate-scraper.ts.
2. Se consultan como máximo tres tiendas a la vez y las páginas de cada una secuencialmente.
3. Cada petición vence a los 12 segundos. Los límites de tiempo o páginas se informan como cobertura incompleta.
4. Se recorren los buscadores y las categorías de torpedos detectadas, incluida la paginación con fragmentos de Tiendanube. En WooCommerce se consultan las fichas de producto.
5. Se leen los scripts públicos application/ld+json y se aceptan objetos Product cuyo nombre identifique un **torpedo**, sin exigir calabaza. No incluir accesorios ni otros modelos que sólo mencionan torpedos en la descripción.
6. Sólo se muestran ofertas con disponibilidad InStock. Se examinan todas las ofertas/variantes; se descartan OutOfStock, agotadas o sin disponibilidad declarada. Se admiten precios numéricos y priceSpecification.
7. Los resultados se deduplican por dominio y ruta de producto, conservando un enlace original, y se ordenan con los que tienen precio primero. No recortar resultados a 20 por tienda.
8. El endpoint devuelve cobertura y problemas por tienda. Una petición exitosa no implica que se haya podido terminar la revisión del catálogo.

Las tiendas cambian HTML, datos estructurados y medidas anti-bots con frecuencia. Si una fuente deja de devolver resultados:

- Verificar primero la URL de búsqueda/categoría de esa tienda.
- Revisar si continúa exponiendo JSON-LD de tipo Product con offers.availability.
- Adaptar el extractor de forma acotada para esa tienda; no inventar stock, precio ni imágenes.
- Mantener los límites de concurrencia y timeout para no sobrecargar los comercios.

## Desarrollo y comprobaciones

    npm install
    npm run dev
    npm run build

Antes de entregar cambios, ejecutar al menos:

    npm test
    npm run build

Si se modifica el endpoint, comprobar localmente que GET /api/buscar responde, que no devuelve productos sin stock y que conserva el enlace original de cada producto.

## GitHub y Vercel

La carpeta raíz es la que debe subirse al repositorio GitHub. Vercel detecta Next.js sin configuración adicional:

1. Subir la raíz del repositorio a GitHub.
2. Importar el repositorio desde Vercel.
3. No agregar variables de entorno.
4. Los pushes a main despliegan producción; otras ramas o pull requests crean previews.

Mantener ignorados node_modules/, .next/, .vercel/, dist/, .wrangler/, .sites-runtime/ y .env*.

.mate-torpedo-git-history/ es un archivo histórico local del antiguo repositorio anidado. Está ignorado y no debe subirse, modificarse ni usarse para desplegar.

## Criterios de producto y UX

- La interfaz debe estar en español rioplatense, ser legible en móvil y escritorio y conservar el enfoque principal: comparar mates.
- Mostrar claramente que precios y stock pertenecen a cada tienda y pueden cambiar.
- No presentar resultados estáticos como si fueran actuales.
- No agregar pagos, carrito, cuentas de usuario, almacenamiento o automatizaciones sin una solicitud explícita.
