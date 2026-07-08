-- Corrige el destino de impresión de TODAS las bebidas (case-insensitive, por si hay variaciones)
UPDATE productos
SET destino_impresion = 'barra'
WHERE TRIM(LOWER(categoria)) IN ('bebidas', 'extras bebidas', 'bebida', 'extra bebidas', 'extras bebida');

UPDATE productos
SET destino_impresion = 'cocina'
WHERE TRIM(LOWER(categoria)) IN ('comida', 'comidas', 'extras comidas', 'extra comidas', 'extras comida');

-- Verificación: mostrá el resultado para confirmar que quedó bien
SELECT nombre, categoria, destino_impresion FROM productos ORDER BY categoria, nombre;
