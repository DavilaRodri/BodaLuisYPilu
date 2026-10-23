# Boda Pilar y Luis

Web de la boda de Pilar y Luis (4 de septiembre de 2027). Página estática servida con GitHub Pages.

- `index.html`: la invitación, los lugares y el formulario de confirmación.
- `admin/`: lista de invitados para los novios, con usuario y contraseña (Supabase Auth). Solo la cuenta de los novios puede leer y borrar respuestas. `lista.html` redirige aquí.
- `js/config.js`: URL y clave publicable de Supabase. La clave publicable solo permite añadir confirmaciones.

Las confirmaciones se guardan en la tabla `confirmaciones` del proyecto de Supabase `BodaLuisYPilar`.
Para leerlas sin la página: Supabase → Table Editor → `confirmaciones`.

Las horas de la ceremonia y la celebración están marcadas como "por confirmar" en `index.html`.
