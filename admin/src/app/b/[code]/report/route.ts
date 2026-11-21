import { clientIp, createServerClientFromEnv, postReport } from '@/lib/buyer/handlers';

export const dynamic = 'force-dynamic';

/** "Report a problem" form on the buyer page. Works without JavaScript (a plain form post). */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const form = await request.formData().catch(() => null);
  const reply = await postReport(
    { code, ip: clientIp(request.headers), message: form?.get('message'), contact: form?.get('contact'), website: form?.get('website') },
    { client: createServerClientFromEnv() }
  );
  return new Response(reply.body || null, { status: reply.status, headers: reply.headers });
}
