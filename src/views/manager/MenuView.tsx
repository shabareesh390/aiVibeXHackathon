import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addItem, updateItem } from "@/services/menuService";
import { useAppStore } from "@/store/appStore";
import type { MenuCategory, MenuItem, StationId } from "@/types";

const CATEGORIES: MenuCategory[] = ["Dosa & Tiffin", "Rice & Noodles", "Snacks", "Beverages"];

function NumCell({
  value,
  label,
  onCommit,
  min = 0,
}: {
  value: number;
  label: string;
  onCommit: (n: number) => void;
  min?: number;
}) {
  const [v, setV] = useState(String(value));
  return (
    <Input
      aria-label={label}
      type="number"
      min={min}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const n = Number(v);
        if (Number.isFinite(n) && n >= min && n !== value) onCommit(n);
        else setV(String(value));
      }}
      className="h-9 w-20 rounded-lg tabular"
    />
  );
}

export function MenuView() {
  const ready = useAppStore((s) => s.ready);
  const menu = useAppStore((s) => s.menu);
  const stations = useAppStore((s) => s.stations);
  const save = async (id: string, patch: Partial<MenuItem>) => {
    await updateItem(id, patch);
    toast.success("Saved");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Menu & stations</h1>
          <p className="text-sm text-muted-foreground">
            Edits apply instantly to student ordering and the kitchen plan.
          </p>
        </div>
        <AddItemDialog />
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        {!ready ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Price (₹)</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Station</TableHead>
                <TableHead>Minutes</TableHead>
                <TableHead>Batch size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {menu.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="min-w-48">
                    <Input
                      aria-label={`Name of ${m.name}`}
                      defaultValue={m.name}
                      onBlur={(e) =>
                        e.target.value.trim() &&
                        e.target.value !== m.name &&
                        save(m.id, { name: e.target.value.trim() })
                      }
                      className="h-9 rounded-lg"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{m.category}</p>
                  </TableCell>
                  <TableCell>
                    <NumCell
                      value={m.price}
                      label={`Price of ${m.name}`}
                      min={1}
                      onCommit={(n) => save(m.id, { price: n })}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={m.available}
                      aria-label={`${m.name} available`}
                      onCheckedChange={(v) => save(m.id, { available: v })}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={m.station}
                      onValueChange={(v) => save(m.id, { station: v as StationId })}
                    >
                      <SelectTrigger
                        className="h-9 w-32 rounded-lg"
                        aria-label={`Station for ${m.name}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stations.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <NumCell
                      value={m.durationMin}
                      label={`Cook minutes for ${m.name}`}
                      min={1}
                      onCommit={(n) => save(m.id, { durationMin: n })}
                    />
                  </TableCell>
                  <TableCell>
                    <NumCell
                      value={m.batchSize}
                      label={`Batch size for ${m.name}`}
                      min={1}
                      onCommit={(n) => save(m.id, { batchSize: n })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function AddItemDialog() {
  const stations = useAppStore((s) => s.stations);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: "",
    price: "50",
    category: "Snacks" as MenuCategory,
    station: "fryer" as StationId,
    durationMin: "4",
    batchSize: "4",
  });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) {
      toast.error("Give the item a name");
      return;
    }
    await addItem({
      name: f.name.trim(),
      price: Number(f.price),
      category: f.category,
      station: f.station,
      durationMin: Number(f.durationMin),
      batchSize: Number(f.batchSize),
      available: true,
      aliases: [f.name.trim().toLowerCase()],
      modifiers: [],
    });
    toast.success(`${f.name} added to the menu`);
    setOpen(false);
    setF({ ...f, name: "" });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl">
          <Plus />
          Add item
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">New menu item</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="n">Name</Label>
            <Input
              id="n"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder="Paneer Kathi Roll"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p">Price (₹)</Label>
            <Input
              id="p"
              type="number"
              min={1}
              value={f.price}
              onChange={(e) => setF({ ...f, price: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={f.category}
              onValueChange={(v) => setF({ ...f, category: v as MenuCategory })}
            >
              <SelectTrigger aria-label="Category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Station</Label>
            <Select
              value={f.station}
              onValueChange={(v) => setF({ ...f, station: v as StationId })}
            >
              <SelectTrigger aria-label="Station">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stations.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d">Cook minutes</Label>
            <Input
              id="d"
              type="number"
              min={1}
              value={f.durationMin}
              onChange={(e) => setF({ ...f, durationMin: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b">Batch size</Label>
            <Input
              id="b"
              type="number"
              min={1}
              value={f.batchSize}
              onChange={(e) => setF({ ...f, batchSize: e.target.value })}
            />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="submit" className="rounded-xl">
              Add to menu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
