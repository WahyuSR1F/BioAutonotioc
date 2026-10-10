// Deklarasi tipe untuk library resmi `midtrans-client` (package-nya tidak menyertakan .d.ts).
// Hanya memuat permukaan API yang dipakai proyek ini: Snap.createTransaction
// (dan wrapper-nya) serta CoreApi.transaction.status.
// Catatan: package v1.4.3 mengekspor `CoreApi` (bukan `Core`).
declare module 'midtrans-client' {
  export interface MidtransClientOptions {
    isProduction: boolean;
    serverKey: string;
    clientKey?: string;
  }

  export interface TransactionDetails {
    order_id: string;
    gross_amount: number;
  }

  export interface CreateTransactionParameter {
    transaction_details: TransactionDetails;
    customer_details?: {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      [key: string]: unknown;
    };
    item_details?: Array<{
      id: string;
      price: number;
      quantity: number;
      name: string;
      brand?: string;
    }>;
    expiration?: { unit?: string; duration?: number; minute?: number };
    [key: string]: unknown;
  }

  export interface CreateTransactionResponse {
    token: string;
    redirect_url: string;
  }

  export class Snap {
    constructor(options: MidtransClientOptions);
    /** POST /snap/v1/transactions — mengembalikan { token, redirect_url } */
    createTransaction(
      parameter: CreateTransactionParameter
    ): Promise<CreateTransactionResponse>;
    /** Wrapper: resolve hanya dengan token */
    createTransactionToken(parameter: CreateTransactionParameter): Promise<string>;
    /** Wrapper: resolve hanya dengan redirect_url */
    createTransactionRedirectUrl(parameter: CreateTransactionParameter): Promise<string>;
  }

  export class CoreApi {
    constructor(options: MidtransClientOptions);
    transaction: {
      status(parameter: { order_id: string }): Promise<Record<string, unknown>>;
    };
  }

  const midtransClient: {
    Snap: typeof Snap;
    CoreApi: typeof CoreApi;
  };

  export default midtransClient;
}
