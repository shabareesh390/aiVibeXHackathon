import { Plus, Search, Trash2 } from "lucide-react";
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
import { addItem, deleteItem, updateItem } from "@/services/menuService";
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
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const save = async (id: string, patch: Partial<MenuItem>) => {
    await updateItem(id, patch);
    toast.success("Saved");
  };

  const remove = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove "${name}" from the menu?`)) {
      await deleteItem(id);
      toast.success(`Removed ${name}`);
    }
  };

  const filtered = menu.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesCategory = activeCategory === "All" || m.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Menu & Food Items</h1>
          <p className="text-sm text-muted-foreground">
            Manage food items, pricing, inventory stock, cook times, and stations.
          </p>
        </div>
        <AddItemDialog />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-64 max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search food items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-9 rounded-xl"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["All", ...CATEGORIES].map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className="rounded-xl text-xs"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        {!ready ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No items match your search or filter.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Food Item</TableHead>
                <TableHead>Price (₹)</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Stock Qty</TableHead>
                <TableHead>Station</TableHead>
                <TableHead>Cook Min</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="min-w-56">
                    <div className="flex items-start gap-3">
                      {m.imageUrl ? (
                        <img
                          src={m.imageUrl}
                          alt={m.name}
                          className="size-10 rounded-lg object-cover ring-1 ring-border"
                        />
                      ) : (
                        <div className="size-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {m.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 space-y-1">
                        <Input
                          aria-label={`Name of ${m.name}`}
                          defaultValue={m.name}
                          onBlur={(e) =>
                            e.target.value.trim() &&
                            e.target.value !== m.name &&
                            save(m.id, { name: e.target.value.trim() })
                          }
                          className="h-8 font-medium rounded-lg text-sm"
                        />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-semibold">{m.category}</span>
                          {m.description && (
                            <span
                              className="truncate max-w-44 text-muted-foreground/75"
                              title={m.description}
                            >
                              • {m.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
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
                    <NumCell
                      value={m.stockCount ?? 50}
                      label={`Stock of ${m.name}`}
                      min={0}
                      onCommit={(n) => save(m.id, { stockCount: n, inStock: n > 0 })}
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
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(m.id, m.name)}
                      className="size-8 text-destructive hover:bg-destructive/10"
                      title={`Remove ${m.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
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
    description: "",
    imageUrl: "",
    stockCount: "50",
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
      inStock: true,
      stockCount: Number(f.stockCount) || 50,
      description: f.description.trim() || undefined,
      imageUrl: f.imageUrl.trim() || undefined,
      aliases: [f.name.trim().toLowerCase()],
      modifiers: [],
    });
    toast.success(`${f.name} added to the menu`);
    setOpen(false);
    setF({
      name: "",
      price: "50",
      category: "Snacks",
      station: "fryer",
      durationMin: "4",
      batchSize: "4",
      description: "",
      imageUrl: "",
      stockCount: "50",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl">
          <Plus className="mr-1.5 size-4" />
          Add food item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">New Menu Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="n">Item Name</Label>
            <Input
              id="n"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder="Paneer Kathi Roll"
              required
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="desc">Description</Label>
            <Input
              id="desc"
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              placeholder="Fresh paneer chunks spiced with roll seasoning"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="img">Image URL</Label>
            <Input
              id="img"
              value={f.imageUrl}
              onChange={(e) => setF({ ...f, imageUrl: e.target.value })}
              placeholder="https://images.unsplash.com/..."
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
            <Label htmlFor="stock">Initial Stock</Label>
            <Input
              id="stock"
              type="number"
              min={0}
              value={f.stockCount}
              onChange={(e) => setF({ ...f, stockCount: e.target.value })}
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
            <Label>Kitchen Station</Label>
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
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="d">Cook Minutes</Label>
            <Input
              id="d"
              type="number"
              min={1}
              value={f.durationMin}
              onChange={(e) => setF({ ...f, durationMin: e.target.value })}
            />
          </div>
          <DialogFooter className="col-span-2 pt-2">
            <Button type="submit" className="rounded-xl w-full">
              Add to Menu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
