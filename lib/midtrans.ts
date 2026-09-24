import { Midtrans } from 'midtrans';

const {
  NEXT_PUBLIC_APP_URL = 'http://localhost:3000',
  MIDTRANS_SERVER_KEY = '',
  MIDTRANS_ENVIRONMENT = 'SANDBOX',
} = process.env;

export const midtransClient = new Midtrans({
  serverKey: MIDTRANS_SERVER_KEY,
  isProduction: MIDTRANS_ENVIRONMENT === 'PRODUCTION',
});

export const isSandbox = MIDTRANS_ENVIRONMENT === 'SANDBOX';
export const appUrl = NEXT_PUBLIC_APP_URL;