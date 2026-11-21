import { clientIp, createServerClientFromEnv, getBuyerPage } from '@/lib/buyer/handlers';

export const dynamic = 'force-dynamic';

/** The public buyer page: /b/{public_code}. No login. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const reported = new URL(request.url).searchParams.get('reported') === '1';
  const reply = await getBuyerPage({ code, ip: clientIp(request.headers), reported }, { client: createServerClientFromEnv() });
  return new Response(reply.body, { status: reply.status, headers: reply.headers });
}
