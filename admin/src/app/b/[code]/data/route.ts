import { clientIp, createServerClientFromEnv, getBuyerJson } from '@/lib/buyer/handlers';

export const dynamic = 'force-dynamic';

/** The same facts as the buyer page, as JSON, for the FarmTori app's own scanner. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const reply = await getBuyerJson({ code, ip: clientIp(request.headers) }, { client: createServerClientFromEnv() });
  return new Response(reply.body, { status: reply.status, headers: reply.headers });
}
