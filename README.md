# Control de Arriendo Matazarnos

Sitio estatico para publicar en GitHub Pages y controlar pagos del contrato de arriendo del terreno Matazarnos.

## Principio de privacidad

La carpeta original de Google Drive debe permanecer privada. No publiques la carpeta donde estan el contrato, comprobantes, Excel o Google Sheets con datos reales.

El sitio publico solo debe mostrar informacion resumida:

- Estado de meses pagados, vencidos, de vigencia y transcurridos.
- Historial de pagos con enlaces a comprobantes, siempre que el archivo en Drive tenga permisos adecuados.
- PDF generado del historial visible, sin adjuntar contrato ni imagenes de comprobantes.

## Planificacion de carpetas

Usa esta separacion:

- `ARRIENDO - PRIVADO`: carpeta privada con contrato original, comprobantes originales, Google Sheet y Apps Script.
- `Comprobantes Pagos`: subcarpeta privada dentro de la carpeta privada. Aqui se guardan los JPG, PNG o PDF subidos desde el formulario.
- `PUBLICO Dashboard Arriendo`: carpeta opcional para archivos censurados o anonimizados, solo si decides compartir algun documento al publico.

No compartas publicamente la carpeta privada ni sus subcarpetas.

## Archivos principales

- `index.html`: pagina principal.
- `styles.css`: estilos del dashboard.
- `app.js`: calculos, formulario restringido y conexion con Google Apps Script.
- `apps-script/Code.gs`: backend para actualizar Google Sheets y subir comprobantes a Drive privado.

## Acceso al formulario

El dashboard es publico. Solo el formulario de registro de pagos requiere usuario y contrasena.

- Usuario: `admin`
- Contrasena: `MatazarnoS`

Esto es una barrera basica en el navegador. No debe considerarse seguridad fuerte porque la pagina de GitHub Pages es publica.

## Configurar Google Sheets

1. Mantén privado el Google Sheet de pagos.
2. Mantén privada la carpeta de comprobantes si decides guardar archivos manualmente.
3. Abre el Google Sheet y entra a `Extensiones > Apps Script`.
4. Copia el contenido de `apps-script/Code.gs`.
5. Cambia estos valores al inicio del script:
   - `SPREADSHEET_ID`: ID del Google Sheet privado.
   - `RECEIPTS_FOLDER_ID`: ID de la carpeta privada `Comprobantes Pagos`.
6. Ejecuta la funcion `setup` una vez para crear las hojas necesarias.
7. Publica el script como aplicacion web:
   - Ejecutar como: `Yo`.
   - Quien tiene acceso: `Cualquier usuario con el enlace`.
8. Copia la URL de la aplicacion web.
9. Pega esa URL en `app.js`, en `CONFIG.appScriptUrl`.

Nota: el formulario registra los datos del pago en Google Sheets y sube el comprobante a la carpeta privada de Drive. No sube ni publica el contrato.

## Visualizar comprobantes

El formulario permite subir un comprobante JPG, PNG o PDF. Apps Script lo guarda en la carpeta privada `Comprobantes Pagos` y devuelve el enlace para visualizarlo desde el dashboard.

Tambien existe el campo opcional `Enlace del comprobante`. Puedes usarlo si ya tienes el comprobante cargado manualmente en Drive o si quieres enlazar una copia censurada.

Cuando un pago cubre varios meses, selecciona los meses cubiertos y usa la seccion `Comprobantes por mes cubierto` para asociar el archivo o enlace correcto a cada mes. Asi el boton `Pagado` de cada mes abre el comprobante que corresponde a ese mes.

Recomendacion:

- Si usas enlaces privados de Drive, solo podran abrirlos las cuentas autorizadas en Google Drive.
- No cambies la carpeta privada a publica.
- Si necesitas que cualquier visitante pueda abrir un comprobante, usa una copia censurada en la carpeta publica opcional.
- El sitio publico puede mostrar el enlace si existe, pero no cambia permisos de Drive ni publica el archivo por si mismo.
- En los meses pagados, el boton `Pagado` abre el comprobante asociado a ese mes si existe un enlace.

## Publicar en GitHub Pages

Sube estos archivos al repositorio:

- `index.html`
- `styles.css`
- `app.js`
- carpeta `apps-script`
- `README.md`

No subas al repositorio publico:

- Contrato original.
- Comprobantes originales.
- `Registro Pagos.xlsx` si contiene datos sensibles.
- Cualquier archivo con cedulas, cuentas bancarias, firmas o datos notariales.

## Datos iniciales

La pagina incluye los pagos iniciales vistos en `Registro Pagos.xlsx` y puede enlazar comprobantes locales si esos archivos se publican junto al sitio:

- 20/03/2026, comprobante `8729228`, USD 150, aplicado a marzo 2026.
- 06/05/2026, comprobante `3630119`, USD 300, aplicado a febrero y abril 2026.
- 03/07/2026, comprobante `9609690`, USD 300, aplicado a mayo y junio 2026.

Si deseas cambiar esa distribucion, edita el arreglo `state.payments` en `app.js` antes de publicar.
