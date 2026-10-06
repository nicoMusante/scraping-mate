# Mate Finder

Buscador de mates de calabaza tipo torpedo en tiendas argentinas.

La app consulta las tiendas al abrirse o al tocar **Actualizar**, toma sus datos estructurados públicos y muestra solamente los productos que indiquen disponibilidad, con imagen, precio y enlace a la publicación original.

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

## Publicar en Vercel desde GitHub

### Ramas y publicación de cambios

- `main`: versión de producción. Integrar cambios mediante pull requests.
- `desarrollo`: cambios en preparación y pruebas. Vercel genera previews cuando el repositorio está conectado.
- Para trabajos grandes, crear una rama `feature/nombre` desde `desarrollo` e integrarla allí mediante un pull request.

Trabajar en `desarrollo`, ejecutar `npm run dev` y comprobar la página y `/api/buscar`. Antes de publicar, ejecutar `npm run build` y revisar el preview de Vercel. Después abrir un pull request de `desarrollo` hacia `main` y fusionarlo cuando las comprobaciones sean correctas. Integrar con un merge commit para conservar la relación entre ambas ramas.

El workflow de GitHub Actions comprueba instalación y compilación en ambas ramas y sus pull requests. `lint` todavía tiene un error existente en `app/page.tsx`; no es una comprobación obligatoria hasta corregirlo.

En GitHub, configurar una regla para `main` que exija pull requests y la comprobación `build`, bloquee force pushes y eliminación, y se aplique también a administradores. En un repositorio personal puede exigirse PR sin exigir la aprobación de otra persona.

En Vercel, importar `nicoMusante/scraping-mate`, usar la raíz del repositorio y seleccionar `main` como Production Branch. Mantener previews para `desarrollo` y pull requests. No se requieren variables de entorno de la aplicación. Crear la rama por sí solo no activa despliegues: primero debe conectarse el proyecto a Vercel.

1. En [Vercel](https://vercel.com/new), elegí **Import Git Repository** y seleccioná `nicoMusante/scraping-mate`.
2. Vercel detectará Next.js automáticamente. No hace falta agregar variables de entorno.
3. Confirmá `main` como rama de producción y elegí **Deploy**.

Cada `git push` a `main` generará un deployment de producción. Las ramas y pull requests generan previews para probar cambios antes de publicarlos.

## Consideraciones

- La app consulta 17 tiendas en cada actualización, con hasta tres consultas simultáneas para no sobrecargarlas.
- Cada consulta tiene un límite de 12 segundos; la función de Vercel admite hasta 30 segundos.
- Las tiendas pueden cambiar su HTML, su disponibilidad o bloquear las consultas. Por eso pueden variar los resultados o la cantidad de fuentes que responde.
