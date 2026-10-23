import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Devises ISO 4217 courantes — seed idempotent (upsert sur le code). */
const CURRENCIES: {
  code: string;
  name: string;
  symbol: string;
  minorUnits?: number;
}[] = [
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'Dollar américain', symbol: '$' },
  { code: 'GBP', name: 'Livre sterling', symbol: '£' },
  { code: 'CHF', name: 'Franc suisse', symbol: 'CHF' },
  { code: 'CAD', name: 'Dollar canadien', symbol: '$' },
  { code: 'JPY', name: 'Yen japonais', symbol: '¥', minorUnits: 0 },
  { code: 'MAD', name: 'Dirham marocain', symbol: 'DH' },
  { code: 'XOF', name: 'Franc CFA (BCEAO)', symbol: 'F', minorUnits: 0 },
  { code: 'XAF', name: 'Franc CFA (BEAC)', symbol: 'F', minorUnits: 0 },
  { code: 'DZD', name: 'Dinar algérien', symbol: 'DA' },
  { code: 'TND', name: 'Dinar tunisien', symbol: 'DT', minorUnits: 3 },
  { code: 'BRL', name: 'Réal brésilien', symbol: 'R$' },
  { code: 'AUD', name: 'Dollar australien', symbol: '$' },
  { code: 'SEK', name: 'Couronne suédoise', symbol: 'kr' },
  { code: 'PLN', name: 'Zloty polonais', symbol: 'zł' },
];

async function main() {
  for (const c of CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: { name: c.name, symbol: c.symbol, minorUnits: c.minorUnits ?? 2 },
      create: { ...c, minorUnits: c.minorUnits ?? 2 },
    });
  }
  console.log(`[seed] ${CURRENCIES.length} devises à jour`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
