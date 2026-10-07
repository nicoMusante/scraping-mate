# Mate Finder

Buscador de mates tipo torpedo individuales de todos los materiales en tiendas argentinas.

La app consulta las tiendas al abrirse o al tocar **Actualizar**. Recorre el buscador y las categorías de torpedos enlazadas por cada tienda, sigue su paginación y consulta las fichas cuando el listado no informa datos del producto o su precio por transferencia. Muestra solamente mates torpedo individuales que declaran stock, con imagen, precio y enlace original; excluye combos, kits y conjuntos de mate con bombilla, termo u otros accesorios.

Cuando la tienda informa un descuento por transferencia, ese importe se destaca con la etiqueta **Con transferencia** y el precio habitual queda como referencia. Se leen los importes de cada producto o se calcula un porcentaje explícito sin restricciones. Los precios de cuotas, descuentos de tarjeta, promociones con cupones o mínimos y precios sin impuestos no se confunden con el precio por transferencia. Para variantes con distintos precios se muestra **Desde**, usando una variante disponible. Si no se puede comprobar un descuento, se conserva el precio publicado.

## Filtros y marcas personales

Además de elegir la tienda, se puede definir un precio mínimo o máximo y ordenar por precio. Cada mate tiene botones de **me gusta** y **no me gusta**. Por defecto se muestran los mates marcados como me gusta y los que todavía no fueron marcados; el filtro permite ver cada estado por separado.

Las marcas se guardan en el almacenamiento local del navegador. No requieren base de datos, pero pertenecen a ese navegador y dispositivo: no se comparten entre equipos y se eliminan al borrar los datos del sitio. Una base de datos sería necesaria sólo para sincronizarlas entre dispositivos o personas.

El detalle de cobertura muestra los resultados por tienda y distingue búsquedas completas, parciales y fallidas. “Completa” significa que se terminó de recorrer la búsqueda y las categorías detectadas, no que se haya comprobado todo el inventario privado de la tienda. Los productos agotados o sin disponibilidad verificable se excluyen.

## Tecnologías

- Next.js 16 + React + TypeScript
- Tailwind CSS
- Route Handler de Next.js en `/api/buscar` para consultar las tiendas desde el servidor

No requiere base de datos, claves ni variables de entorno.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

Para verificar el scraper y compilar:

```bash
npm test
npm run build
```

## Publicar en Vercel desde GitHub

1. Creá un repositorio vacío en GitHub.
2. Desde esta carpeta, subí el proyecto:

   ```bash
   git init
   git add .
   git commit -m "Initial Mate Finder"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/mate-finder.git
   git push -u origin main
   ```

3. En [Vercel](https://vercel.com/new), elegí **Import Git Repository** y seleccioná el repositorio.
4. Vercel detectará Next.js automáticamente. No hace falta agregar variables de entorno.
5. Elegí **Deploy**.

Cada `git push` a `main` generará un deployment de producción. Las ramas y pull requests generan previews para probar cambios antes de publicarlos.

## Consideraciones

- Las 17 fuentes están configuradas en `lib/mate-scraper.ts`. Se consultan hasta tres tiendas simultáneamente y las páginas de cada tienda se recorren de a una.
- Cada petición tiene un límite de 12 segundos. La búsqueda tiene un presupuesto global de cuatro minutos y la función de Vercel declara `maxDuration = 300`. Si el plan de hosting impone un límite menor, debe ajustarse el presupuesto o distribuirse la búsqueda entre solicitudes.
- No hay recorte de 20 resultados por tienda. El límite de seguridad de 100 páginas por fuente y los límites de tiempo siempre se informan como cobertura incompleta.
- Las tiendas pueden cambiar su HTML, su disponibilidad o bloquear las consultas. Los errores se atribuyen a la tienda correspondiente y se conservan los resultados obtenidos antes del fallo.
# Mate Finder

## Cuentas y marcas guardadas

La aplicación usa Supabase Auth para que cada persona pueda crear una cuenta y sincronizar sus marcas de “me gusta” y “no me gusta”. Para desarrollar localmente, copiá `.env.example` a `.env.local` y completá ambas variables con los valores del proyecto de Supabase. Las variables públicas no contienen acceso administrativo: la tabla se protege con políticas RLS por usuario.
