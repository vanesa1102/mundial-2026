# Polla Familiar Mundial 2026

Aplicación web para gestionar la polla del Mundial: ranking de jugadores, premios, puntajes y detalle de cada apuesta.

## Requisitos

- [Node.js](https://nodejs.org/) (v18 o superior recomendado)
- npm (incluido con Node.js)

## Instalación

```bash
npm install
```

## Ver la aplicación

```bash
npm run dev
```

Abre en el navegador: **http://localhost:3000**

> Importante: usa el servidor local (`npm run dev`). No abras `index.html` directamente desde el explorador de archivos.

---

## Agregar un jugador (comando único)

La forma más simple. Un solo comando convierte el Excel, crea el JSON y actualiza el ranking:

```bash
npm run add:jugador -- "C:\ruta\al\archivo.xlsx" "Maria Lopez"
```

Con id personalizado (opcional):

```bash
npm run add:jugador -- "C:\ruta\al\archivo.xlsx" "Maria Lopez" "maria-lopez"
```

**Qué hace automáticamente:**

1. Lee la pestaña **RESUMEN** del Excel (partidos por fase)
2. Toma **campeón y subcampeón** de la pestaña **FINAL** (resultado del último partido)
3. Crea `data/participantes/<id>.json` con `id` y `nombre`
4. Ejecuta `npm run build` (recalcula ranking y sincroniza la web)

Si no indicas el id, se genera desde el nombre (`Maria Lopez` → `maria-lopez`).

Luego recarga **http://localhost:3000** con **Ctrl + F5**.

---

## Actualizar la apuesta de un jugador

Si la persona vuelve a enviar su Excel (antes del cierre de predicciones), actualiza así:

```bash
npm run update:jugador -- "C:\ruta\al\archivo-nuevo.xlsx" "Pepita Perez"
```

O con el mismo comando de agregar, usando `--update`:

```bash
npm run add:jugador -- --update "C:\ruta\al\archivo-nuevo.xlsx" "Pepita Perez"
```

El `id` debe coincidir con el jugador existente (`Pepita Perez` → `pepita-perez`). Si necesitas otro id, indícalo como tercer argumento.

Si intentas agregar sin `--update` y el jugador ya existe, el comando te avisará y no sobrescribirá nada.

---

## Agregar un jugador (paso a paso)

### 1. Recibir el Excel del participante

Cada persona debe enviarte el archivo de Excel completado con la pestaña **RESUMEN** llena:

- Dieciseisavos de final
- Octavos de final
- Cuartos de final
- Semifinales
- Final y tercer puesto
- Campeón, subcampeón, 3er/4to puesto y goleador

### 2. Convertir el Excel a JSON

Desde la carpeta del proyecto:

```bash
npm run convert:resumen -- "C:\ruta\al\archivo-del-jugador.xlsx" "data/participantes/maria-lopez.json"
```

**Sobre el `id` del jugador:**

- El `id` se toma del **nombre del archivo JSON**, no del Excel.
- En el ejemplo anterior, el id será: `maria-lopez`
- Usa minúsculas, sin espacios ni tildes (guiones en su lugar).

### 3. Revisar el JSON generado

Abre `data/participantes/maria-lopez.json` y confirma que tenga:

```json
"participante": {
  "id": "maria-lopez",
  "nombre": "Maria Lopez"
}
```

Si `nombre` quedó en `null`, edítalo manualmente con el nombre que quieres mostrar en el ranking.

### 4. Actualizar ranking y web

```bash
npm run build
```

Este comando:

1. Recalcula puntos y genera `data/ranking.json`
2. Copia los datos a `public/` para la web

### 5. Ver el resultado

Recarga **http://localhost:3000** con **Ctrl + F5**.

El jugador nuevo aparecerá en el ranking. Al hacer clic verás su detalle en `jugador.html#maria-lopez`.

---

## Agregar varios jugadores a la vez

Convierte cada Excel por separado:

```bash
npm run convert:resumen -- "C:\Descargas\Pepita.xlsx" "data/participantes/pepita-perez.json"
npm run convert:resumen -- "C:\Descargas\Juan.xlsx" "data/participantes/juan-ramirez.json"
npm run convert:resumen -- "C:\Descargas\Ana.xlsx" "data/participantes/ana-torres.json"
```

Luego ejecuta **una sola vez**:

```bash
npm run build
```

---

## Resumen rápido (por jugador)

**Opción rápida (recomendada):**

```bash
npm run add:jugador -- "excel.xlsx" "Nombre Completo"
```

**Opción manual:**

| Paso | Acción |
|------|--------|
| 1 | Recibir Excel con pestaña RESUMEN completa |
| 2 | `npm run convert:resumen -- "excel.xlsx" "data/participantes/id-jugador.json"` |
| 3 | Revisar/editar `nombre` en el JSON si hace falta |
| 4 | `npm run build` |
| 5 | Recargar la web |

---

## Actualizar resultados oficiales del Mundial

Edita `data/resultados-oficiales.json`:

1. Agrega o actualiza los partidos reales (mismo formato que los pronósticos).
2. Añade la etapa terminada en `etapasConfirmadas`:

```json
"etapasConfirmadas": ["dieciseisavos", "octavos", "cuartos"]
```

Etapas posibles: `dieciseisavos`, `octavos`, `cuartos`, `semifinales`, `final`, `campeon`, `goleador`.

3. Actualiza `resultadosFinales` cuando corresponda (campeón, goleador, etc.).
4. Ejecuta:

```bash
npm run build
```

Solo se puntúan las etapas listadas en `etapasConfirmadas`.

---

## Sistema de puntos

| Etapa | Puntos por acierto |
|-------|-------------------|
| Dieciseisavos | 1 |
| Octavos | 2 |
| Cuartos | 3 |
| Semifinales | 5 |
| Final | 8 |
| Campeón | 13 |
| Goleador | 9 |

Se suma **1 punto por cada equipo acertado** en la etapa correspondiente (excepto campeón y goleador, que son campos únicos).

---

## Premios

Configuración en `data/config.json`:

```json
{
  "inscripcion": 25000,
  "moneda": "COP",
  "distribucionPremios": {
    "1": 0.5,
    "2": 0.3,
    "3": 0.2
  }
}
```

- Pozo total = número de jugadores × inscripción
- 1.º lugar: 50%
- 2.º lugar: 30%
- 3.º lugar: 20%

---

## Estructura del proyecto

```
data/
  participantes/           # Un JSON por jugador (aquí agregas nuevos)
  resultados-oficiales.json  # Resultados reales del mundial
  ranking.json               # Generado automáticamente (no editar a mano)
  config.json                # Inscripción y distribución de premios

public/                    # Sitio web (se genera con npm run build)
scripts/
  convert-resumen.js       # Excel → JSON
  calcular-puntos.js       # Calcula ranking
  sync-public.js           # Copia datos a public/
lib/
  scoring.js               # Motor de puntos
```

---

## Comandos disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run add:jugador` | Agrega jugador: Excel → JSON → ranking → web |
| `npm run update:jugador` | Actualiza apuesta de un jugador existente |
| `npm run dev` | Construye y levanta el servidor en http://localhost:3000 |
| `npm run build` | Recalcula ranking y sincroniza la web |
| `npm run convert:resumen` | Convierte Excel (pestaña RESUMEN) a JSON |
| `npm run score` | Solo recalcula `data/ranking.json` |
| `npm run sync:public` | Solo copia archivos a `public/` |
| `npm run setup:participantes` | Crea jugadores de ejemplo (solo pruebas) |

---

## Notas

- No edites `data/ranking.json` manualmente; siempre regenera con `npm run build`.
- Los archivos en `public/` se sobrescriben al ejecutar `npm run build`.
- Fecha límite de predicciones (reglamento): **17 de junio a medianoche**, después de la primera fecha de grupos. La app no bloquea fechas automáticamente.
