<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# FirmaPDF — Ejecutable y despliegue

Proyecto para firmar PDFs en el navegador. Instrucciones para ejecutar localmente y desplegar en Vercel.

## Ejecutar localmente

Requisitos: Node.js (v16+ recomendable).

1. Instalar dependencias:
   `npm install`
2. Ejecutar en modo desarrollo:
   `npm run dev`

## Build (producción)

1. Generar build:
   `npm run build`
2. Carpeta de salida: `dist`

## Desplegar en Vercel (recomendado)

1. Conecta este repositorio en https://vercel.com (GitHub/GitLab/Bitbucket).
2. Configuración de Build:
   - Command: `npm run build`
   - Output Directory: `dist`
3. Variables de entorno (opcional): añade `GEMINI_API_KEY` si usas integración con Gemini.
4. Despliegue automático: cada push a la rama principal activará un despliegue.

## Mejora de vista previa en LinkedIn

Para que LinkedIn muestre una tarjeta atractiva, añade meta tags Open Graph en `index.html` (en `dist` o plantilla):

```html
<meta property="og:title" content="FirmaPDF - Firma documentos en tu navegador" />
<meta property="og:description" content="Sencilla herramienta offline para colocar firmas en PDFs desde tu navegador." />
<meta property="og:image" content="https://ruta-a-tu-imagen/preview.png" />
<meta property="og:url" content="https://tu-dominio.vercel.app" />
```

## Notas

- El procesamiento se realiza localmente en el navegador; los archivos no se suben por defecto.
- Si necesitas que haga el deploy automático (crear branch y abrir PR), dime y lo hago.

---

_Actualizado para despliegue en Vercel_
