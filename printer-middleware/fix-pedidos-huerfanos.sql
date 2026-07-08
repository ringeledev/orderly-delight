-- Cierra pedidos donde TODOS los ítems ya están cobrados pero el pedido
-- quedó "pendiente" para siempre (el bug que arreglamos en el código).
UPDATE pedidos
SET estado = 'cancelado', cerrado_at = NOW(), updated_at = NOW()
WHERE estado NOT IN ('cancelado', 'entregado')
  AND cerrado_at IS NULL
  AND uuid IN (
    SELECT p.uuid
    FROM pedidos p
    JOIN detalles_pedido d ON d.pedido_id = p.uuid
    GROUP BY p.uuid
    HAVING bool_and(d.cobrado) = true
  );

-- Libera mesas que ya no tienen ningún pedido activo
UPDATE mesas
SET estado_actual = 'libre', updated_at = NOW()
WHERE estado_actual = 'ocupada'
  AND uuid NOT IN (
    SELECT mesa_id FROM pedidos
    WHERE estado NOT IN ('cancelado', 'entregado') AND cerrado_at IS NULL
  );

-- Verificación: deberían quedar 0 filas con este problema
SELECT p.uuid, p.estado, p.cerrado_at
FROM pedidos p
JOIN detalles_pedido d ON d.pedido_id = p.uuid
WHERE p.estado NOT IN ('cancelado', 'entregado')
GROUP BY p.uuid, p.estado, p.cerrado_at
HAVING bool_and(d.cobrado) = true;
