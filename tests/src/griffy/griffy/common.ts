// NOTE: this file is a scaffolding stub copied from another tool ("griffy"); it holds
// only imports and is not referenced by any test. It is kept so the tests workspace
// still typechecks against the 0.7 dependency set.
// Holochain 0.7 changes reflected here:
//   - tryorama moved to @holochain-open-dev/tryorama (upstream @holochain/tryorama is
//     a 0.6 dead end).
//   - `NewEntryAction` no longer exists in @holochain/client 0.21 — the action model
//     was rewritten into Action { header, data }.
import { CallableCell } from '@holochain-open-dev/tryorama';
import { Timestamp, ActionHash, Record, AppBundleSource, fakeActionHash, fakeAgentPubKey, fakeEntryHash, fakeDnaHash } from '@holochain/client';
