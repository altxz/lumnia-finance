import { registerPlugin } from '@capacitor/core';

export interface DetectedBankTransaction {
  bank: string;
  packageName: string;
  description: string;
  value: number;
  type: 'income' | 'expense';
  date: string;
  rawText: string;
}

interface BankNotificationCapturePlugin {
  isEnabled(): Promise<{ enabled: boolean }>;
  openSettings(): Promise<void>;
  requestNotificationPermission(): Promise<{ granted?: boolean } | void>;
  getPendingTransaction(): Promise<{ transaction: DetectedBankTransaction | null }>;
}

export const BankNotificationCapture = registerPlugin<BankNotificationCapturePlugin>('BankNotificationCapture');
