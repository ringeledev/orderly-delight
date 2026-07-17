import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export function useRealtimePedidos(onUpdate: () => void) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    const channel = supabase
      .channel("pedidos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => callbackRef.current())
      .on("postgres_changes", { event: "*", schema: "public", table: "detalles_pedido" }, () => callbackRef.current())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
