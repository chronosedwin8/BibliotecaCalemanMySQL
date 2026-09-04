# Identidad visual — Colegio Alemán de Barranquilla

Aplicación del manual de identidad en BiblioCalem.

## Paleta

Definida como tokens de Tailwind v4 en [`src/index.css`](../src/index.css) (bloque `@theme`).

### Primarios

| Color    | HEX       | Pantone         | Token                |
|----------|-----------|-----------------|----------------------|
| Negro    | `#000000` | Black 6 C       | `--color-tinta`      |
| Rojo     | `#C03928` | Red 7626 C      | `--color-danger`, escala `red-*`    |
| Amarillo | `#F0CE2D` | Yellow 012 C    | `--color-accent`, escala `yellow-*` |
| Azul     | `#21529B` | 2935 C          | `--color-primary`, escala `blue-*`  |

### Secundarios

Solo para detalles y textos de apoyo. No sustituyen a los primarios ni se usan en el logotipo.

| Color    | HEX       | Token / escala                  |
|----------|-----------|---------------------------------|
| Plata    | `#A6A9AB` | `--color-secondary`, `plata-*`  |
| Coral    | `#F98080` | `--color-coral`, `coral-*`      |
| Vainilla | `#F5E7A8` | `--color-vainilla`, `vainilla-*`|
| Celeste  | `#8BD5F2` | `--color-celeste`, `celeste-*`  |

> **Nota:** el manual imprime "Vainilla `#F0CE2D`", el mismo valor del amarillo primario.
> Es una errata: la muestra del manual es un crema pálido. Se usa `#F5E7A8`.
> Corregir aquí si diseño confirma otro valor.

### Alias

Para no reescribir componentes existentes, algunas escalas de Tailwind apuntan a colores de marca:

- `indigo-*` → azul institucional
- `amber-*` → amarillo institucional
- `purple-*` / `violet-*` → celeste secundario

`green` / `emerald` se conservan como colores **semánticos** de estado (disponible, activo,
devuelto). El manual no contempla verde; se mantiene por legibilidad funcional.

## Línea gráfica

15 iconos de línea (blanco sobre transparente) con símbolos de Colombia y Alemania:
orquídea, sombrero vueltiao, acordeón, arriero, empanada, café, mariposas, flor, cinta,
pretzel, Puerta de Brandenburgo, águila, cóndor, trigo, sombrero.

- **Originales:** 4167×4167 px (carpeta de diseño, fuera del repo).
- **Optimizados:** [`public/brand/`](../public/brand/) a 512 px máx.
- **Patrón:** `public/brand/pattern.png` — tile de 900 px **sin costuras**, generado a
  partir de 9 iconos. Es el asset que se usa en la interfaz.

### Utilidades CSS

Definidas al final de [`src/index.css`](../src/index.css):

| Clase | Uso |
|-------|-----|
| `.brand-pattern` | Fondo con la línea gráfica (620 px). Siempre sobre color de marca, nunca solo. |
| `.brand-pattern-xs` / `-sm` / `-lg` | Variantes de escala (260 / 420 / 820 px). |
| `.brand-rule` | Franja tricolor azul · amarillo · rojo (4 px). |
| `.brand-surface` | Superficie azul con la línea gráfica al 12 % ya incorporada. |

**Cuidado con `.brand-rule`:** su tercio azul desaparece sobre fondo azul. Colocarla
siempre sobre superficie clara.

### Dónde está aplicada

- [`src/pages/auth/Login.tsx`](../src/pages/auth/Login.tsx) — patrón al 13 % en el panel
  azul; franja tricolor sobre la columna del formulario.
- [`src/components/layout/Layout.tsx`](../src/components/layout/Layout.tsx) — patrón al 6 %
  en la barra lateral; franja tricolor bajo el encabezado.
