# Instrucciones para subir a GitHub Pages

## Que subir

Sube a tu repositorio publico solo los archivos del ZIP `github-pages-arriendo.zip`:

- `index.html`
- `styles.css`
- `app.js`
- `README.md`
- `INSTRUCCIONES_GITHUB.md`

No subas al repositorio publico:

- Contrato original.
- Comprobantes originales.
- `Registro Pagos.xlsx`.
- Carpeta `Comprobantes Pagos`.
- Archivos con cedulas, firmas, cuentas bancarias o datos notariales.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub.
2. Sube los archivos del ZIP `github-pages-arriendo.zip`.
3. Entra a `Settings > Pages`.
4. En `Build and deployment`, selecciona la rama principal y la carpeta raiz.
5. Guarda los cambios.
6. Abre la URL que GitHub Pages genere.

## Conectar con Google Sheets

Despues de publicar el Apps Script:

1. Copia la URL de la aplicacion web de Apps Script.
2. Abre `app.js`.
3. Pega la URL en:

```js
appScriptUrl: "PEGA_AQUI_LA_URL_DE_APPS_SCRIPT",
```

4. Vuelve a subir `app.js` a GitHub.

## Importante sobre comprobantes

El ZIP de GitHub no incluye comprobantes. Los botones `Pagado` y `Ver` funcionaran con los enlaces que se guarden en Google Sheets al registrar pagos o asociar comprobantes por mes.
