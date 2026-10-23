export interface Currency {
  code: string;
  name: string;
  symbol: string;
  minorUnits: number;
}

export interface Account {
  id: string;
  ownerId: string | null;
  name: string;
  type: 'CHECKING' | 'SAVINGS' | 'CASH' | 'CREDIT_CARD' | 'OTHER';
  currencyCode: string;
  currency: Currency;
  initialBalance: string;
  balance: string;
  cover: string | null;
  owner?: { id: string; displayName: string } | null;
}

export interface Category {
  id: string;
  ownerId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  owner?: { id: string; displayName: string } | null;
}

export interface Envelope {
  id: string;
  ownerId: string | null;
  categoryId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  cover: string | null;
  alertThreshold: string | null;
  isFavorite: boolean;
  category?: Category | null;
  owner?: { id: string; displayName: string } | null;
}

export interface TxTemplate {
  id: string;
  ownerId: string | null;
  label: string;
  type: 'EXPENSE' | 'INCOME';
  amount: string;
  accountId: string | null;
  envelopeId: string | null;
  mandatory: boolean;
  account?: { id: string; name: string } | null;
  envelope?: { id: string; name: string; icon: string | null } | null;
}

export interface Debt {
  id: string;
  ownerId: string | null;
  person: string;
  direction: 'OWED_TO_ME' | 'I_OWE';
  amount: string;
  paid: string;
  note: string | null;
  closedAt: string | null;
  createdAt: string;
  owner?: { id: string; displayName: string } | null;
}

export interface Transaction {
  id: string;
  type: 'EXPENSE' | 'INCOME' | 'ACCOUNT_TRANSFER';
  amount: string;
  label: string;
  note: string | null;
  mandatory: boolean;
  date: string;
  account: { id: string; name: string; ownerId: string | null; currencyCode: string };
  toAccount: { id: string; name: string } | null;
  envelope: { id: string; name: string; color: string | null } | null;
  createdBy: { id: string; displayName: string };
}
