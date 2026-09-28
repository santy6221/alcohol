# Cóctel Codex

Una app de catálogo de cócteles hecha con React + Vite. Permite buscar tragos, filtrar por categoría y explorar recetas con información de ingredientes e instrucciones.

## Demo

Proyecto desplegado en GitHub Pages:

https://santy6221.github.io/alcohol/

## Funcionalidades

- Búsqueda por nombre de cóctel
- Filtro por categoría
- Opción de selección aleatoria
- Vista detallada con ingredientes e instrucciones
- Traducción al español para textos de la UI y receta
- Diseño oscuro estilo barra / catálogo

## Tecnologías

- React
- Vite
- JavaScript
- TheCocktailDB API
- Lucide React

## Requisitos

- Node.js 18+
- npm

## Instalación

```bash
npm install
```

## Ejecutar en local

```bash
npm run dev
```

La app quedará disponible en el puerto por defecto de Vite, normalmente:

```text
http://localhost:5173/
```

## Build de producción

```bash
npm run build
```

## Deploy a GitHub Pages

1. Asegurate de tener el repositorio creado en GitHub.
2. Ejecuta:

```bash
npm run deploy
```

Este comando genera la carpeta `dist` y la publica con `gh-pages`.

## Estructura principal

```text
src/
  App.jsx
  App.css
  main.jsx
public/
  ...
```

## Nota

La aplicación consume datos desde TheCocktailDB y usa una API de traducción para mostrar recetas en español cuando corresponde.
