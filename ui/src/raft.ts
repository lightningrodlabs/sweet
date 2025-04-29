import type { EntryHash, AppWebsocket, HoloHash, CellInfo } from "@holochain/client";
import { encodeHashToBase64 } from "@holochain/client";
import { decode, encode } from '@msgpack/msgpack';
export class RaftClient {
  private setupComplete: Promise<void>;

  constructor(
    public client: AppWebsocket,
    public role: string,
    public workspace: EntryHash,
    public dnaHash: HoloHash,
  ) {
    this.setupComplete = this.setup();
  }

  private async setup() {
    const appInfo = await this.client.appInfo();
    if (appInfo) {
      const CellType = { Provisioned: 'provisioned' };
      this.dnaHash = (appInfo.cell_info[this.role][0] as any)[
        CellType.Provisioned
      ].cell_id[0];
    }
  }

  private async ensureSetupComplete() {
    await this.setupComplete;
  }

  public async initializeRaft(knownAgents: any[] | undefined = undefined) {
    await this.ensureSetupComplete();
    const s = await this.client.anyRaw('raft', {
      "dna_hash": this.dnaHash,
      "raft_space": encodeHashToBase64(this.workspace),
      "payload":{
        "Initialize":knownAgents || [this.client.myPubKey]
      }
    });
    console.log("Raft initialized", s);
  }

  public async joinRaft(knownAgents: any[]) {
    await this.ensureSetupComplete();
    const initializePayload = {
      "dna_hash": this.dnaHash,
      "raft_space": encodeHashToBase64(this.workspace),
      "payload":{
        "Join": knownAgents
      }
    };
    console.log("about to join raft: ", initializePayload);
    const res = await this.client.anyRaw('raft', initializePayload);
    console.log("joined raft: ", res);
    return res;
  }

  public async leaveRaft() {
    await this.ensureSetupComplete();
    const leavePayload = {
      "dna_hash": this.dnaHash,
      "raft_space": encodeHashToBase64(this.workspace),
      "payload":{
        "Leave": null
      }
    };
    return await this.client.anyRaw('raft', leavePayload);
  }

  public async proposeLog(log: any) {
    await this.ensureSetupComplete();
    const proposePayload = {
      "dna_hash": this.dnaHash,
      "raft_space": encodeHashToBase64(this.workspace),
      "payload":{
        "Propose": encode(log)
      }
    };
    console.log("about to propose raft log: ", proposePayload);
    const res = await this.client.anyRaw('raft', proposePayload);
    console.log("proposed raft log: ", res);
    return res;
  }

  public async getLogs(index) {
    await this.ensureSetupComplete();
    const getUserLogsPayload = {
      "dna_hash": this.dnaHash,
      "raft_space": encodeHashToBase64(this.workspace),
      "payload":{
        "GetUserLogEntries": index
      }
    };
    console.log("about to get logs");
    const res = await this.client.anyRaw('raft', getUserLogsPayload);
    console.log("got logs: ", res);
    const decoded = res?.UserLogEntries?.map((log) => {
      return {
        ...log,
        op: decode(log.op)
      };
    });
    console.log("decoded logs: ", decoded);
    return decoded;
  }
}
