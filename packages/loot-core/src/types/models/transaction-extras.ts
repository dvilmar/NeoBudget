export type TransactionFxEntity = {
  id: string;
  transaction_id: string;
  currency: string;
  // Amount in the foreign currency, with the same sign as the transaction
  amount: number;
  // Budget currency per unit of foreign currency
  rate: number | null;
};

export type TransactionLinkType =
  | 'relates'
  | 'refund'
  | 'paid_by'
  | 'reimbursed';

export type TransactionLinkEntity = {
  id: string;
  transaction_a: string;
  transaction_b: string;
  link_type: TransactionLinkType;
};

// A link seen from one of its transactions
export type TransactionLinkView = TransactionLinkEntity & {
  other: {
    id: string;
    date: string;
    amount: number;
    notes: string | null;
  } | null;
};

export type TransactionAttachmentEntity = {
  id: string;
  transaction_id: string;
  name: string;
  mime: string | null;
  size: number | null;
  // Where the file lives in the sync server
  remote_id: string | null;
};

export type AuditLogEntity = {
  id: string;
  at: string;
  entity: string;
  action: string;
  summary: string;
};
