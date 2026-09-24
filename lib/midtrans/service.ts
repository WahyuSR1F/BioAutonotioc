import { midtransClient, isSandbox, appUrl } from '../midtrans';

export interface MidtransPaymentDetails {
  orderId: string;
  grossAmount: number;
  customerName: string;
  customerEmail: string;
  productName: string;
  productDescription: string;
  productPrice: number;
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
      const transactionDetails = {
        transaction_details: {
          order_id: details.orderId,
          gross_amount: details.grossAmount,
        },
        customer_details: {
          first_name: details.customerName,
          email: details.customerEmail,
        },
        item_details: [
          {
            id: details.orderId,
            price: details.productPrice,
            quantity: 1,
            name: details.productName,
            brand: 'BioAutomate',
          },
        ],
        expiration: {
          minute: 15,
        },
      };

      const result = await midtransClient.snap.createTransactionRedirectUrl(transactionDetails);

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
      const result = await midtransClient.status(orderId);
      return result;
    } catch (error: any) {
      console.error('Midtrans Get Transaction Status error:', error);
      throw new Error(`Failed to get transaction status: ${error.message}`);
    }
  }
}

export default MidtransService;