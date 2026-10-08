// GET /api/v1/signers/:key?day= : every multisig the key sits in, the programs they control, $ behind it.
import { handle, dayParam } from '@/lib/route';
import { latestDay, signer } from '@/lib/records';

export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  return handle(req, '/api/v1/signers/[key]', async () => {
    const { key } = await params;
    const day = dayParam(req) ?? (await latestDay());
    const entry = day ? await signer(key, day) : null;
    return entry ? { day, signer: entry } : null;
  });
}
export const dynamic = 'force-dynamic';
