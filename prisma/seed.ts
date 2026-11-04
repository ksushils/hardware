import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const categories = [
  { slug: "graphics-cards", name: "Graphics Cards", nameAr: "كروت الشاشة", icon: "gpu", description: "Tested GPUs for gaming, rendering and AI workloads.", descriptionAr: "كروت شاشة مُختبرة للألعاب والتصميم والذكاء الاصطناعي." },
  { slug: "processors", name: "Processors", nameAr: "المعالجات", icon: "cpu", description: "Desktop CPUs from the latest and previous generations.", descriptionAr: "معالجات مكتبية من الأجيال الحديثة والسابقة." },
  { slug: "motherboards", name: "Motherboards", nameAr: "اللوحات الأم", icon: "motherboard", description: "Boards for every socket and form factor.", descriptionAr: "لوحات أم لجميع المقابس والأحجام." },
  { slug: "memory", name: "Memory (RAM)", nameAr: "الذاكرة (RAM)", icon: "ram", description: "DDR4 and DDR5 kits, tested with MemTest86.", descriptionAr: "ذاكرة DDR4 وDDR5 مُختبرة بـ MemTest86." },
  { slug: "storage", name: "SSDs & Storage", nameAr: "أقراص التخزين", icon: "storage", description: "NVMe and SATA SSDs, hard drives and health-checked storage.", descriptionAr: "أقراص NVMe وSATA وأقراص صلبة مع فحص الصحة." },
  { slug: "power-supplies", name: "Power Supplies", nameAr: "مزودات الطاقة", icon: "psu", description: "80+ certified PSUs, load tested.", descriptionAr: "مزودات طاقة معتمدة 80+ ومختبرة تحت الحمل." },
  { slug: "cases", name: "PC Cases", nameAr: "صناديق الكمبيوتر", icon: "case", description: "Towers from mini-ITX to full ATX.", descriptionAr: "صناديق من Mini-ITX إلى ATX الكامل." },
  { slug: "cooling", name: "Cooling", nameAr: "التبريد", icon: "cooling", description: "Air coolers, AIOs and case fans.", descriptionAr: "مبردات هوائية ومائية ومراوح." },
  { slug: "monitors", name: "Monitors", nameAr: "الشاشات", icon: "monitor", description: "Gaming and pro displays with dead-pixel checks.", descriptionAr: "شاشات ألعاب واحترافية مع فحص البكسلات." },
  { slug: "laptops", name: "Laptops", nameAr: "اللابتوبات", icon: "laptop", description: "Gaming and business laptops, battery health checked.", descriptionAr: "لابتوبات ألعاب وأعمال مع فحص البطارية." },
  { slug: "gaming-pcs", name: "Gaming PCs", nameAr: "أجهزة الألعاب", icon: "pc", description: "Ready-built desktops, stress tested for 24 hours.", descriptionAr: "أجهزة مكتبية جاهزة ومختبرة لمدة 24 ساعة." },
  { slug: "peripherals", name: "Peripherals", nameAr: "الملحقات", icon: "peripherals", description: "Keyboards, mice and headsets.", descriptionAr: "لوحات مفاتيح وفأرات وسماعات." },
  { slug: "networking", name: "Networking", nameAr: "الشبكات", icon: "networking", description: "Wi-Fi routers, mesh systems and switches.", descriptionAr: "راوترات واي فاي وأنظمة شبكات." },
];

// variants: [condition, price, stock] or with a second option: [condition, option2, price, stock]
type V3 = [string, number, number];
type V4 = [string, string, number, number];
type P = {
  name: string; brand: string; cat: string; type: string; priceNew: number; featured?: boolean; express?: boolean; tags?: string;
  specs: Record<string, string>; desc: string; descAr: string; opt2?: { name: string; nameAr: string }; v: (V3 | V4)[];
};
const N = "Brand New", E = "Excellent", VG = "Very Good", G = "Good";

const products: P[] = [
  { name: "GeForce RTX 4090 Founders Edition 24GB", brand: "NVIDIA", cat: "graphics-cards", type: "Graphics Card", priceNew: 8499, featured: true, express: true, tags: "4k,ai,flagship,nvidia",
    specs: { Memory: "24GB GDDR6X", "Boost Clock": "2.52 GHz", "CUDA Cores": "16384", TDP: "450W", Outputs: "3x DP 1.4a, 1x HDMI 2.1" },
    desc: "The flagship Ada Lovelace GPU for 4K gaming, content creation and local AI. Every unit passes a 2-hour stress test and a thermal paste check.",
    descAr: "كرت الشاشة الأقوى من جيل Ada Lovelace للألعاب بدقة 4K وصناعة المحتوى والذكاء الاصطناعي. كل قطعة تجتاز اختبار ضغط لمدة ساعتين وفحص المعجون الحراري.",
    v: [[E, 6799, 3], [VG, 6399, 2], [G, 5999, 1]] },
  { name: "GeForce RTX 4070 Super 12GB", brand: "NVIDIA", cat: "graphics-cards", type: "Graphics Card", priceNew: 2599, featured: true, express: true, tags: "1440p,dlss,nvidia",
    specs: { Memory: "12GB GDDR6X", "Boost Clock": "2.48 GHz", "CUDA Cores": "7168", TDP: "220W" },
    desc: "A great 1440p card with DLSS 3 frame generation, at a much lower power draw than the last generation.", descAr: "كرت مثالي لدقة 1440p مع تقنية DLSS 3 واستهلاك طاقة منخفض.",
    v: [[N, 2499, 6], [E, 2049, 5], [VG, 1899, 4], [G, 1749, 2]] },
  { name: "GeForce RTX 3080 10GB", brand: "NVIDIA", cat: "graphics-cards", type: "Graphics Card", priceNew: 2899, featured: true, tags: "1440p,4k,nvidia",
    specs: { Memory: "10GB GDDR6X", "CUDA Cores": "8704", TDP: "320W" },
    desc: "Still a strong 1440p and 4K performer. Ex-gaming units only, never used for mining.", descAr: "أداء قوي بدقة 1440p و4K. قطع استُخدمت للألعاب فقط ولم تُستخدم في التعدين.",
    v: [[E, 1499, 4], [VG, 1349, 6], [G, 1199, 3]] },
  { name: "Radeon RX 7900 XTX 24GB", brand: "AMD", cat: "graphics-cards", type: "Graphics Card", priceNew: 4199, tags: "4k,amd",
    specs: { Memory: "24GB GDDR6", "Stream Processors": "6144", TDP: "355W" },
    desc: "AMD's RDNA 3 flagship, with 24GB of VRAM for high-resolution gaming.", descAr: "الكرت الرائد من AMD بمعمارية RDNA 3 وذاكرة 24GB للألعاب عالية الدقة.",
    v: [[N, 3899, 3], [E, 3199, 2], [VG, 2999, 2]] },
  { name: "Radeon RX 6700 XT 12GB", brand: "AMD", cat: "graphics-cards", type: "Graphics Card", priceNew: 1599, tags: "1080p,budget,amd",
    specs: { Memory: "12GB GDDR6", TDP: "230W" }, desc: "The 1080p/1440p value champion.", descAr: "الخيار الأفضل قيمةً لدقة 1080p و1440p.",
    v: [[VG, 849, 7], [G, 749, 5]] },
  { name: "Core i9-14900K", brand: "Intel", cat: "processors", type: "CPU", priceNew: 2399, featured: true, express: true, tags: "lga1700,intel,unlocked",
    specs: { Cores: "24 (8P + 16E)", Threads: "32", "Max Turbo": "6.0 GHz", Socket: "LGA1700", TDP: "125W" },
    desc: "Intel's fastest desktop gaming CPU, unlocked for overclocking. Microcode is updated and the chip is stability tested.", descAr: "أسرع معالج ألعاب مكتبي من إنتل، قابل لكسر السرعة. تم تحديث المايكروكود واختبار الثبات.",
    v: [[N, 2249, 5], [E, 1799, 4], [VG, 1649, 2]] },
  { name: "Ryzen 7 7800X3D", brand: "AMD", cat: "processors", type: "CPU", priceNew: 1799, featured: true, express: true, tags: "am5,amd,gaming",
    specs: { Cores: "8", Threads: "16", "Boost Clock": "5.0 GHz", Socket: "AM5", Cache: "96MB L3 (3D V-Cache)" },
    desc: "The best gaming CPU per dirham, thanks to 3D V-Cache.", descAr: "أفضل معالج ألعاب مقابل السعر بفضل تقنية 3D V-Cache.",
    v: [[N, 1699, 8], [E, 1399, 5], [VG, 1299, 3]] },
  { name: "Ryzen 5 5600X", brand: "AMD", cat: "processors", type: "CPU", priceNew: 799, tags: "am4,amd,budget",
    specs: { Cores: "6", Threads: "12", "Boost Clock": "4.6 GHz", Socket: "AM4" }, desc: "A budget AM4 gaming CPU.", descAr: "معالج ألعاب اقتصادي لمنصة AM4.",
    v: [[E, 449, 10], [G, 379, 6]] },
  { name: "Core i5-12400F", brand: "Intel", cat: "processors", type: "CPU", priceNew: 699, tags: "lga1700,intel,budget",
    specs: { Cores: "6", Threads: "12", "Max Turbo": "4.4 GHz", Socket: "LGA1700" }, desc: "A popular budget gaming chip.", descAr: "معالج اقتصادي شهير للألعاب.",
    v: [[N, 549, 12], [VG, 399, 8]] },
  { name: "ROG Strix Z790-E Gaming WiFi", brand: "ASUS", cat: "motherboards", type: "Motherboard", priceNew: 1899, tags: "lga1700,ddr5,wifi",
    specs: { Socket: "LGA1700", Chipset: "Z790", Memory: "4x DDR5", "Form Factor": "ATX", WiFi: "Wi-Fi 6E" },
    desc: "A premium Z790 board with robust VRMs, PCIe 5.0 and Wi-Fi 6E. The BIOS is updated to the latest version.", descAr: "لوحة Z790 فاخرة مع PCIe 5.0 وواي فاي 6E. تم تحديث البيوس لآخر إصدار.",
    v: [[E, 1349, 3], [VG, 1199, 2]] },
  { name: "B650 Tomahawk WiFi", brand: "MSI", cat: "motherboards", type: "Motherboard", priceNew: 1049, featured: true, tags: "am5,ddr5,wifi",
    specs: { Socket: "AM5", Chipset: "B650", Memory: "4x DDR5", "Form Factor": "ATX" }, desc: "The sweet-spot AM5 board.", descAr: "اللوحة الأم المثالية لمنصة AM5.",
    v: [[N, 949, 6], [E, 799, 4], [G, 659, 2]] },
  { name: "B550 Aorus Elite AX V2", brand: "Gigabyte", cat: "motherboards", type: "Motherboard", priceNew: 699, tags: "am4,ddr4,wifi",
    specs: { Socket: "AM4", Chipset: "B550", Memory: "4x DDR4", "Form Factor": "ATX" }, desc: "A reliable AM4 board with Wi-Fi 6.", descAr: "لوحة AM4 موثوقة مع واي فاي 6.",
    v: [[VG, 429, 5], [G, 369, 3]] },
  { name: "Vengeance RGB DDR5-6000 Kit", brand: "Corsair", cat: "memory", type: "RAM", priceNew: 599, featured: true, express: true, tags: "ddr5,rgb",
    specs: { Type: "DDR5", Speed: "6000 MT/s", Latency: "CL36" }, opt2: { name: "Capacity", nameAr: "السعة" },
    desc: "Fast DDR5 with XMP 3.0 and EXPO support. Passes 4 MemTest86 passes.", descAr: "ذاكرة DDR5 سريعة تدعم XMP 3.0 وEXPO. تجتاز 4 دورات MemTest86.",
    v: [[N, "32GB (2x16GB)", 549, 15], [N, "64GB (2x32GB)", 999, 6], [E, "32GB (2x16GB)", 429, 10], [E, "64GB (2x32GB)", 799, 3]] },
  { name: "Fury Beast 16GB (2x8GB) DDR4-3200", brand: "Kingston", cat: "memory", type: "RAM", priceNew: 229, tags: "ddr4,budget",
    specs: { Capacity: "16GB (2x8GB)", Type: "DDR4", Speed: "3200 MT/s", Latency: "CL16" }, desc: "An affordable DDR4 kit for AM4 and LGA1700 builds.", descAr: "ذاكرة DDR4 اقتصادية لمنصات AM4 وLGA1700.",
    v: [[N, 199, 20], [VG, 139, 14]] },
  { name: "990 PRO NVMe M.2 SSD", brand: "Samsung", cat: "storage", type: "SSD", priceNew: 899, featured: true, express: true, tags: "nvme,pcie4,ssd",
    specs: { Interface: "PCIe 4.0 x4 NVMe", "Read Speed": "7450 MB/s", "Write Speed": "6900 MB/s" }, opt2: { name: "Capacity", nameAr: "السعة" },
    desc: "A top-tier PCIe 4.0 SSD. Used units ship with 95%+ health, verified with SMART.", descAr: "قرص SSD من الفئة الأعلى. القطع المستعملة بصحة 95%+ مُتحقق منها عبر SMART.",
    v: [[N, "1TB", 449, 10], [N, "2TB", 799, 12], [N, "4TB", 1499, 4], [E, "1TB", 329, 6], [E, "2TB", 599, 6]] },
  { name: "SN770 1TB NVMe SSD", brand: "WD", cat: "storage", type: "SSD", priceNew: 349, tags: "nvme,budget,ssd",
    specs: { Capacity: "1TB", Interface: "PCIe 4.0 x4 NVMe", "Read Speed": "5150 MB/s" }, desc: "A great-value NVMe boot drive.", descAr: "قرص إقلاع NVMe بقيمة ممتازة.",
    v: [[N, 299, 18], [E, 219, 9]] },
  { name: "IronWolf 8TB NAS HDD", brand: "Seagate", cat: "storage", type: "Hard Drive", priceNew: 999, tags: "nas,hdd",
    specs: { Capacity: "8TB", RPM: "7200", Cache: "256MB", Interface: "SATA 6Gb/s" }, desc: "A NAS-grade hard drive. Power-on hours are disclosed for every unit.", descAr: "قرص صلب مخصص لأنظمة NAS مع الإفصاح عن ساعات التشغيل.",
    v: [[VG, 549, 6], [G, 469, 4]] },
  { name: "RM850x 850W 80+ Gold", brand: "Corsair", cat: "power-supplies", type: "Power Supply", priceNew: 649, tags: "psu,gold,modular",
    specs: { Wattage: "850W", Efficiency: "80+ Gold", Modular: "Fully modular" }, desc: "A quiet, fully modular PSU, load tested at 100%.", descAr: "مزود طاقة هادئ ومعياري بالكامل، مختبر عند حمل 100%.",
    v: [[N, 579, 9], [E, 429, 5]] },
  { name: "Focus GX-750 750W 80+ Gold", brand: "Seasonic", cat: "power-supplies", type: "Power Supply", priceNew: 499, tags: "psu,gold",
    specs: { Wattage: "750W", Efficiency: "80+ Gold", Modular: "Fully modular" }, desc: "Seasonic reliability at a low price.", descAr: "موثوقية Seasonic بسعر منخفض.",
    v: [[VG, 299, 7]] },
  { name: "O11 Dynamic EVO", brand: "Lian Li", cat: "cases", type: "Case", priceNew: 699, tags: "case,atx,glass",
    specs: { "Form Factor": "Mid Tower", Motherboard: "E-ATX / ATX / mATX", Glass: "Dual tempered glass" }, opt2: { name: "Color", nameAr: "اللون" },
    desc: "The iconic dual-chamber showcase case.", descAr: "الصندوق الأيقوني ثنائي الحجرات.",
    v: [[N, "Black", 649, 5], [N, "White", 669, 3], [E, "Black", 479, 3]] },
  { name: "H5 Flow", brand: "NZXT", cat: "cases", type: "Case", priceNew: 399, tags: "case,airflow",
    specs: { "Form Factor": "Mid Tower", Motherboard: "ATX / mATX / ITX" }, desc: "A clean, high-airflow case.", descAr: "صندوق أنيق بتدفق هواء عالٍ.",
    v: [[VG, 249, 6], [G, 199, 4]] },
  { name: "Galahad II Trinity 360mm AIO", brand: "Lian Li", cat: "cooling", type: "Cooler", priceNew: 699, tags: "aio,liquid",
    specs: { Type: "AIO Liquid", Radiator: "360mm", Sockets: "LGA1700 / AM5 / AM4" }, desc: "A high-performance 360mm AIO that tames i9 and Ryzen 9 chips.", descAr: "مبرد مائي 360mm عالي الأداء لمعالجات i9 وRyzen 9.",
    v: [[N, 599, 4], [E, 449, 3]] },
  { name: "NH-D15 chromax.black", brand: "Noctua", cat: "cooling", type: "Cooler", priceNew: 499, express: true, tags: "air,quiet",
    specs: { Type: "Dual-tower air", Fans: "2x 140mm", Sockets: "LGA1700 / AM5 / AM4" }, desc: "A legendary air cooler. New mounting kit included.", descAr: "مبرد هوائي أسطوري مع طقم تثبيت جديد.",
    v: [[N, 449, 8], [VG, 319, 4]] },
  { name: "Odyssey G7 27\" 1440p 240Hz", brand: "Samsung", cat: "monitors", type: "Monitor", priceNew: 2199, featured: true, tags: "1440p,240hz,curved",
    specs: { Size: "27\"", Resolution: "2560x1440", "Refresh Rate": "240Hz", Panel: "VA, 1000R curve" }, desc: "A fast curved QHD gaming monitor. Zero dead pixels guaranteed.", descAr: "شاشة ألعاب منحنية سريعة بدقة QHD. مضمونة بدون بكسلات ميتة.",
    v: [[E, 1349, 3], [VG, 1199, 4], [G, 999, 2]] },
  { name: "UltraGear 27GP850 27\" 165Hz Nano IPS", brand: "LG", cat: "monitors", type: "Monitor", priceNew: 1599, tags: "1440p,ips",
    specs: { Size: "27\"", Resolution: "2560x1440", "Refresh Rate": "165Hz (180Hz OC)", Panel: "Nano IPS" }, desc: "A colour-accurate, fast IPS gaming monitor.", descAr: "شاشة ألعاب IPS سريعة بألوان دقيقة.",
    v: [[E, 999, 4], [G, 799, 3]] },
  { name: "UltraSharp U2723QE 27\" 4K", brand: "Dell", cat: "monitors", type: "Monitor", priceNew: 2499, tags: "4k,usb-c,office",
    specs: { Size: "27\"", Resolution: "3840x2160", Panel: "IPS Black", Ports: "USB-C 90W, RJ45" }, desc: "A professional 4K hub monitor for creators and offices.", descAr: "شاشة 4K احترافية للمصممين والمكاتب.",
    v: [[E, 1599, 3], [VG, 1449, 2]] },
  { name: "ROG Strix G16 (i9-13980HX, RTX 4070)", brand: "ASUS", cat: "laptops", type: "Laptop", priceNew: 7499, featured: true, tags: "gaming-laptop,rtx",
    specs: { CPU: "Core i9-13980HX", GPU: "RTX 4070 8GB", RAM: "16GB DDR5", Storage: "1TB SSD", Display: "16\" QHD+ 240Hz" }, desc: "A desktop-class gaming laptop. Battery health is 90% or higher.", descAr: "لابتوب ألعاب بأداء مكتبي. صحة البطارية 90% أو أعلى.",
    v: [[E, 4999, 2], [VG, 4599, 3]] },
  { name: "ThinkPad X1 Carbon Gen 11", brand: "Lenovo", cat: "laptops", type: "Laptop", priceNew: 6999, tags: "business,ultralight",
    specs: { CPU: "Core i7-1365U", RAM: "16GB", Storage: "512GB SSD", Display: "14\" WUXGA" }, desc: "A premium ultralight business laptop.", descAr: "لابتوب أعمال فاخر وخفيف الوزن.",
    v: [[E, 3799, 3], [G, 2999, 4]] },
  { name: "Legion 5 Pro (Ryzen 7, RTX 3070)", brand: "Lenovo", cat: "laptops", type: "Laptop", priceNew: 5999, tags: "gaming-laptop,rtx",
    specs: { CPU: "Ryzen 7 5800H", GPU: "RTX 3070 8GB", RAM: "16GB", Display: "16\" WQXGA 165Hz" }, desc: "Great 1440p laptop gaming at a fraction of the new price.", descAr: "ألعاب رائعة بدقة 1440p بجزء من سعر الجديد.",
    v: [[VG, 3199, 3], [G, 2799, 2]] },
  { name: "TechRevive Apex: Ryzen 7 7800X3D + RTX 4080 Super", brand: "TechRevive", cat: "gaming-pcs", type: "Gaming PC", priceNew: 10999, featured: true, express: true, tags: "prebuilt,4k",
    specs: { CPU: "Ryzen 7 7800X3D", GPU: "RTX 4080 Super 16GB", RAM: "32GB DDR5-6000", Storage: "2TB NVMe", PSU: "850W Gold" },
    desc: "A 4K high-refresh gaming desktop, built in Dubai and burned in for 24 hours with a 2-year warranty.", descAr: "جهاز ألعاب لدقة 4K مُجمّع في دبي ومختبر 24 ساعة مع ضمان سنتين.",
    v: [[N, 9499, 3], [E, 7999, 2]] },
  { name: "TechRevive Core: i5-12400F + RTX 3060 Ti", brand: "TechRevive", cat: "gaming-pcs", type: "Gaming PC", priceNew: 4499, tags: "prebuilt,1080p",
    specs: { CPU: "Core i5-12400F", GPU: "RTX 3060 Ti 8GB", RAM: "16GB DDR4", Storage: "1TB NVMe" }, desc: "A 1080p high-refresh starter rig built with certified renewed parts.", descAr: "جهاز ألعاب مبتدئ لدقة 1080p بقطع مُجددة معتمدة.",
    v: [[E, 2799, 4], [VG, 2599, 3]] },
  { name: "G Pro X Superlight 2 Wireless Mouse", brand: "Logitech", cat: "peripherals", type: "Mouse", priceNew: 649, express: true, tags: "mouse,wireless,esports",
    specs: { Weight: "60g", Sensor: "HERO 2", Connectivity: "LIGHTSPEED wireless" }, opt2: { name: "Color", nameAr: "اللون" },
    desc: "An esports-grade ultralight mouse.", descAr: "فأرة خفيفة جدًا بمستوى الرياضات الإلكترونية.",
    v: [[N, "Black", 579, 10], [N, "White", 579, 6], [E, "Black", 429, 5]] },
  { name: "BlackWidow V4 Pro Mechanical Keyboard", brand: "Razer", cat: "peripherals", type: "Keyboard", priceNew: 999, tags: "keyboard,mechanical,arabic",
    specs: { Switches: "Razer Green", Layout: "Full-size, EN/AR", Backlight: "Chroma RGB" }, desc: "A premium mechanical keyboard with an Arabic layout option.", descAr: "لوحة مفاتيح ميكانيكية فاخرة مع خيار التخطيط العربي.",
    v: [[E, 599, 4], [G, 449, 2]] },
  { name: "Arctis Nova Pro Wireless Headset", brand: "SteelSeries", cat: "peripherals", type: "Headset", priceNew: 1499, tags: "headset,anc,wireless",
    specs: { Connectivity: "2.4GHz + Bluetooth", ANC: "Yes", Battery: "Hot-swappable" }, desc: "A flagship gaming headset with ANC. New ear cushions fitted.", descAr: "سماعة ألعاب رائدة بعزل الضوضاء مع وسائد أذن جديدة.",
    v: [[E, 899, 3], [VG, 799, 2]] },
  { name: "Archer AX73 Wi-Fi 6 Router", brand: "TP-Link", cat: "networking", type: "Router", priceNew: 499, tags: "wifi6,router",
    specs: { Standard: "Wi-Fi 6 AX5400", Ports: "4x Gigabit LAN", Coverage: "Large apartment" }, desc: "A fast, reliable Wi-Fi 6 router, compatible with etisalat and du fibre.", descAr: "راوتر واي فاي 6 سريع وموثوق، متوافق مع ألياف اتصالات ودو.",
    v: [[N, 429, 8], [E, 279, 6]] },
  { name: "Deco XE75 Mesh (3-Pack)", brand: "TP-Link", cat: "networking", type: "Mesh Wi-Fi", priceNew: 1499, tags: "wifi6e,mesh,villa",
    specs: { Standard: "Wi-Fi 6E AXE5400", Units: "3", Coverage: "Up to 650 m²" }, desc: "Whole-villa Wi-Fi 6E coverage.", descAr: "تغطية واي فاي 6E لكامل الفيلا.",
    v: [[E, 899, 3]] },
];

function slugify(s: string) {
  return s.toLowerCase().replace(/["']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const pages = [
  { handle: "about", title: "About TechRevive", titleAr: "عن تك ريفايف",
    body: `TechRevive is a UAE marketplace for **certified renewed and new PC hardware**. We believe high-performance computing should be affordable, and that good hardware deserves a second life instead of a landfill.

## How we test
Every renewed part goes through our Dubai test lab before it's listed:
- Stress and thermal testing for GPUs and CPUs
- Benchmarks against reference scores
- SMART health checks for drives and MemTest86 for memory
- Dead-pixel and backlight checks for displays

## Our grading
- **Excellent:** like new, with no visible signs of use
- **Very Good:** light marks that are invisible once installed
- **Good:** visible cosmetic wear, 100% functional, the best value

## For businesses
Equipping an office, school or render farm? We offer volume pricing, VAT invoices and asset tagging. Email business@techrevive.ae.`,
    bodyAr: `تك ريفايف هو متجر إماراتي لـ **قطع الكمبيوتر المُجددة المعتمدة والجديدة**. نؤمن أن الحوسبة عالية الأداء يجب أن تكون في متناول الجميع، وأن الأجهزة الجيدة تستحق حياة ثانية بدلاً من مكب النفايات.

## كيف نختبر
تمر كل قطعة مُجددة عبر مختبرنا في دبي قبل عرضها:
- اختبارات الضغط والحرارة لكروت الشاشة والمعالجات
- اختبارات أداء مقارنة بالنتائج المرجعية
- فحص صحة الأقراص عبر SMART وفحص الذاكرة عبر MemTest86
- فحص البكسلات والإضاءة للشاشات

## تصنيفاتنا
- **ممتاز:** كالجديد بدون أي آثار استخدام
- **جيد جدًا:** خدوش خفيفة غير مرئية بعد التركيب
- **جيد:** آثار استخدام ظاهرة مع أداء كامل 100% — أفضل قيمة

## للشركات
هل تجهّز مكتبًا أو مدرسة؟ نوفر أسعار الجملة وفواتير ضريبية. راسلنا على business@techrevive.ae.` },
  { handle: "sell", title: "Sell or trade in your hardware", titleAr: "بِع أو استبدل قطعك",
    body: `Upgrading? We buy GPUs, CPUs, laptops, monitors and full gaming PCs from across the UAE.

1. Email sell@techrevive.ae with the model, condition, photos and accessories.
2. We send you a guaranteed quote within 24 hours.
3. A courier collects the item for free. We test it and pay you within 2 business days, or give you store credit worth 10% more.`,
    bodyAr: `تريد الترقية؟ نشتري كروت الشاشة والمعالجات واللابتوبات والشاشات وأجهزة الألعاب من جميع أنحاء الإمارات.

1. أرسل إلى sell@techrevive.ae الموديل والحالة والصور والملحقات.
2. نرسل لك عرض سعر مضمون خلال 24 ساعة.
3. نستلم القطعة مجانًا ونختبرها وندفع لك خلال يومي عمل، أو رصيد شراء بقيمة أعلى 10%.` },
  { handle: "terms", title: "Terms & Conditions", titleAr: "الشروط والأحكام",
    body: `*Template text. Have it reviewed by a UAE legal advisor before you launch.*

## Orders & pricing
All prices are in UAE Dirhams (AED) and include 5% VAT. We may cancel orders affected by pricing errors or stock unavailability, with a full refund.

## Payments
Card payments are processed by a PCI-DSS compliant payment provider. We never store your full card details.

## Warranty
Renewed products carry a 12-month warranty against functional defects. It does not cover physical damage, liquid damage or unauthorised modification.

## Returns
You may return products within 14 days of delivery in their original condition. Refunds go to the original payment method within 5–10 business days.

## Governing law
These terms are governed by the laws of the United Arab Emirates and the Emirate of Dubai.`,
    bodyAr: `*نص نموذجي — يجب مراجعته من مستشار قانوني في الإمارات قبل الإطلاق.*

## الطلبات والأسعار
جميع الأسعار بالدرهم الإماراتي وتشمل ضريبة القيمة المضافة 5%. يحق لنا إلغاء الطلبات المتأثرة بأخطاء التسعير أو نفاد المخزون مع استرداد كامل.

## الدفع
تتم معالجة المدفوعات عبر مزود دفع متوافق مع PCI-DSS، ولا نحتفظ ببيانات بطاقتك.

## الضمان
تشمل المنتجات المُجددة ضمانًا لمدة 12 شهرًا ضد الأعطال الوظيفية، ولا يشمل الأضرار المادية أو السوائل.

## الإرجاع
يمكنك إرجاع المنتجات خلال 14 يومًا من الاستلام بحالتها الأصلية.

## القانون الحاكم
تخضع هذه الشروط لقوانين دولة الإمارات العربية المتحدة وإمارة دبي.` },
  { handle: "privacy", title: "Privacy Policy", titleAr: "سياسة الخصوصية",
    body: `*Template text. Align it with the UAE Personal Data Protection Law (PDPL) before you launch.*

We collect the information needed to process your orders: your name, email, phone, delivery address and order history. Payment details are handled by our payment provider and never stored on our servers.

We use essential cookies to keep you signed in, remember your cart and your language. We don't sell your personal data.

To request access to or deletion of your data, email privacy@techrevive.ae.`,
    bodyAr: `*نص نموذجي — يجب مواءمته مع قانون حماية البيانات الشخصية في الإمارات قبل الإطلاق.*

نجمع المعلومات اللازمة لمعالجة طلباتك: الاسم والبريد الإلكتروني والهاتف وعنوان التوصيل وسجل الطلبات. تتم معالجة بيانات الدفع عبر مزود الدفع ولا تُخزن على خوادمنا.

نستخدم ملفات تعريف الارتباط الأساسية لإبقائك مسجلاً وتذكر سلتك ولغتك. لا نبيع بياناتك.

لطلب الوصول إلى بياناتك أو حذفها راسلنا على privacy@techrevive.ae.` },
  { handle: "warranty", title: "Warranty & Returns", titleAr: "الضمان والإرجاع",
    body: `## 12-month warranty
Every renewed product includes a 12-month TechRevive warranty. New products carry the manufacturer warranty. Add **TechRevive Care+** at checkout to extend coverage to 24 months, with express replacement.

## 14-day returns
Changed your mind? Return any item within 14 days of delivery for a full refund. Start a return from **My account → Orders**.

## How to claim
Open your order in My account and choose "Request a return", or email support@techrevive.ae with your order number.`,
    bodyAr: `## ضمان 12 شهرًا
تشمل كل المنتجات المُجددة ضمان تك ريفايف لمدة 12 شهرًا، والمنتجات الجديدة تحمل ضمان الشركة المصنعة. أضف **تك ريفايف كير+** لتمديد الضمان إلى 24 شهرًا مع استبدال سريع.

## إرجاع خلال 14 يومًا
غيرت رأيك؟ أرجع أي منتج خلال 14 يومًا من التوصيل لاسترداد كامل المبلغ من **حسابي ← الطلبات**.

## كيفية المطالبة
افتح طلبك في حسابي واختر "طلب إرجاع"، أو راسلنا على support@techrevive.ae.` },
];

const articles = [
  { handle: "renewed-vs-used-gpu-uae", title: "Renewed vs used GPUs in the UAE: what's the difference?", titleAr: "كروت الشاشة المُجددة مقابل المستعملة في الإمارات: ما الفرق؟",
    excerpt: "Marketplace listings are cheap, but they're a gamble. Here's how certified renewed graphics cards protect you, and when they're worth it.",
    excerptAr: "إعلانات السوق المفتوح رخيصة لكنها مخاطرة. إليك كيف تحميك كروت الشاشة المُجددة المعتمدة ومتى تستحق الشراء.",
    body: `Buying a used graphics card from a classifieds site can save money, but there's no warranty, no testing and a real risk of ex-mining cards.

## What "renewed" means
A renewed GPU is inspected, cleaned, re-pasted where needed and stress tested for at least two hours. It's then graded **Excellent**, **Very Good** or **Good**, and covered by a 12-month warranty.

## How to spot an ex-mining card
- Yellowed or discoloured thermal pads
- Fans with heavy wear but a clean shroud
- Modified BIOS or memory clocks

## Our recommendation
For 1440p gaming in 2026, a renewed **RTX 4070 Super** or **RX 7900 XTX** offers the best value per dirham.`,
    bodyAr: `شراء كرت شاشة مستعمل من مواقع الإعلانات قد يوفر المال، لكن بدون ضمان أو اختبار ومع خطر حقيقي لكروت التعدين.

## ماذا تعني "مُجدد"؟
يتم فحص الكرت المُجدد وتنظيفه وتجديد المعجون الحراري عند الحاجة واختباره تحت الضغط لساعتين على الأقل، ثم تصنيفه **ممتاز** أو **جيد جدًا** أو **جيد** مع ضمان 12 شهرًا.

## كيف تكتشف كرت التعدين
- وسائد حرارية مصفرّة
- مراوح متآكلة بغلاف نظيف
- بيوس معدّل

## توصيتنا
لألعاب 1440p في 2026، يقدم **RTX 4070 Super** أو **RX 7900 XTX** المُجدد أفضل قيمة.` },
  { handle: "best-gaming-pc-build-under-5000-aed", title: "The best gaming PC build under AED 5,000 (2026)", titleAr: "أفضل تجميعة جهاز ألعاب بأقل من 5,000 درهم (2026)",
    excerpt: "A balanced 1440p build using certified renewed parts, with exact prices from our store.",
    excerptAr: "تجميعة متوازنة لدقة 1440p بقطع مُجددة معتمدة وبأسعار دقيقة من متجرنا.",
    body: `Want high-refresh 1440p gaming without spending AED 10,000? This build uses renewed parts where it matters, and new parts where it counts.

## The parts list
- **CPU:** Ryzen 7 7800X3D (Excellent): AED 1,399
- **GPU:** RTX 4070 Super (Very Good): AED 1,899
- **Motherboard:** B650 Tomahawk WiFi (Good): AED 659
- **RAM:** Corsair DDR5-6000 32GB (Excellent): AED 429
- **SSD:** WD SN770 1TB (New): AED 299

That's about **AED 4,685**, with room left for a case and PSU from our renewed range.

## Why it works
The 7800X3D's 3D V-Cache makes it the fastest gaming CPU at this price, and the 4070 Super handles every modern title at 1440p with DLSS.`,
    bodyAr: `تريد ألعابًا بدقة 1440p ومعدل تحديث عالٍ دون إنفاق 10,000 درهم؟ تستخدم هذه التجميعة قطعًا مُجددة حيث يهم ذلك.

## قائمة القطع
- **المعالج:** Ryzen 7 7800X3D (ممتاز) — 1,399 درهم
- **كرت الشاشة:** RTX 4070 Super (جيد جدًا) — 1,899 درهم
- **اللوحة الأم:** B650 Tomahawk WiFi (جيد) — 659 درهم
- **الذاكرة:** Corsair DDR5-6000 32GB (ممتاز) — 429 درهم
- **SSD:** WD SN770 1TB (جديد) — 299 درهم

المجموع حوالي **4,685 درهم** مع مساحة لصندوق ومزود طاقة.

## لماذا تعمل
يجعل 3D V-Cache المعالج 7800X3D الأسرع في الألعاب بهذا السعر، ويتعامل 4070 Super مع كل الألعاب الحديثة بدقة 1440p.` },
  { handle: "how-we-grade-hardware", title: "How we grade hardware: Excellent, Very Good and Good explained", titleAr: "كيف نصنّف القطع: شرح ممتاز وجيد جدًا وجيد",
    excerpt: "Our three cosmetic grades, what each one looks like, and why every grade performs the same.",
    excerptAr: "تصنيفاتنا الثلاثة وشكل كل منها، ولماذا تقدم جميعها نفس الأداء.",
    body: `All grades are **100% functional** and pass the same tests. The grade only describes cosmetic condition.

## Excellent
No visible signs of use. Often open-box or barely used.

## Very Good
Light scratches or marks that are invisible once installed in a case.

## Good
Visible wear such as scuffs or small dents. The best price, with the same performance and the same 12-month warranty.`,
    bodyAr: `جميع التصنيفات **تعمل بنسبة 100%** وتجتاز نفس الاختبارات. يصف التصنيف الحالة الشكلية فقط.

## ممتاز
لا توجد آثار استخدام ظاهرة. غالبًا علبة مفتوحة أو استخدام بسيط جدًا.

## جيد جدًا
خدوش خفيفة غير مرئية بعد التركيب داخل الصندوق.

## جيد
آثار استخدام ظاهرة. أفضل سعر مع نفس الأداء ونفس ضمان 12 شهرًا.` },
];

async function main() {
  // wipe (dev only)
  // The ledger is append-only (DB triggers). The DEMO seed may clear it; this must never run against production data.
  const { dropLedgerTriggers, applyLedgerTriggers } = await import("../scripts/apply-ledger-triggers");
  await dropLedgerTriggers(db);
  const tables = ["ledgerLine", "ledgerTransaction", "caseMessage", "supportCase", "privateFile", "tradeIn", "sellerTransaction", "payout", "sellerReview", "sellerMessage", "productQuestion", "commissionRule", "orderEvent", "refund", "returnRequest", "orderItem", "sellerOrder", "order", "review", "wishlistItem", "stockAlert", "inventoryAdjustment", "collectionProduct", "collection",
    "variant", "productOption", "productImage", "product", "seller", "category", "discount", "giftCard", "checkout", "page", "article", "shippingRate", "activityLog", "emailLog", "subscriber", "redirect", "setting"] as const;
  for (const t of tables) await (db[t] as unknown as { deleteMany: () => Promise<unknown> }).deleteMany();

  const catMap: Record<string, { id: string; icon: string }> = {};
  for (const [i, c] of categories.entries()) {
    const row = await db.category.create({ data: { ...c, sortOrder: i } });
    catMap[c.slug] = { id: row.id, icon: c.icon };
  }

  const productIds: Record<string, string> = {};
  for (const p of products) {
    const slug = slugify(`${p.brand} ${p.name}`);
    const image = `/img/${catMap[p.cat].icon}.svg`;
    const conds = [...new Set(p.v.map((x) => x[0]))];
    const opt2Vals = p.opt2 ? [...new Set(p.v.map((x) => (x as V4)[1]))] : [];
    const created = await db.product.create({
      data: {
        slug, name: p.name, brand: p.brand, productType: p.type, description: p.desc, descriptionAr: p.descAr, specs: JSON.stringify(p.specs),
        image, categoryId: catMap[p.cat].id, priceNew: p.priceNew, featured: !!p.featured, express: !!p.express, tags: p.tags ?? "",
        seoTitle: `${p.brand} ${p.name}: Renewed & New | Buy in UAE`, seoDescription: p.desc.slice(0, 155),
        images: { create: [{ url: image, alt: `${p.brand} ${p.name}`, position: 0 }] },
        options: {
          create: [
            { name: "Condition", nameAr: "الحالة", position: 0, values: JSON.stringify(conds) },
            ...(p.opt2 ? [{ name: p.opt2.name, nameAr: p.opt2.nameAr, position: 1, values: JSON.stringify(opt2Vals) }] : []),
          ],
        },
        variants: {
          create: p.v.map((x, i) => {
            const [cond, o2, price, stock] = x.length === 4 ? x : [x[0], null, x[1], x[2]];
            return {
              title: o2 ? `${cond} / ${o2}` : cond, option1: cond, option2: o2, price, stock, position: i,
              comparePrice: cond === N ? (p.priceNew > price ? p.priceNew : null) : Math.round(price * 1.12),
              cost: Math.round(price * 0.72), weight: 1,
              sku: `TR-${String(products.indexOf(p) + 1).padStart(3, "0")}-${cond.replace(/\s/g, "")}${o2 ? "-" + o2.replace(/[^A-Za-z0-9]/g, "") : ""}`.toUpperCase(),
            };
          }),
        },
      },
    });
    productIds[slug] = created.id;
  }

  // Collections
  await db.collection.create({ data: { handle: "hot-deals", title: "Hot Deals", titleAr: "عروض ساخنة", description: "40% or more off the new price.", descriptionAr: "خصم 40% أو أكثر مقارنة بسعر الجديد.", type: "SMART", rules: JSON.stringify([{ field: "compareDiscount", op: "gt", value: "40" }]), sortOrder: "PRICE_ASC", showOnHome: true } });
  await db.collection.create({ data: { handle: "under-500", title: "Under AED 500", titleAr: "أقل من 500 درهم", description: "Upgrades that don't break the bank.", descriptionAr: "ترقيات بأسعار مناسبة.", type: "SMART", rules: JSON.stringify([{ field: "price", op: "lt", value: "500" }]), sortOrder: "PRICE_ASC", showOnHome: true } });
  await db.collection.create({ data: { handle: "team-red", title: "Team Red: AMD", titleAr: "فريق AMD", description: "Ryzen CPUs and Radeon GPUs.", descriptionAr: "معالجات رايزن وكروت راديون.", type: "SMART", rules: JSON.stringify([{ field: "vendor", op: "eq", value: "AMD" }]), sortOrder: "BEST" } });
  const streaming = await db.collection.create({ data: { handle: "streaming-setup", title: "Streaming Setup", titleAr: "تجهيزات البث", description: "Everything you need to go live.", descriptionAr: "كل ما تحتاجه لبدء البث المباشر.", type: "MANUAL", sortOrder: "MANUAL", showOnHome: true } });
  const streamSlugs = Object.keys(productIds).filter((s) => /odyssey|arctis|superlight|blackwidow|4070/.test(s));
  await db.collectionProduct.createMany({ data: streamSlugs.map((s, i) => ({ collectionId: streaming.id, productId: productIds[s], position: i })) });

  await db.discount.createMany({
    data: [
      { title: "Welcome 10%", code: "WELCOME10", method: "CODE", type: "PERCENT", value: 10, minType: "AMOUNT", minValue: 200, oncePerCustomer: true },
      { title: "AED 50 off over 500", code: "UAE50", method: "CODE", type: "FIXED", value: 50, minType: "AMOUNT", minValue: 500 },
      { title: "AED 75 off builds", code: "BUILD75", method: "CODE", type: "FIXED", value: 75, minType: "AMOUNT", minValue: 1000 },
      { title: "Free delivery", code: "FREESHIP", method: "CODE", type: "FREE_SHIPPING", value: 0 },
      { title: "5% off orders over AED 5,000", code: null, method: "AUTOMATIC", type: "PERCENT", value: 5, minType: "AMOUNT", minValue: 5000 },
    ],
  });
  await db.giftCard.create({ data: { code: "GIFT-DEMO-0100", initialValue: 100, balance: 100, note: "Demo gift card" } });

  await db.shippingRate.createMany({
    data: [
      { name: "Standard delivery", nameAr: "توصيل عادي", price: 15, freeAbove: 200, deliveryDays: "2-4", position: 0 },
      { name: "Express next-day", nameAr: "توصيل سريع في اليوم التالي", price: 25, expressOnly: true, deliveryDays: "1", position: 1 },
      { name: "Same-day (Dubai)", nameAr: "توصيل في نفس اليوم (دبي)", emirates: "Dubai", price: 35, expressOnly: true, deliveryDays: "0", position: 2 },
    ],
  });

  for (const p of pages) await db.page.create({ data: { ...p, seoDescription: p.body.replace(/[#*_]/g, "").slice(0, 155) } });
  for (const [i, a] of articles.entries())
    await db.article.create({ data: { ...a, image: ["/img/gpu.svg", "/img/pc.svg", "/img/cpu.svg"][i], tags: "guides", publishedAt: new Date(Date.now() - i * 86400000 * 5) } });

  const email = process.env.ADMIN_EMAIL || "admin@techrevive.ae";
  const pw = process.env.ADMIN_PASSWORD || "admin12345";
  await db.user.upsert({ where: { email }, update: { role: "ADMIN" }, create: { email, name: "Store Owner", role: "ADMIN", password: await bcrypt.hash(pw, 10) } });
  await db.user.upsert({
    where: { email: "staff@techrevive.ae" }, update: {},
    create: { email: "staff@techrevive.ae", name: "Warehouse Staff", role: "STAFF", permissions: "orders,products", password: await bcrypt.hash("staff12345", 10) },
  });

  // ───── Marketplace demo data ─────
  const sellerPw = await bcrypt.hash("seller12345", 10);
  const mkUser = (email: string, name: string) => db.user.upsert({ where: { email }, update: {}, create: { email, name, password: sellerPw } });
  const [u1, u2, u3] = await Promise.all([mkUser("seller1@example.com", "Omar Haddad"), mkUser("seller2@example.com", "Priya Nair"), mkUser("applicant@example.com", "Khalid Rahman")]);
  const licence = new Date(Date.now() + 300 * 86400000);
  const s1 = await db.seller.create({ data: {
    userId: u1.id, shopName: "GPU Souq", slug: "gpu-souq", status: "APPROVED", approvedAt: new Date(), email: "sales@gpusouq.ae", phone: "0501112233", emirate: "Dubai",
    address: "Al Ain Centre, Bur Dubai", trn: "100123456700003", tradeLicenseNo: "DED-889201", tradeLicenseExpiry: licence,
    about: "Dubai's graphics card specialists since 2016. Every card is benchmarked and re-pasted before shipping.",
    aboutAr: "متخصصون في كروت الشاشة في دبي منذ 2016. كل كرت يتم اختباره وتجديد معجونه الحراري قبل الشحن.",
    returnPolicy: "14-day returns on all items. Warranty: 6 months on renewed cards.", shippingPolicy: "Ships from Bur Dubai within 1 business day via Aramex.",
    bankName: "Emirates NBD", accountName: "GPU Souq Trading LLC", iban: "AE070331234567890123456", ratingAvg: 4.8, ratingCount: 2,
  } });
  const s2 = await db.seller.create({ data: {
    userId: u2.id, shopName: "Sharjah PC Hub", slug: "sharjah-pc-hub", status: "APPROVED", approvedAt: new Date(), email: "hello@sharjahpchub.ae", phone: "0562223344", emirate: "Sharjah",
    address: "Industrial Area 4, Sharjah", tradeLicenseNo: "SHJ-55120", tradeLicenseExpiry: licence,
    about: "Business laptops and office monitors, refurbished in-house with a 6-month warranty.", aboutAr: "لابتوبات أعمال وشاشات مكتبية مُجددة داخليًا مع ضمان 6 أشهر.",
    returnPolicy: "14-day returns. 6-month warranty.", shippingPolicy: "Dispatch within 2 business days. Free pickup in Sharjah.",
    bankName: "ADCB", accountName: "Sharjah PC Hub", iban: "AE460030000123456789012",
  } });
  await db.seller.create({ data: {
    userId: u3.id, shopName: "Abu Dhabi Gaming Gear", slug: "ad-gaming-gear", status: "PENDING", email: "khalid@adgear.ae", phone: "0503334455", emirate: "Abu Dhabi",
    address: "Mussafah M-10", tradeLicenseNo: "ADED-77231", tradeLicenseExpiry: licence, about: "Gaming peripherals and accessories.",
  } });
  const cat = async (slug: string) => (await db.category.findUniqueOrThrow({ where: { slug } })).id;
  type SP = { seller: string; name: string; brand: string; cat: string; icon: string; type: string; priceNew: number; desc: string; descAr: string; specs: Record<string, string>; v: [string, number, number][]; status?: string };
  const sellerProducts: SP[] = [
    { seller: s1.id, name: "GeForce RTX 3070 Ti 8GB", brand: "NVIDIA", cat: "graphics-cards", icon: "gpu", type: "Graphics Card", priceNew: 2299, desc: "Tested 3070 Ti, ex-gaming, re-pasted with new thermal pads.", descAr: "كرت 3070 Ti مُختبر، استخدام ألعاب، مع معجون ووسائد حرارية جديدة.", specs: { Memory: "8GB GDDR6X", TDP: "290W" }, v: [["Excellent", 1149, 3], ["Good", 999, 2]] },
    { seller: s1.id, name: "Radeon RX 6800 16GB", brand: "AMD", cat: "graphics-cards", icon: "gpu", type: "Graphics Card", priceNew: 2199, desc: "16GB VRAM for 1440p, fully benchmarked.", descAr: "ذاكرة 16GB لدقة 1440p ومختبر بالكامل.", specs: { Memory: "16GB GDDR6", TDP: "250W" }, v: [["Very Good", 1099, 2]] },
    { seller: s1.id, name: "GeForce RTX 2060 Super 8GB", brand: "NVIDIA", cat: "graphics-cards", icon: "gpu", type: "Graphics Card", priceNew: 1499, desc: "Budget 1080p card awaiting approval.", descAr: "كرت اقتصادي لدقة 1080p.", specs: { Memory: "8GB GDDR6" }, v: [["Good", 549, 4]], status: "PENDING" },
    { seller: s2.id, name: "Latitude 7420 (i7, 16GB, 512GB)", brand: "Dell", cat: "laptops", icon: "laptop", type: "Laptop", priceNew: 5499, desc: "Business ultrabook, battery health above 85%.", descAr: "لابتوب أعمال، صحة البطارية أعلى من 85%.", specs: { CPU: "Core i7-1185G7", RAM: "16GB", Storage: "512GB SSD", Display: "14\" FHD" }, v: [["Excellent", 2399, 4], ["Good", 1999, 3]] },
    { seller: s2.id, name: "P2422H 24\" IPS Monitor", brand: "Dell", cat: "monitors", icon: "monitor", type: "Monitor", priceNew: 899, desc: "Office monitor with height-adjustable stand.", descAr: "شاشة مكتبية مع قاعدة قابلة لتعديل الارتفاع.", specs: { Size: "24\"", Resolution: "1920x1080", Panel: "IPS" }, v: [["Very Good", 399, 8]] },
  ];
  for (const [i, sp] of sellerProducts.entries()) {
    const slug = `${sp.brand} ${sp.name}`.toLowerCase().replace(/["']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const image = `/img/${sp.icon}.svg`;
    await db.product.create({ data: {
      slug, name: sp.name, brand: sp.brand, productType: sp.type, description: sp.desc, descriptionAr: sp.descAr, specs: JSON.stringify(sp.specs), image,
      categoryId: await cat(sp.cat), priceNew: sp.priceNew, sellerId: sp.seller, approvalStatus: sp.status ?? "APPROVED",
      images: { create: [{ url: image, alt: sp.name }] },
      options: { create: [{ name: "Condition", nameAr: "الحالة", values: JSON.stringify(sp.v.map((x) => x[0])) }] },
      variants: { create: sp.v.map(([c, price, stock], j) => ({ title: c, option1: c, price, stock, position: j, sku: `MP-${String(i + 1).padStart(3, "0")}-${c.replace(/\s/g, "").toUpperCase()}` })) },
    } });
  }
  await db.commissionRule.createMany({ data: [
    { scope: "GLOBAL", type: "PERCENT", percent: 10 },
    { scope: "CATEGORY", categoryId: await cat("graphics-cards"), type: "PERCENT", percent: 7 },
  ] });
  // two published reviews for GPU Souq so the shop page has social proof
  const reviewer = await db.user.upsert({ where: { email: "buyer@example.com" }, update: {}, create: { email: "buyer@example.com", name: "Sara M.", password: sellerPw } });
  await db.sellerReview.create({ data: { sellerId: s1.id, userId: reviewer.id, rating: 5, comment: "Card arrived next day, exactly as described. Temps are great." } });
  await db.sellerReview.create({ data: { sellerId: s1.id, userId: u2.id, rating: 5, comment: "Fair prices and quick replies on WhatsApp." } });
  await db.productQuestion.create({ data: { productId: (await db.product.findUniqueOrThrow({ where: { slug: "nvidia-geforce-rtx-4070-super-12gb" } })).id, name: "Ahmed", email: "ahmed@example.com", question: "Will this fit in a mini-ITX case?", answer: "It's a 2.5-slot, 267mm card — it fits most ITX cases that support 270mm+ GPUs.", answeredAt: new Date(), published: true } });

  await applyLedgerTriggers(db);
  console.log(`Seeded ${categories.length} categories, ${products.length} products, 4 collections, ${pages.length} pages, ${articles.length} articles. Admin: ${email}`);
}

main().finally(() => db.$disconnect());
