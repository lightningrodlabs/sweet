// Minimum runtime evidence for the happ: two agents make zome calls on one
// network. Holochain runs `init` lazily on the first zome call, and syn's init
// creates a cap grant, so this is the test that proves the zomes run on the
// conductor they were built for (Moss install/join alone does not).
import { describe, expect, it } from 'vitest';
import { dhtSync, runScenario, PlayerApp } from '@holochain-open-dev/tryorama';
import { AppBundleSource, EntryHash, Link, Record, encodeHashToBase64 } from '@holochain/client';
import { decode } from '@msgpack/msgpack';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appBundleSource: AppBundleSource = {
  type: 'path',
  value: path.resolve(__dirname, '../../../workdir/calcy.happ'),
};

const call = <T>(player: PlayerApp, fn_name: string, payload: unknown): Promise<T> => {
  const cell = player.cells.find((c) => c.name === 'calcy');
  if (!cell) throw new Error('No calcy cell');
  return cell.callZome({ zome_name: 'syn', fn_name, payload }) as Promise<T>;
};

const entryOf = (record: Record): any => decode((record.entry as any).Present.entry);

describe('calcy happ', () => {
  it('a document created by one agent is read back by another', async () => {
    await runScenario(async (scenario) => {
      const [alice, bob] = await scenario.addPlayersWithApps([{ appBundleSource }, { appBundleSource }]);
      await scenario.shareAllAgents();

      const initialState = new Uint8Array([1, 2, 3, 4]);
      const created = await call<Record>(alice, 'create_document', {
        initial_state: initialState,
        meta: undefined,
        nonce: new Uint8Array([9, 9]),
      });
      const documentHash = (created.signed_action.hashed.content as any).data.entry_hash as EntryHash;
      await call<void>(alice, 'tag_document', { document_hash: documentHash, tag: 'two-agents' });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      const read = await call<Record | null>(bob, 'get_document', documentHash);
      expect(read).toBeTruthy();
      expect(new Uint8Array(entryOf(read!).initial_state)).toEqual(initialState);

      const links = await call<Link[]>(bob, 'get_documents_with_tag', { input: 'two-agents', local: false });
      expect(links.map((l) => encodeHashToBase64(l.target))).toEqual([encodeHashToBase64(documentHash)]);
    });
  });
});
