import type { CanteenConfig, MenuItem, ParseResult, StaffMember } from "@/types";
import { useAppStore, uid } from "@/store/appStore";
import { supabase } from "@/lib/supabase";
import { parseOrderText } from "./parser";
import { wait } from "./util";

export async function getMenu(): Promise<MenuItem[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase.from("menu_items").select("*");
      if (!error && data && data.length > 0) {
        const mapped: MenuItem[] = data.map((d: any) => ({
          id: d.id,
          name: d.name,
          price: Number(d.price),
          available: Boolean(d.available),
          category: d.category,
          station: d.station,
          durationMin: Number(d.duration_min ?? 5),
          batchSize: Number(d.batch_size ?? 4),
          aliases: Array.isArray(d.aliases) ? d.aliases : [],
          family: d.family || undefined,
          modifiers: Array.isArray(d.modifiers) ? d.modifiers : [],
          description: d.description || undefined,
          imageUrl: d.image_url || undefined,
          inStock: Boolean(d.in_stock),
          stockCount: Number(d.stock_count ?? 50),
        }));
        useAppStore.setState({ menu: mapped });
        return mapped;
      }
    } catch {
      /* fallback to local store */
    }
  }
  await wait(100);
  return useAppStore.getState().menu;
}

export async function parseOrder(text: string): Promise<ParseResult> {
  await wait(300);
  return parseOrderText(text, useAppStore.getState().menu);
}

export async function updateItem(id: string, patch: Partial<MenuItem>): Promise<MenuItem> {
  const s = useAppStore.getState();
  const menu = s.menu.map((m) => (m.id === id ? { ...m, ...patch } : m));
  useAppStore.setState({
    menu,
    activity: [
      {
        id: uid(),
        at: Date.now(),
        kind: "menu" as const,
        text: `Menu updated: ${menu.find((m) => m.id === id)?.name}`,
      },
      ...s.activity,
    ].slice(0, 40),
  });

  if (supabase) {
    try {
      const dbPatch: any = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.price !== undefined) dbPatch.price = patch.price;
      if (patch.available !== undefined) dbPatch.available = patch.available;
      if (patch.category !== undefined) dbPatch.category = patch.category;
      if (patch.station !== undefined) dbPatch.station = patch.station;
      if (patch.durationMin !== undefined) dbPatch.duration_min = patch.durationMin;
      if (patch.batchSize !== undefined) dbPatch.batch_size = patch.batchSize;
      if (patch.stockCount !== undefined) dbPatch.stock_count = patch.stockCount;
      if (patch.inStock !== undefined) dbPatch.in_stock = patch.inStock;
      if (patch.description !== undefined) dbPatch.description = patch.description;
      if (patch.imageUrl !== undefined) dbPatch.image_url = patch.imageUrl;
      await supabase.from("menu_items").update(dbPatch).eq("id", id);
    } catch {
      /* local store already updated */
    }
  }

  await wait(80);
  return menu.find((m) => m.id === id)!;
}

export async function deleteItem(id: string): Promise<void> {
  const s = useAppStore.getState();
  const target = s.menu.find((m) => m.id === id);
  useAppStore.setState({
    menu: s.menu.filter((m) => m.id !== id),
    activity: [
      {
        id: uid(),
        at: Date.now(),
        kind: "menu" as const,
        text: `Item removed from menu: ${target?.name ?? id}`,
      },
      ...s.activity,
    ].slice(0, 40),
  });

  if (supabase) {
    try {
      await supabase.from("menu_items").delete().eq("id", id);
    } catch {
      /* local store already updated */
    }
  }

  await wait(80);
}

export async function addItem(item: Omit<MenuItem, "id">): Promise<MenuItem> {
  const created: MenuItem = {
    ...item,
    id: `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${uid().slice(0, 4)}`,
  };
  const s = useAppStore.getState();
  useAppStore.setState({
    menu: [...s.menu, created],
    activity: [
      { id: uid(), at: Date.now(), kind: "menu" as const, text: `Added to menu: ${created.name}` },
      ...s.activity,
    ].slice(0, 40),
  });

  if (supabase) {
    try {
      await supabase.from("menu_items").insert({
        id: created.id,
        name: created.name,
        price: created.price,
        available: created.available,
        category: created.category,
        station: created.station,
        duration_min: created.durationMin,
        batch_size: created.batchSize,
        aliases: created.aliases,
        family: created.family ?? null,
        modifiers: created.modifiers,
        description: created.description ?? null,
        image_url: created.imageUrl ?? null,
        in_stock: created.inStock ?? true,
        stock_count: created.stockCount ?? 50,
      });
    } catch {
      /* local store already updated */
    }
  }

  await wait(80);
  return created;
}

export async function updateCanteenConfig(patch: Partial<CanteenConfig>): Promise<void> {
  const s = useAppStore.getState();
  useAppStore.setState({
    config: { ...s.config, ...patch },
  });

  if (supabase) {
    try {
      const dbPatch: any = {};
      if (patch.slotIntervalMin !== undefined) dbPatch.slot_interval_min = patch.slotIntervalMin;
      if (patch.maxOrdersPerSlot !== undefined)
        dbPatch.max_orders_per_slot = patch.maxOrdersPerSlot;
      if (patch.openingHour !== undefined) dbPatch.opening_hour = patch.openingHour;
      if (patch.closingHour !== undefined) dbPatch.closing_hour = patch.closingHour;
      if (patch.walkInReserve !== undefined) dbPatch.walk_in_reserve = patch.walkInReserve;
      if (patch.blockedSlots !== undefined) dbPatch.blocked_slots = patch.blockedSlots;
      await supabase.from("canteen_config").update(dbPatch).eq("id", "default");
    } catch {
      /* local fallback */
    }
  }

  await wait(60);
}

export async function toggleBlockSlot(slotTime: number): Promise<void> {
  const s = useAppStore.getState();
  const current = s.config.blockedSlots ?? [];
  const has = current.includes(slotTime);
  const next = has ? current.filter((t) => t !== slotTime) : [...current, slotTime];
  useAppStore.setState({
    config: { ...s.config, blockedSlots: next },
  });

  if (supabase) {
    try {
      await supabase.from("canteen_config").update({ blocked_slots: next }).eq("id", "default");
    } catch {
      /* local fallback */
    }
  }
}

export async function addStaff(staff: Omit<StaffMember, "id">): Promise<StaffMember> {
  const created: StaffMember = { ...staff, id: `staff-${uid().slice(0, 4)}` };
  const s = useAppStore.getState();
  useAppStore.setState({
    staff: [...(s.staff ?? []), created],
  });

  if (supabase) {
    try {
      await supabase.from("staff").insert({
        id: created.id,
        name: created.name,
        role: created.role,
        station: created.station ?? null,
        active: created.active,
      });
    } catch {
      /* local fallback */
    }
  }

  await wait(60);
  return created;
}

export async function updateStaff(id: string, patch: Partial<StaffMember>): Promise<void> {
  const s = useAppStore.getState();
  useAppStore.setState({
    staff: (s.staff ?? []).map((st) => (st.id === id ? { ...st, ...patch } : st)),
  });

  if (supabase) {
    try {
      await supabase.from("staff").update(patch).eq("id", id);
    } catch {
      /* local fallback */
    }
  }

  await wait(60);
}

export async function deleteStaff(id: string): Promise<void> {
  const s = useAppStore.getState();
  useAppStore.setState({
    staff: (s.staff ?? []).filter((st) => st.id !== id),
  });

  if (supabase) {
    try {
      await supabase.from("staff").delete().eq("id", id);
    } catch {
      /* local fallback */
    }
  }

  await wait(60);
}
