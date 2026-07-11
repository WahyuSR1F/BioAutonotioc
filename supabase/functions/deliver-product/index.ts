import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch order + product + files
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        id, buyer_email, buyer_name, amount, currency,
        products(id, title, description,
          product_files(id, storage_path, file_name)
        )
      `)
      .eq("id", orderId)
      .eq("payment_status", "paid")
      .single();

    if (orderError || !order) {
      await updateDelivery(supabase, orderId, "failed", "Order not found or not paid");
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const product = order.products as any;
    const files: { storage_path: string; file_name: string }[] = product?.product_files ?? [];

    if (files.length === 0) {
      await updateDelivery(supabase, orderId, "failed", "No product files found");
      return new Response(JSON.stringify({ error: "No files" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate signed URLs (24h)
    const signedUrls: { fileName: string; url: string }[] = [];
    for (const file of files) {
      const { data, error } = await supabase.storage
        .from("product-files")
        .createSignedUrl(file.storage_path, 60 * 60 * 24);

      if (error || !data) {
        console.error("Signed URL error", error);
        continue;
      }
      signedUrls.push({ fileName: file.file_name, url: data.signedUrl });
    }

    if (signedUrls.length === 0) {
      await updateDelivery(supabase, orderId, "failed", "Failed to generate signed URLs");
      return new Response(JSON.stringify({ error: "Failed to generate URLs" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      await updateDelivery(supabase, orderId, "failed", "RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileLinksHtml = signedUrls
      .map((f) => `<li><a href="${f.url}" style="color:#2563eb">${f.fileName}</a> <span style="color:#6b7280;font-size:12px">(berlaku 24 jam)</span></li>`)
      .join("");

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;color:#111;max-width:600px;margin:0 auto;padding:32px 16px">
  <div style="background:#2563eb;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
    <h1 style="color:white;margin:0;font-size:20px">Pembelian Anda Berhasil!</h1>
  </div>
  <p>Hai <strong>${order.buyer_name || order.buyer_email}</strong>,</p>
  <p>Terima kasih telah membeli <strong>${product.title}</strong>. Berikut link download file Anda:</p>
  <ul style="padding-left:20px;line-height:2">
    ${fileLinksHtml}
  </ul>
  <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:24px 0">
    <p style="margin:0;font-size:13px;color:#6b7280">
      Link download berlaku selama 24 jam. Segera unduh dan simpan file Anda.
    </p>
  </div>
  <p style="font-size:13px;color:#9ca3af">
    Email ini dikirim otomatis oleh BioAutomate. Jangan balas email ini.
  </p>
</body>
</html>`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "BioAutomate <noreply@bioautomate.id>",
        to: [order.buyer_email],
        subject: `File Download: ${product.title}`,
        html: emailHtml,
      }),
    });

    if (!emailRes.ok) {
      const emailError = await emailRes.text();
      await updateDelivery(supabase, orderId, "failed", `Resend error: ${emailError}`);
      return new Response(JSON.stringify({ error: "Email send failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailData = await emailRes.json();

    // Update delivery as sent
    const { data: delivery } = await supabase
      .from("deliveries")
      .select("id, attempts")
      .eq("order_id", orderId)
      .maybeSingle();

    if (delivery) {
      await supabase
        .from("deliveries")
        .update({
          status: "sent",
          resend_email_id: emailData.id,
          sent_at: new Date().toISOString(),
          attempts: (delivery.attempts || 0) + 1,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", delivery.id);
    }

    return new Response(JSON.stringify({ ok: true, emailId: emailData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("deliver-product error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function updateDelivery(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  status: string,
  errorMsg: string
) {
  const { data: delivery } = await supabase
    .from("deliveries")
    .select("id, attempts")
    .eq("order_id", orderId)
    .maybeSingle();

  if (delivery) {
    await supabase
      .from("deliveries")
      .update({
        status,
        last_error: errorMsg,
        attempts: (delivery.attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);
  }
}
