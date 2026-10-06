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

- La app consulta 17 tiendas en cada actualización, con hasta tres consultas simultáneas para no sobrecargarlas.
- Cada consulta tiene un límite de 12 segundos; la función de Vercel admite hasta 30 segundos.
- Las tiendas pueden cambiar su HTML, su disponibilidad o bloquear las consultas. Por eso pueden variar los resultados o la cantidad de fuentes que responde.
