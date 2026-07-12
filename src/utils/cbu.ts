// Validación real de CBU/CVU argentino: checksum oficial (módulo 10, BCRA)
// más identificación de entidad por código, igual al mecanismo que usa
// Mercado Pago cuando validás tu propia clave bancaria.

// Tabla de códigos de entidad más comunes. No es exhaustiva: los códigos
// no listados igual se validan (checksum), solo no se les asigna nombre.
const ENTIDADES: Record<string, string> = {
  "007": "Banco Galicia",
  "011": "Banco de la Nación Argentina",
  "014": "Banco de la Provincia de Buenos Aires",
  "015": "ICBC Argentina",
  "017": "BBVA Argentina",
  "020": "Banco de la Provincia de Córdoba",
  "027": "Banco Supervielle",
  "029": "Banco de la Ciudad de Buenos Aires",
  "034": "Banco Patagonia",
  "044": "Banco Hipotecario",
  "045": "Banco de San Juan",
  "060": "Banco de Tucumán",
  "065": "Banco Municipal de Rosario",
  "072": "Banco Santander Argentina",
  "083": "Banco del Chubut",
  "086": "Banco de Santa Cruz",
  "093": "Banco de La Pampa",
  "094": "Banco de Corrientes",
  "097": "Banco Provincia del Neuquén",
  "143": "Brubank",
  "147": "Banco Interfinanzas",
  "150": "HSBC Bank Argentina",
  "165": "JP Morgan Chase Bank",
  "191": "Banco Credicoop",
  "198": "Banco de Valores",
  "247": "Banco Roela",
  "254": "Banco Mariva",
  "259": "Banco Itaú Argentina",
  "266": "BNP Paribas",
  "268": "Banco Provincia de Tierra del Fuego",
  "269": "Banco de la República Oriental del Uruguay",
  "277": "Banco Saenz",
  "281": "Banco Meridian",
  "285": "Banco Macro",
  "299": "Banco Comafi",
  "300": "Banco de Inversión y Comercio Exterior (BICE)",
  "301": "Banco Piano",
  "305": "Banco de Formosa",
  "309": "Banco CMF",
  "310": "Banco de Santiago del Estero",
  "311": "Banco Industrial",
  "315": "Banco del Sol",
  "321": "Banco Empresario de Tucumán",
  "322": "Banco Julio",
  "330": "Nuevo Banco de Santa Fe",
  "331": "Banco Cetelem Argentina",
  "332": "Banco de Servicios Financieros",
  "336": "Banco Bradesco Argentina",
  "338": "Banco de Servicios y Transacciones",
  "340": "BACS Banco de Crédito y Securitización",
  "341": "Banco Masventas",
  "386": "Nuevo Banco de Entre Ríos",
  "389": "Banco Columbia",
  "405": "Ford Credit Compañía Financiera",
  "406": "Metrópolis Compañía Financiera",
  "408": "Compañía Financiera Argentina",
  "415": "Multifinanzas Compañía Financiera",
  "428": "Caja de Crédito Coop. La Capital del Plata",
  "431": "Banco Coinag",
  "432": "Banco de Comercio",
  "440": "Banco Dino",
  "448": "Credicuotas Consumo",
};

function checkDigit(digits: string, weights: number[]): number {
  const sum = digits
    .split("")
    .reduce((acc, d, i) => acc + parseInt(d, 10) * weights[i], 0);
  return (10 - (sum % 10)) % 10;
}

export interface CbuValidationResult {
  valid: boolean;
  bankName?: string;
  entityCode?: string;
  branchCode?: string;
  error?: string;
}

export function maskCBU(cbu: string): string {
  const digits = (cbu || "").replace(/\s|-/g, "");
  if (digits.length !== 22) return cbu;
  return `CBU •••• ${digits.slice(-4)}`;
}

export function validateCBU(rawInput: string): CbuValidationResult {
  const cbu = (rawInput || "").replace(/\s|-/g, "");

  if (!/^\d{22}$/.test(cbu)) {
    return { valid: false, error: "El CBU/CVU debe tener exactamente 22 dígitos numéricos." };
  }

  const block1 = cbu.slice(0, 7);
  const dv1 = parseInt(cbu[7], 10);
  const block2 = cbu.slice(8, 21);
  const dv2 = parseInt(cbu[21], 10);

  const expectedDv1 = checkDigit(block1, [7, 1, 3, 9, 7, 1, 3]);
  const expectedDv2 = checkDigit(block2, [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3]);

  if (dv1 !== expectedDv1 || dv2 !== expectedDv2) {
    return { valid: false, error: "El CBU/CVU no es válido (dígito verificador incorrecto)." };
  }

  const entityCode = cbu.slice(0, 3);
  const branchCode = cbu.slice(3, 7);

  return {
    valid: true,
    entityCode,
    branchCode,
    bankName: ENTIDADES[entityCode] || `Entidad Nº ${entityCode} (no identificada)`,
  };
}
