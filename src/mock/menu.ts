import type { MenuItem, Station } from "@/types";

export const STATIONS: Station[] = [
  { id: "tawa", name: "Tawa", parallel: 3, capacityPerSlot: 12 },
  { id: "fryer", name: "Fryer", parallel: 1, capacityPerSlot: 20 },
  { id: "beverage", name: "Beverage", parallel: 2, capacityPerSlot: 16 },
  { id: "packing", name: "Packing", parallel: 2, capacityPerSlot: 10 },
];

export const WALK_IN_RESERVE = 0.2;

export const SEED_MENU: MenuItem[] = [
  { id: "masala-dosa", name: "Masala Dosa", price: 60, available: true, category: "Dosa & Tiffin", station: "tawa", durationMin: 4, batchSize: 3, family: "dosa", aliases: ["masala dosa", "masala dosai", "msala dosa"], modifiers: ["extra chutney", "less oil", "no onion"] },
  { id: "plain-dosa", name: "Plain Dosa", price: 45, available: true, category: "Dosa & Tiffin", station: "tawa", durationMin: 3, batchSize: 3, family: "dosa", aliases: ["plain dosa", "sada dosa"], modifiers: ["extra chutney", "less oil"] },
  { id: "set-dosa", name: "Set Dosa", price: 55, available: true, category: "Dosa & Tiffin", station: "tawa", durationMin: 4, batchSize: 3, family: "dosa", aliases: ["set dosa"], modifiers: ["extra chutney"] },
  { id: "onion-uttapam", name: "Onion Uttapam", price: 65, available: true, category: "Dosa & Tiffin", station: "tawa", durationMin: 5, batchSize: 2, aliases: ["uttapam", "onion uttapam", "uthappam"], modifiers: ["less spicy"] },
  { id: "idli-vada", name: "Idli Vada", price: 50, available: true, category: "Dosa & Tiffin", station: "fryer", durationMin: 3, batchSize: 10, aliases: ["idli vada", "idly vada", "idli"], modifiers: ["extra sambar"] },
  { id: "veg-noodles", name: "Veg Hakka Noodles", price: 80, available: true, category: "Rice & Noodles", station: "tawa", durationMin: 6, batchSize: 4, aliases: ["noodles", "veg noodles", "hakka noodles", "chowmein"], modifiers: ["less spicy", "extra spicy", "no onion"] },
  { id: "fried-rice", name: "Veg Fried Rice", price: 85, available: true, category: "Rice & Noodles", station: "tawa", durationMin: 6, batchSize: 4, aliases: ["fried rice", "veg fried rice", "rice"], modifiers: ["less spicy", "extra spicy"] },
  { id: "curd-rice", name: "Curd Rice", price: 50, available: true, category: "Rice & Noodles", station: "packing", durationMin: 1, batchSize: 10, aliases: ["curd rice", "dahi chawal", "thayir sadam"], modifiers: ["no pickle"] },
  { id: "samosa", name: "Samosa (2 pc)", price: 30, available: true, category: "Snacks", station: "fryer", durationMin: 5, batchSize: 10, aliases: ["samosa", "samose", "samosas"], modifiers: ["extra chutney"] },
  { id: "vada-pav", name: "Vada Pav", price: 25, available: true, category: "Snacks", station: "fryer", durationMin: 4, batchSize: 10, aliases: ["vada pav", "vadapav", "wada pav"], modifiers: ["extra chutney", "no garlic chutney"] },
  { id: "veg-puff", name: "Veg Puff", price: 25, available: true, category: "Snacks", station: "packing", durationMin: 1, batchSize: 10, aliases: ["puff", "veg puff", "puffs"], modifiers: [] },
  { id: "bread-omelette", name: "Paneer Sandwich", price: 55, available: true, category: "Snacks", station: "tawa", durationMin: 4, batchSize: 4, aliases: ["sandwich", "paneer sandwich", "grilled sandwich"], modifiers: ["no butter", "extra cheese"] },
  { id: "filter-coffee", name: "Filter Coffee", price: 20, available: true, category: "Beverages", station: "beverage", durationMin: 2, batchSize: 4, family: "coffee", aliases: ["filter coffee", "filter kaapi", "kaapi", "south indian coffee"], modifiers: ["no sugar", "less sugar", "strong"] },
  { id: "cold-coffee", name: "Cold Coffee", price: 50, available: true, category: "Beverages", station: "beverage", durationMin: 3, batchSize: 2, family: "coffee", aliases: ["cold coffee", "iced coffee"], modifiers: ["no sugar", "less sugar", "no ice"] },
  { id: "masala-chai", name: "Masala Chai", price: 15, available: true, category: "Beverages", station: "beverage", durationMin: 2, batchSize: 6, aliases: ["chai", "masala chai", "tea", "cutting chai", "cha"], modifiers: ["no sugar", "less sugar", "strong"] },
  { id: "lime-soda", name: "Fresh Lime Soda", price: 35, available: true, category: "Beverages", station: "beverage", durationMin: 2, batchSize: 4, aliases: ["lime soda", "nimbu soda", "lemon soda", "soda"], modifiers: ["sweet", "salted", "no ice"] },
];
