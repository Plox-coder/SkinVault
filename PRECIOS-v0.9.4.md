# SkinVault React v0.9.4: precios automáticos y bloqueados

## Cambios

- Todas las tarjetas de skins muestran su coste con una etiqueta fija, igual que
  las skins épicas y legendarias en la captura de referencia del usuario.
- No hay cajas de texto, desplegables ni acciones para cambiar precios de RP,
  esencia mítica o método de obtención desde la interfaz.
- La base de datos histórica de `src/skinPriceReference.ts` prevalece ahora
  sobre los ajustes guardados en versiones anteriores, incluso si el JSON de
  respaldo conservaba otro valor. No se modifican los datos de propiedad.
- Se ha corregido un error por el que las skins de rareza **mítica** pasaban
  por encima de su adquisición registrada en la base de datos. Se reconocen
  por ID las 9 variantes míticas del Sanctasanctórum y las 5 exaltadas
  registradas a 19/10/2026, y se muestran los costes en **esencia mítica**
  presentes en el catálogo (100, 125, 150 y 200 EM).
- Las skins cuyo método de adquisición no está documentado muestran
  «Coste pendiente» en lugar de asignarles 150 EM automáticamente.

## Cómo se muestra el Sanctasanctórum

Riot especifica que cada **chispa ancestral cuesta 400 RP**, y que la
recompensa de nivel S de variante mítica está garantizada como máximo en
**40 tiradas (16.000 RP)**. Las skins exaltadas lo están como máximo en
**80 tiradas (32.000 RP)**. Es posible conseguirlas con muchas menos tiradas;
**no tienen un precio fijo en RP**.

Cada tarjeta de Sanctasanctórum muestra «≤16.000 RP» o «≤32.000 RP», con
el detalle al pasar el ratón. El panel «Sanctasanctórum · máximo RP» suma
únicamente esos máximos para las skins que posees. Ese panel NO se suma al
contador «Valor en RP (referencia)», que corresponde a skins con precio
histórico de compra directa. La aplicación no afirma conocer lo gastado.

Fuente oficial: https://support-leagueoflegends.riotgames.com/hc/es/articles/35821278718995-El-sanctasanct%C3%B3rum

## Limitaciones

- Las referencias son históricas y locales, no precios en tiempo real de Riot.
- Algunas skins de adquisición especial carecen de precio directo.
- El catálogo de 1.962 skins de v0.9.3 se conserva. Skins que Riot incorpore
  después podrían necesitar ampliar `skinPriceReference.ts`.
- Los precios que hayas introducido manualmente en versiones anteriores se
  conservan en tus backups, pero no prevalecen sobre el catálogo ni pueden
  editarse desde la interfaz. Para IDs aún no cubiertos que ya tuvieran
  precio numérico importado, ese valor se indica como «JSON», no «Auto».
- El estado «Tengo / Me falta» continúa siendo editable para que puedas
  corregir el inventario si lo necesitas.

## Instalación

1. Haz una copia de seguridad con «Copia JSON» en tu SkinVault actual.
2. Detén el servidor de desarrollo (`Ctrl+C`).
3. Usa el ZIP completo en otra carpeta o sobreescribe los archivos incluidos
   en el ZIP de parche en tu proyecto v0.9.3.
4. Ejecuta en Windows: `npm.cmd install` y `npm.cmd run dev`.
5. Comprueba las tarjetas y, si es necesario, importa tu JSON de respaldo.

## Pruebas

```bash
node --experimental-strip-types --test tests/skin-pricing.test.mjs
```

Las 8 pruebas cubren RP por ID, exclusivas, precios bloqueados, coste de EM,
los 14 registros del Sanctasanctórum, máximos de RP, desconocidos y ausencia
de editores de precio en la interfaz. El proyecto pasa `tsc -b`. La generación
del paquete de producción con Vite no se ha comprobado en este entorno porque
las dependencias del ZIP original incluyen ejecutables de Windows.
