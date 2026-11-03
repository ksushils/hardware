import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const categories = [
  { slug: "graphics-cards", name: "Graphics Cards", icon: "gpu", description: "Tested GPUs for gaming, rendering and AI workloads." },
  { slug: "processors", name: "Processors", icon: "cpu", description: "Desktop CPUs from the latest and previous generations." },
  { slug: "motherboards", name: "Motherboards", icon: "motherboard", description: "Boards for every socket and form factor." },
  { slug: "memory", name: "Memory (RAM)", icon: "ram", description: "DDR4 and DDR5 kits, tested with MemTest86." },
  { slug: "storage", name: "SSDs & Storage", icon: "storage", description: "NVMe and SATA SSDs, hard drives and health-checked storage." },
  { slug: "power-supplies", name: "Power Supplies", icon: "psu", description: "80+ certified PSUs, load tested." },
  { slug: "cases", name: "PC Cases", icon: "case", description: "Towers from mini-ITX to full ATX." },
  { slug: "cooling", name: "Cooling", icon: "cooling", description: "Air coolers, AIOs and case fans." },
  { slug: "monitors", name: "Monitors", icon: "monitor", description: "Gaming and pro displays with dead-pixel checks." },
  { slug: "laptops", name: "Laptops", icon: "laptop", description: "Gaming and business laptops, battery health checked." },
  { slug: "gaming-pcs", name: "Gaming PCs", icon: "pc", description: "Ready-built desktops, stress tested for 24 hours." },
  { slug: "peripherals", name: "Peripherals", icon: "peripherals", description: "Keyboards, mice and headsets." },
  { slug: "networking", name: "Networking", icon: "networking", description: "Wi-Fi routers, mesh systems and switches." },
];

type P = {
  name: string; brand: string; cat: string; priceNew: number; featured?: boolean; express?: boolean;
  specs: Record<string, string>; desc: string; v: [string, number, number][]; // condition, price, stock
};

const products: P[] = [
  { name: "GeForce RTX 4090 Founders Edition 24GB", brand: "NVIDIA", cat: "graphics-cards", priceNew: 8499, featured: true, express: true,
    specs: { Memory: "24GB GDDR6X", "Boost Clock": "2.52 GHz", "CUDA Cores": "16384", TDP: "450W", Outputs: "3x DP 1.4a, 1x HDMI 2.1" },
    desc: "The flagship Ada Lovelace GPU for 4K gaming, content creation and local AI. Every unit passes a 2-hour stress test and thermal paste check.",
    v: [["EXCELLENT", 6799, 3], ["VERY_GOOD", 6399, 2], ["GOOD", 5999, 1]] },
  { name: "GeForce RTX 4070 Super 12GB", brand: "NVIDIA", cat: "graphics-cards", priceNew: 2599, featured: true, express: true,
    specs: { Memory: "12GB GDDR6X", "Boost Clock": "2.48 GHz", "CUDA Cores": "7168", TDP: "220W" },
    desc: "A great 1440p card with DLSS 3 frame generation, at a much lower power draw than the last generation.",
    v: [["NEW", 2499, 6], ["EXCELLENT", 2049, 5], ["VERY_GOOD", 1899, 4], ["GOOD", 1749, 2]] },
  { name: "GeForce RTX 3080 10GB", brand: "NVIDIA", cat: "graphics-cards", priceNew: 2899, featured: true,
    specs: { Memory: "10GB GDDR6X", "CUDA Cores": "8704", TDP: "320W" },
    desc: "Still a strong 1440p and 4K performer. Ex-gaming units only, never used for mining.",
    v: [["EXCELLENT", 1499, 4], ["VERY_GOOD", 1349, 6], ["GOOD", 1199, 3]] },
  { name: "Radeon RX 7900 XTX 24GB", brand: "AMD", cat: "graphics-cards", priceNew: 4199,
    specs: { Memory: "24GB GDDR6", "Stream Processors": "6144", TDP: "355W" },
    desc: "AMD's RDNA 3 flagship, with 24GB of VRAM for high-resolution gaming.",
    v: [["NEW", 3899, 3], ["EXCELLENT", 3199, 2], ["VERY_GOOD", 2999, 2]] },
  { name: "Radeon RX 6700 XT 12GB", brand: "AMD", cat: "graphics-cards", priceNew: 1599,
    specs: { Memory: "12GB GDDR6", TDP: "230W" },
    desc: "The 1080p/1440p value champion.",
    v: [["VERY_GOOD", 849, 7], ["GOOD", 749, 5]] },

  { name: "Core i9-14900K", brand: "Intel", cat: "processors", priceNew: 2399, featured: true, express: true,
    specs: { Cores: "24 (8P + 16E)", Threads: "32", "Max Turbo": "6.0 GHz", Socket: "LGA1700", TDP: "125W" },
    desc: "Intel's fastest desktop gaming CPU, unlocked for overclocking. Microcode is updated and the chip is stability tested.",
    v: [["NEW", 2249, 5], ["EXCELLENT", 1799, 4], ["VERY_GOOD", 1649, 2]] },
  { name: "Ryzen 7 7800X3D", brand: "AMD", cat: "processors", priceNew: 1799, featured: true, express: true,
    specs: { Cores: "8", Threads: "16", "Boost Clock": "5.0 GHz", Socket: "AM5", Cache: "96MB L3 (3D V-Cache)" },
    desc: "The best gaming CPU per dirham, thanks to 3D V-Cache.",
    v: [["NEW", 1699, 8], ["EXCELLENT", 1399, 5], ["VERY_GOOD", 1299, 3]] },
  { name: "Ryzen 5 5600X", brand: "AMD", cat: "processors", priceNew: 799,
    specs: { Cores: "6", Threads: "12", "Boost Clock": "4.6 GHz", Socket: "AM4" },
    desc: "A budget AM4 gaming CPU.",
    v: [["EXCELLENT", 449, 10], ["GOOD", 379, 6]] },
  { name: "Core i5-12400F", brand: "Intel", cat: "processors", priceNew: 699,
    specs: { Cores: "6", Threads: "12", "Max Turbo": "4.4 GHz", Socket: "LGA1700" },
    desc: "A popular budget gaming chip.",
    v: [["NEW", 549, 12], ["VERY_GOOD", 399, 8]] },

  { name: "ROG Strix Z790-E Gaming WiFi", brand: "ASUS", cat: "motherboards", priceNew: 1899,
    specs: { Socket: "LGA1700", Chipset: "Z790", Memory: "4x DDR5", "Form Factor": "ATX", WiFi: "Wi-Fi 6E" },
    desc: "A premium Z790 board with robust VRMs, PCIe 5.0 and Wi-Fi 6E. The BIOS is updated to the latest version.",
    v: [["EXCELLENT", 1349, 3], ["VERY_GOOD", 1199, 2]] },
  { name: "B650 Tomahawk WiFi", brand: "MSI", cat: "motherboards", priceNew: 1049, featured: true,
    specs: { Socket: "AM5", Chipset: "B650", Memory: "4x DDR5", "Form Factor": "ATX" },
    desc: "The sweet-spot AM5 board.",
    v: [["NEW", 949, 6], ["EXCELLENT", 799, 4], ["GOOD", 659, 2]] },
  { name: "B550 Aorus Elite AX V2", brand: "Gigabyte", cat: "motherboards", priceNew: 699,
    specs: { Socket: "AM4", Chipset: "B550", Memory: "4x DDR4", "Form Factor": "ATX" },
    desc: "A reliable AM4 board with Wi-Fi 6.",
    v: [["VERY_GOOD", 429, 5], ["GOOD", 369, 3]] },

  { name: "Vengeance RGB 32GB (2x16GB) DDR5-6000", brand: "Corsair", cat: "memory", priceNew: 599, featured: true, express: true,
    specs: { Capacity: "32GB (2x16GB)", Type: "DDR5", Speed: "6000 MT/s", Latency: "CL36" },
    desc: "Fast DDR5 with XMP 3.0 and EXPO support. Passes 4 MemTest86 passes.",
    v: [["NEW", 549, 15], ["EXCELLENT", 429, 10]] },
  { name: "Fury Beast 16GB (2x8GB) DDR4-3200", brand: "Kingston", cat: "memory", priceNew: 229,
    specs: { Capacity: "16GB (2x8GB)", Type: "DDR4", Speed: "3200 MT/s", Latency: "CL16" },
    desc: "An affordable DDR4 kit for AM4 and LGA1700 builds.",
    v: [["NEW", 199, 20], ["VERY_GOOD", 139, 14]] },

  { name: "990 PRO 2TB NVMe M.2 SSD", brand: "Samsung", cat: "storage", priceNew: 899, featured: true, express: true,
    specs: { Capacity: "2TB", Interface: "PCIe 4.0 x4 NVMe", "Read Speed": "7450 MB/s", "Write Speed": "6900 MB/s" },
    desc: "A top-tier PCIe 4.0 SSD. Used units ship with 95%+ health, verified with SMART.",
    v: [["NEW", 799, 12], ["EXCELLENT", 599, 6]] },
  { name: "SN770 1TB NVMe SSD", brand: "WD", cat: "storage", priceNew: 349,
    specs: { Capacity: "1TB", Interface: "PCIe 4.0 x4 NVMe", "Read Speed": "5150 MB/s" },
    desc: "A great-value NVMe boot drive.",
    v: [["NEW", 299, 18], ["EXCELLENT", 219, 9]] },
  { name: "IronWolf 8TB NAS HDD", brand: "Seagate", cat: "storage", priceNew: 999,
    specs: { Capacity: "8TB", RPM: "7200", Cache: "256MB", Interface: "SATA 6Gb/s" },
    desc: "A NAS-grade hard drive. Power-on hours are disclosed for every unit.",
    v: [["VERY_GOOD", 549, 6], ["GOOD", 469, 4]] },

  { name: "RM850x 850W 80+ Gold", brand: "Corsair", cat: "power-supplies", priceNew: 649,
    specs: { Wattage: "850W", Efficiency: "80+ Gold", Modular: "Fully modular" },
    desc: "A quiet, fully modular PSU, load tested at 100%.",
    v: [["NEW", 579, 9], ["EXCELLENT", 429, 5]] },
  { name: "Focus GX-750 750W 80+ Gold", brand: "Seasonic", cat: "power-supplies", priceNew: 499,
    specs: { Wattage: "750W", Efficiency: "80+ Gold", Modular: "Fully modular" },
    desc: "Seasonic reliability at a low price.",
    v: [["VERY_GOOD", 299, 7]] },

  { name: "O11 Dynamic EVO", brand: "Lian Li", cat: "cases", priceNew: 699,
    specs: { "Form Factor": "Mid Tower", Motherboard: "E-ATX / ATX / mATX", Glass: "Dual tempered glass" },
    desc: "The iconic dual-chamber showcase case.",
    v: [["NEW", 649, 5], ["EXCELLENT", 479, 3]] },
  { name: "H5 Flow", brand: "NZXT", cat: "cases", priceNew: 399,
    specs: { "Form Factor": "Mid Tower", Motherboard: "ATX / mATX / ITX" },
    desc: "A clean, high-airflow case.",
    v: [["VERY_GOOD", 249, 6], ["GOOD", 199, 4]] },

  { name: "Galahad II Trinity 360mm AIO", brand: "Lian Li", cat: "cooling", priceNew: 699,
    specs: { Type: "AIO Liquid", Radiator: "360mm", Sockets: "LGA1700 / AM5 / AM4" },
    desc: "A high-performance 360mm AIO that tames i9 and Ryzen 9 chips.",
    v: [["NEW", 599, 4], ["EXCELLENT", 449, 3]] },
  { name: "NH-D15 chromax.black", brand: "Noctua", cat: "cooling", priceNew: 499, express: true,
    specs: { Type: "Dual-tower air", Fans: "2x 140mm", Sockets: "LGA1700 / AM5 / AM4" },
    desc: "A legendary air cooler. New mounting kit included.",
    v: [["NEW", 449, 8], ["VERY_GOOD", 319, 4]] },

  { name: "Odyssey G7 27\" 1440p 240Hz", brand: "Samsung", cat: "monitors", priceNew: 2199, featured: true,
    specs: { Size: "27\"", Resolution: "2560x1440", "Refresh Rate": "240Hz", Panel: "VA, 1000R curve" },
    desc: "A fast curved QHD gaming monitor. Zero dead pixels guaranteed.",
    v: [["EXCELLENT", 1349, 3], ["VERY_GOOD", 1199, 4], ["GOOD", 999, 2]] },
  { name: "UltraGear 27GP850 27\" 165Hz Nano IPS", brand: "LG", cat: "monitors", priceNew: 1599,
    specs: { Size: "27\"", Resolution: "2560x1440", "Refresh Rate": "165Hz (180Hz OC)", Panel: "Nano IPS" },
    desc: "A colour-accurate, fast IPS gaming monitor.",
    v: [["EXCELLENT", 999, 4], ["GOOD", 799, 3]] },
  { name: "UltraSharp U2723QE 27\" 4K", brand: "Dell", cat: "monitors", priceNew: 2499,
    specs: { Size: "27\"", Resolution: "3840x2160", Panel: "IPS Black", Ports: "USB-C 90W, RJ45" },
    desc: "A professional 4K hub monitor for creators and offices.",
    v: [["EXCELLENT", 1599, 3], ["VERY_GOOD", 1449, 2]] },

  { name: "ROG Strix G16 (i9-13980HX, RTX 4070)", brand: "ASUS", cat: "laptops", priceNew: 7499, featured: true,
    specs: { CPU: "Core i9-13980HX", GPU: "RTX 4070 8GB", RAM: "16GB DDR5", Storage: "1TB SSD", Display: "16\" QHD+ 240Hz" },
    desc: "A desktop-class gaming laptop. Battery health is 90% or higher.",
    v: [["EXCELLENT", 4999, 2], ["VERY_GOOD", 4599, 3]] },
  { name: "ThinkPad X1 Carbon Gen 11", brand: "Lenovo", cat: "laptops", priceNew: 6999,
    specs: { CPU: "Core i7-1365U", RAM: "16GB", Storage: "512GB SSD", Display: "14\" WUXGA" },
    desc: "A premium ultralight business laptop.",
    v: [["EXCELLENT", 3799, 3], ["GOOD", 2999, 4]] },
  { name: "Legion 5 Pro (Ryzen 7, RTX 3070)", brand: "Lenovo", cat: "laptops", priceNew: 5999,
    specs: { CPU: "Ryzen 7 5800H", GPU: "RTX 3070 8GB", RAM: "16GB", Display: "16\" WQXGA 165Hz" },
    desc: "Great 1440p laptop gaming at a fraction of the new price.",
    v: [["VERY_GOOD", 3199, 3], ["GOOD", 2799, 2]] },

  { name: "TechRevive Apex: Ryzen 7 7800X3D + RTX 4080 Super", brand: "TechRevive", cat: "gaming-pcs", priceNew: 10999, featured: true, express: true,
    specs: { CPU: "Ryzen 7 7800X3D", GPU: "RTX 4080 Super 16GB", RAM: "32GB DDR5-6000", Storage: "2TB NVMe", PSU: "850W Gold" },
    desc: "A 4K high-refresh gaming desktop, built in Dubai and burned in for 24 hours with a 2-year warranty.",
    v: [["NEW", 9499, 3], ["EXCELLENT", 7999, 2]] },
  { name: "TechRevive Core: i5-12400F + RTX 3060 Ti", brand: "TechRevive", cat: "gaming-pcs", priceNew: 4499,
    specs: { CPU: "Core i5-12400F", GPU: "RTX 3060 Ti 8GB", RAM: "16GB DDR4", Storage: "1TB NVMe" },
    desc: "A 1080p high-refresh starter rig built with certified renewed parts.",
    v: [["EXCELLENT", 2799, 4], ["VERY_GOOD", 2599, 3]] },

  { name: "G Pro X Superlight 2 Wireless Mouse", brand: "Logitech", cat: "peripherals", priceNew: 649, express: true,
    specs: { Weight: "60g", Sensor: "HERO 2", Connectivity: "LIGHTSPEED wireless" },
    desc: "An esports-grade ultralight mouse.",
    v: [["NEW", 579, 10], ["EXCELLENT", 429, 5]] },
  { name: "BlackWidow V4 Pro Mechanical Keyboard", brand: "Razer", cat: "peripherals", priceNew: 999,
    specs: { Switches: "Razer Green", Layout: "Full-size, EN/AR", Backlight: "Chroma RGB" },
    desc: "A premium mechanical keyboard with an Arabic layout option.",
    v: [["EXCELLENT", 599, 4], ["GOOD", 449, 2]] },
  { name: "Arctis Nova Pro Wireless Headset", brand: "SteelSeries", cat: "peripherals", priceNew: 1499,
    specs: { Connectivity: "2.4GHz + Bluetooth", ANC: "Yes", Battery: "Hot-swappable" },
    desc: "A flagship gaming headset with ANC. New ear cushions fitted.",
    v: [["EXCELLENT", 899, 3], ["VERY_GOOD", 799, 2]] },

  { name: "Archer AX73 Wi-Fi 6 Router", brand: "TP-Link", cat: "networking", priceNew: 499,
    specs: { Standard: "Wi-Fi 6 AX5400", Ports: "4x Gigabit LAN", Coverage: "Large apartment" },
    desc: "A fast, reliable Wi-Fi 6 router, compatible with etisalat and du fibre.",
    v: [["NEW", 429, 8], ["EXCELLENT", 279, 6]] },
  { name: "Deco XE75 Mesh (3-Pack)", brand: "TP-Link", cat: "networking", priceNew: 1499,
    specs: { Standard: "Wi-Fi 6E AXE5400", Units: "3", Coverage: "Up to 650 m²" },
    desc: "Whole-villa Wi-Fi 6E coverage.",
    v: [["EXCELLENT", 899, 3]] },
];

function slugify(s: string) {
  return s.toLowerCase().replace(/["']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function main() {
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.review.deleteMany();
  await db.wishlistItem.deleteMany();
  await db.variant.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany();
  await db.coupon.deleteMany();

  const catMap: Record<string, { id: string; icon: string }> = {};
  for (const [i, c] of categories.entries()) {
    const row = await db.category.create({ data: { ...c, sortOrder: i } });
    catMap[c.slug] = { id: row.id, icon: c.icon };
  }

  for (const p of products) {
    const slug = slugify(`${p.brand} ${p.name}`);
    await db.product.create({
      data: {
        slug, name: p.name, brand: p.brand, description: p.desc, specs: JSON.stringify(p.specs),
        image: `/img/${catMap[p.cat].icon}.svg`, categoryId: catMap[p.cat].id, priceNew: p.priceNew,
        featured: !!p.featured, express: !!p.express,
        variants: {
          create: p.v.map(([condition, price, stock]) => ({
            condition, price, stock, sku: `${slug.slice(0, 24)}-${condition}`.toUpperCase(),
            comparePrice: condition === "NEW" ? p.priceNew : Math.round(price * 1.12),
          })),
        },
      },
    });
  }

  await db.coupon.createMany({
    data: [
      { code: "WELCOME10", type: "PERCENT", value: 10, minSpend: 200 },
      { code: "BUILD75", type: "FIXED", value: 75, minSpend: 1000 },
      { code: "UAE50", type: "FIXED", value: 50, minSpend: 500 },
    ],
  });

  const email = process.env.ADMIN_EMAIL || "admin@techrevive.ae";
  const pw = process.env.ADMIN_PASSWORD || "admin12345";
  await db.user.upsert({
    where: { email },
    update: { role: "ADMIN" },
    create: { email, name: "Store Admin", role: "ADMIN", password: await bcrypt.hash(pw, 10) },
  });

  console.log(`Seeded ${categories.length} categories, ${products.length} products. Admin: ${email}`);
}

main().finally(() => db.$disconnect());
