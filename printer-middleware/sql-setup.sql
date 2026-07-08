-- Campo de ruteo de impresión por producto
ALTER TABLE productos ADD COLUMN IF NOT EXISTS destino_impresion text DEFAULT 'cocina'
  CHECK (destino_impresion IN ('cocina', 'barra', 'ninguno'));

-- Asignación inicial sugerida según categoría existente
UPDATE productos SET destino_impresion = 'barra'
  WHERE categoria IN ('Bebidas', 'Extras Bebidas');

UPDATE productos SET destino_impresion = 'cocina'
  WHERE categoria IN ('Comida', 'Extras Comidas');
