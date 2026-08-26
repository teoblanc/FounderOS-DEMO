import { getDb } from '@/lib/data';
import { PageHeader } from '@/components/PageHeader';
import { PersonasViewer } from '@/components/PersonasViewer';
import { Badge } from '@/components/terminal';

export const dynamic = 'force-dynamic';

export default async function PersonasPage() {
  const db = await getDb();
  const personas = await db.personas.all();

  return (
    <div>
      <PageHeader
        eyebrow="platform variants"
        title="Personas"
        right={<Badge tone="accent">{personas.length} templates</Badge>}
      />
      <PersonasViewer personas={personas} />
    </div>
  );
}
