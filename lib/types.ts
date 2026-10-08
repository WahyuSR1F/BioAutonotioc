export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          email: string
          bio: string | null
          avatar_url: string | null
          store_slug: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          email: string
          bio?: string | null
          avatar_url?: string | null
          store_slug?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          email?: string | null
          bio?: string | null
          avatar_url?: string | null
          store_slug?: string | null
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          creator_id: string
          title: string
          description: string | null
          price: number
          currency: string
          cover_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          creator_id?: string
          title: string
          description?: string | null
          price: number
          currency?: string
          cover_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          creator_id?: string
          title?: string
          description?: string | null
          price?: number
          currency?: string
          cover_url?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      product_files: {
        Row: {
          id: string
          product_id: string
          storage_path: string
          file_name: string
          file_size: number | null
          mime_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          storage_path: string
          file_name: string
          file_size?: number | null
          mime_type?: string | null
          created_at?: string
        }
        Update: {
          storage_path?: string
          file_name?: string
          file_size?: number | null
          mime_type?: string | null
        }
      }
      payment_links: {
        Row: {
          id: string
          product_id: string
          creator_id: string
          slug: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          creator_id?: string
          slug: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          product_id?: string
          slug?: string
          is_active?: boolean
        }
      }
      orders: {
        Row: {
          id: string
          product_id: string
          creator_id: string
          payment_link_id: string | null
          buyer_email: string
          buyer_name: string | null
          amount: number
          currency: string
          payment_provider: 'midtrans' | 'xendit'
          payment_ref: string | null
          payment_status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded'
          paid_at: string | null
          raw_webhook: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          creator_id: string
          payment_link_id?: string | null
          buyer_email: string
          buyer_name?: string | null
          amount: number
          currency?: string
          payment_provider: 'midtrans' | 'xendit'
          payment_ref?: string | null
          payment_status?: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded'
          paid_at?: string | null
          raw_webhook?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          payment_ref?: string | null
          payment_status?: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded'
          paid_at?: string | null
          raw_webhook?: Json | null
          updated_at?: string
        }
      }
      deliveries: {
        Row: {
          id: string
          order_id: string
          status: 'pending' | 'sent' | 'failed' | 'retry'
          resend_email_id: string | null
          attempts: number
          last_error: string | null
          sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          status?: 'pending' | 'sent' | 'failed' | 'retry'
          resend_email_id?: string | null
          attempts?: number
          last_error?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: 'pending' | 'sent' | 'failed' | 'retry'
          resend_email_id?: string | null
          attempts?: number
          last_error?: string | null
          sent_at?: string | null
          updated_at?: string
        }
      }
      webhook_integrations: {
        Row: {
          id: string
          creator_id: string
          platform: string
          webhook_token: string
          platform_username: string | null
          is_connected: boolean
          first_payload: Json | null
          connected_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          creator_id: string
          platform: string
          webhook_token: string
          platform_username?: string | null
          is_connected?: boolean
          first_payload?: Json | null
          connected_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          platform_username?: string | null
          is_connected?: boolean
          first_payload?: Json | null
          connected_at?: string | null
          updated_at?: string
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type ProductFile = Database['public']['Tables']['product_files']['Row']
export type PaymentLink = Database['public']['Tables']['payment_links']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type Delivery = Database['public']['Tables']['deliveries']['Row']
export type WebhookIntegration = Database['public']['Tables']['webhook_integrations']['Row']

export type OrderWithProduct = Order & {
  products: Pick<Product, 'title' | 'cover_url'>
  deliveries: Pick<Delivery, 'status' | 'sent_at'> | null
}

export type DeliveryWithOrder = Delivery & {
  orders: Pick<Order, 'buyer_email' | 'buyer_name' | 'amount'> & {
    products: Pick<Product, 'title'>
  }
}

export type PlatformConfig = {
  id: string
  name: string
  icon: string
  color: string
  bgColor: string
  setupSteps: string[]
  docsUrl?: string
}