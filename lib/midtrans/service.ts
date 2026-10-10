import { getSnap, getCore } from '../midtrans';

export interface MidtransItemDetail {
  id: string;
  price: number;
  quantity: number;
  name: string;
  brand?: string;
}

export interface MidtransPaymentDetails {
  orderId: string;
  grossAmount: number;
  customerName: string;
  customerEmail: string;
  productName: string;
  productDescription: string;
  productPrice: number;
  /** Biaya admin yang ditambahkan ke total (0 bila tanpa biaya) */
  adminFee?: number;
  /** Rincian item; harus jumlahnya sama dengan grossAmount. Bila kosong, dibuat otomatis. */
  itemDetails?: MidtransItemDetail[];
}

export interface MidtransSnapResponse {
  redirect_url?: string;
  token?: string;
  status?: string;
  message?: string;
}

export class MidtransService {
  /**
   * Create a Midtrans Snap transaction (payment link)
   * 
   * @param details Payment details
   * @returns Midtrans transaction response with redirect URL
   */
  static async createSnapTransaction(
    details: MidtransPaymentDetails
  ): Promise<MidtransSnapResponse> {
    try {
      const adminFee = Math.max(0, Math.round(details.adminFee || 0));
      const itemDetails: MidtransItemDetail[] =
        details.itemDetails && details.itemDetails.length > 0
          ? details.itemDetails
          : [
              {
                id: details.orderId,
                price: details.productPrice,
                quantity: 1,
                name: details.productName,
                brand: 'BioAutomate',
              },
              ...(adminFee > 0
                ? [{ id: `${details.orderId}-fee`, price: adminFee, quantity: 1, name: 'Biaya admin' }]
                : []),
            ];

      const transactionDetails = {
        transaction_details: {
          order_id: details.orderId,
          gross_amount: details.grossAmount,
        },
        customer_details: {
          first_name: details.customerName,
          email: details.customerEmail,
        },
        item_details: itemDetails,
        expiration: {
          minute: 15,
        },
      };

      // Library resmi midtrans-client: Snap.createTransaction → { token, redirect_url }
      const result = await getSnap().createTransaction(transactionDetails);

      return {
        redirect_url: result.redirect_url,
        token: result.token,
        status: 'success',
      };
    } catch (error: any) {
      console.error('Midtrans Snap creation error:', error);
      return {
        status: 'error',
        message: error.message || 'Failed to create payment transaction',
      };
    }
  }

  /**
   * Get transaction status from Midtrans
   * 
   * @param orderId Order ID or transaction ID
   * @returns Transaction status details
   */
  static async getTransactionStatus(orderId: string): Promise<any> {
    try {
      const result = await getCore().transaction.status({ order_id: orderId });
      return result;
    } catch (error: any) {
      console.error('Midtrans Get Transaction Status error:', error);
      throw new Error(`Failed to get transaction status: ${error.message}`);
    }
  }
}

export default MidtransService;