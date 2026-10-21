# Boda Luis y Pilar

Web de la boda de Luis y Pilar (4 de septiembre de 2027). Página estática servida con GitHub Pages.

- `index.html`: la invitación, los lugares y el formulario de confirmación.
- `lista.html`: lista privada de confirmaciones. Se abre con `lista.html#CLAVE`; la clave la tienen los novios.
- `js/config.js`: URL y clave publicable de Supabase. La clave publicable solo permite añadir confirmaciones.

Las confirmaciones se guardan en la tabla `confirmaciones` del proyecto de Supabase `BodaLuisYPilar`.
Para leerlas sin la página: Supabase → Table Editor → `confirmaciones`.

Las horas de la ceremonia y la celebración están marcadas como "por confirmar" en `index.html`.
