import { clientIp, createServerClientFromEnv, legacyRedirect } from '@/lib/buyer/handlers';

export const dynamic = 'force-dynamic';

/** QR codes printed before the buyer page existed point here: /verify/{qr_token}. They keep working. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reply = await legacyRedirect(token, clientIp(request.headers), { client: createServerClientFromEnv() });
  return new Response(reply.body || null, { status: reply.status, headers: reply.headers });
}
