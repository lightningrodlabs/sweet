<script lang="ts">
  import { isWeaveContext, type WAL, weaveUrlFromWal } from "@theweave/api";;
  import { cloneDeep } from "lodash";
  import type { Board } from "./board";
  import { getContext } from "svelte";
  import type { CalcyStore } from "./store";
  import '@shoelace-style/shoelace/dist/components/button/button.js';
  import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
  import AttachmentsList from "./AttachmentsList.svelte";
  import SvgIcon from "./SvgIcon.svelte";
  import type { WALUrl } from "./util";

  const { getStore } :any = getContext("store");
  let store: CalcyStore = getStore();
  //let card: Card | undefined
  let attachments: Array<WALUrl> = []
 
  $:attachments = attachments

  export let activeBoard: Board
  export const close=()=>{dialog.hide()}
  export const open= async (c: any)=>{
    // card = c
    // if (card) {
    //   attachments = card.props.attachments ? cloneDeep(card.props.attachments): []
    // } else {
      attachments = activeBoard.state().props.attachments
    // }
    dialog.show()
  }
  let dialog
  $: attachments

  function removeAttachment(index: number) {
    attachments.splice(index, 1);
    attachments = attachments
    handleSave()
  }

  const addAttachment = async () => {
    const wal = await store.weClient.assets.userSelectAsset()
    if (wal) {
      _addAttachment(wal)
    }
  }

  const _addAttachment = (wal: WAL) => {
    attachments.push(weaveUrlFromWal(wal))
    attachments = attachments
    handleSave()
  }


  const handleSave = async () => {
    // if (card) {
    //   const props = cloneDeep(card.props)
    //   props.attachments = cloneDeep(attachments)
    //   activeBoard.requestChanges([{
    //     type: 'update-card-props', 
    //     id: card.id,
    //     props
    //   }])
    // } else {
      const props = cloneDeep(activeBoard.state().props)
      props.attachments = cloneDeep(attachments)
      activeBoard.requestChanges([{type: 'set-props', props }])
    // }
  }
</script>

<sl-dialog label={"Board Links"} bind:this={dialog}>
  {#if isWeaveContext()}
  <AttachmentsList attachments={attachments}
      on:remove-attachment={(e)=>removeAttachment(e.detail)}/>

  <div>
      <h3>Search Linkables:</h3> 
  </div> 
  <sl-button style="margin-top:5px;margin-right: 5px" circle on:click={()=>addAttachment()} >
        <SvgIcon icon=searchPlus size=12 />
  </sl-button>

  {/if}
</sl-dialog>

<style>


  sl-dialog::part(panel) {
      background: #FFFFFF;
      border: 2px solid rgb(166 115 55 / 26%);
      border-bottom: 2px solid rgb(84 54 19 / 50%);
      border-top: 2px solid rgb(166 115 55 / 5%);
      box-shadow: 0px 15px 40px rgb(130 107 58 / 35%);
      border-radius: 10px;
  }
</style>