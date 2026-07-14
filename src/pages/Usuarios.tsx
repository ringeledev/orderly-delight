import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, ShieldCheck, User, Eye, EyeOff } from "lucide-react";
import PrinterTestPanel from "@/components/PrinterTestPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getUsuarios,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  type UsuarioAdmin,
} from "@/services/db";
import { useAuth } from "@/contexts/AuthContext";

type FormData = { nombre: string; rol: "admin" | "waiter"; pin: string; activo: boolean; color: string };

const emptyForm: FormData = { nombre: "", rol: "waiter", pin: "", activo: true, color: "#f59e0b" };

const COLORES_PRESET = [
  "#f4a261", // durazno
  "#e9c46a", // amarillo suave
  "#90be6d", // verde menta
  "#43aa8b", // verde agua
  "#4cc9f0", // celeste
  "#74b3ce", // azul pastel
  "#b5a4d4", // lavanda
  "#f4acb7", // rosa pastel
  "#ffb4a2", // salmon
  "#cdb4db", // lila
  "#a8dadc", // turquesa claro
  "#b7e4c7", // verde claro
];

export default function Usuarios() {
  const { user: me } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<UsuarioAdmin | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<UsuarioAdmin | null>(null);

  const fetchUsuarios = async () => {
    try {
      setUsuarios(await getUsuarios());
    } catch {
      toast.error("No se pudieron cargar los usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsuarios(); }, []);

  const openCreate = () => {
    setEditTarget(null);
    // pick a color not already in use
    const usedColors = usuarios.map((u) => u.color).filter(Boolean);
    const available = COLORES_PRESET.find((c) => !usedColors.includes(c)) ?? COLORES_PRESET[0];
    setForm({ ...emptyForm, color: available });
    setShowPin(false);
    setShowForm(true);
  };

  const openEdit = (u: UsuarioAdmin) => {
    setEditTarget(u);
    setForm({ nombre: u.nombre, rol: u.rol, pin: u.pin, activo: u.activo, color: u.color ?? "#f59e0b" });
    setShowPin(false);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (form.pin.length < 4) { toast.error("El PIN debe tener al menos 4 dígitos"); return; }
    if (!/^\d+$/.test(form.pin)) { toast.error("El PIN solo puede contener números"); return; }

    setSaving(true);
    try {
      if (editTarget) {
        await updateUsuario(editTarget.uuid, form);
        toast.success("Usuario actualizado");
      } else {
        await createUsuario(form);
        toast.success("Usuario creado");
      }
      setShowForm(false);
      await fetchUsuarios();
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.uuid === me?.id) { toast.error("No podés eliminar tu propio usuario"); setConfirmDelete(null); return; }
    try {
      await deleteUsuario(confirmDelete.uuid);
      toast.success("Usuario eliminado");
      setConfirmDelete(null);
      await fetchUsuarios();
    } catch (e: any) {
      toast.error(e.message ?? "Error al eliminar");
    }
  };

  const toggleActivo = async (u: UsuarioAdmin) => {
    if (u.uuid === me?.id) { toast.error("No podés desactivarte a vos mismo"); return; }
    try {
      await updateUsuario(u.uuid, { activo: !u.activo });
      toast.success(u.activo ? "Usuario desactivado" : "Usuario activado");
      await fetchUsuarios();
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Cargando...</div>;

  const admins = usuarios.filter((u) => u.rol === "admin");
  const meseros = usuarios.filter((u) => u.rol === "waiter");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PrinterTestPanel />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-primary">Usuarios</h1>
          <p className="text-muted-foreground text-sm">{usuarios.length} usuarios registrados</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus size={16} /> Nuevo usuario
        </Button>
      </div>

      {[{ label: "Administradores", list: admins, icon: ShieldCheck }, { label: "Meseros", list: meseros, icon: User }].map(({ label, list, icon: Icon }) => (
        <div key={label}>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Icon size={13} /> {label}
          </h2>
          <div className="space-y-2">
            {list.length === 0 && (
              <p className="text-muted-foreground text-sm px-1">Sin registros</p>
            )}
            {list.map((u) => (
              <div
                key={u.uuid}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  u.activo ? "bg-card border-border" : "bg-muted/40 border-border/50 opacity-60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: u.color ?? "#f59e0b" }}
                  />
                  <div>
                  <p className="font-medium text-sm">{u.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    PIN: {"•".repeat(u.pin.length)} &nbsp;·&nbsp;
                    {u.activo ? (
                      <span className="text-green-500">Activo</span>
                    ) : (
                      <span className="text-destructive">Inactivo</span>
                    )}
                    {u.uuid === me?.id && " · (vos)"}
                  </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-8"
                    onClick={() => toggleActivo(u)}
                    disabled={u.uuid === me?.id}
                  >
                    {u.activo ? "Desactivar" : "Activar"}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(u)}>
                    <Pencil size={14} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete(u)}
                    disabled={u.uuid === me?.id}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-display text-lg text-primary">
              {editTarget ? "Editar usuario" : "Nuevo usuario"}
            </h2>

            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Juan García"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <Label>PIN</Label>
              <div className="relative">
                <Input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={8}
                  value={form.pin}
                  onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))}
                  placeholder="Mínimo 4 dígitos"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPin((v) => !v)}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Rol</Label>
              <div className="flex gap-2">
                {(["waiter", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, rol: r }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                      form.rol === r
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {r === "admin" ? "Administrador" : "Mesero/a"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Color identificador</Label>
              <div className="flex flex-wrap gap-2">
                {COLORES_PRESET.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className="w-7 h-7 rounded-full transition-all"
                    style={{
                      backgroundColor: c,
                      outline: form.color === c ? `3px solid white` : "none",
                      outlineOffset: "2px",
                      boxShadow: form.color === c ? `0 0 0 5px ${c}55` : "none",
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="activo-check"
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                className="accent-primary"
              />
              <Label htmlFor="activo-check" className="cursor-pointer">Usuario activo</Label>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4" onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4 text-center">
            <Trash2 size={32} className="mx-auto text-destructive" />
            <p className="font-medium">¿Eliminar a <span className="text-primary">{confirmDelete.nombre}</span>?</p>
            <p className="text-muted-foreground text-sm">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
              <Button variant="destructive" className="flex-1" onClick={handleDelete}>Eliminar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
