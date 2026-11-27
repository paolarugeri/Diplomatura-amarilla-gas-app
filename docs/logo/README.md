# Logo Amarilla Gas

Logo elegido: garrafa con llama (opción 2).

Para regenerar los SVG y PNG, desde la raíz del repo:

```
cd docs/logo && ln -sf ../../node_modules . && python3 gen.py && node raster.js
```

Requiere `pip install fonttools` y Playwright. Los archivos finales van a `public/img`, `public/icons` y `public/favicon.*`.
