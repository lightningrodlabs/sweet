<script lang="ts">
    import type {  BoardProps, Board } from '../board';
    import { getContext, onMount } from 'svelte';
    import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
    import '@shoelace-style/shoelace/dist/components/button/button.js';
    import '@shoelace-style/shoelace/dist/components/input/input.js';
    import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js';
    import SvgIcon from "./SvgIcon.svelte"
    import { cloneDeep } from "lodash";
    import type { CalcyStore } from '../store';
  import type { EntryHash } from '@holochain/client';

    const { getStore } :any = getContext('store');

    const store:CalcyStore = getStore();
    $: uiProps = store.uiProps

    export let handleSave
    export let handleDelete = undefined
    export let cancelEdit

    let boardHash:EntryHash|undefined = undefined
    let text = ''
    let props:BoardProps = {bgUrl: "", attachments: []}
    let nameInput

    export const reset = () => {
      text = ''
      props = {bgUrl: "", attachments: []}
      nameInput.value = ""
      nameInput.focus()
    }

    export const initialFocus = () => {
      nameInput.focus()
    }

    export const  edit = async (hash: EntryHash)=> {
      boardHash = hash
      const board: Board | undefined = await store.boardList.getBoard(boardHash)
      if (board) {
          const state = board.state()
          text = state.name
          nameInput.value = text
          props = state.props ? cloneDeep(state.props) : {bgUrl:""}
      } else {
          console.log("board not found:", boardHash)
      }

    }

    onMount( async () => {
    })

   $: valuesValid = text != ""
   let saving = false
</script>

  <div class='board-editor'>
    <div class="edit-title setting">
      <div class="title-text">Title</div> <sl-input class='textarea' maxlength="60" bind:this={nameInput}  on:input={e=>text= e.target.value}></sl-input>
    </div>
    {#if boardHash}
      <div class="edit-title setting">
        <div class="title-text">Background Image</div>
        <sl-input class='textarea' maxlength="255" value={props.bgUrl} on:input={e=>props.bgUrl = e.target.value} placeholder="Paste the URL of an image"/>
      </div>
    {/if}
    <div class='controls'>
      {#if handleDelete}
        <sl-button class="board-control" on:click={handleDelete}>
          Archive
        </sl-button>
      {/if}
      <sl-button on:click={cancelEdit} class="board-control">
        Cancel
      </sl-button>

      <sl-button class="board-control"
        variant="primary"
        disabled={!valuesValid || saving} 
        style="margin-left:10px; width:70px;" on:click={async () => {
          saving = true
          await handleSave(text, props)
          saving = false
          }} >
          
        <span >
          {#if saving}
            <div class="spinning"><SvgIcon icon=faSpinner></SvgIcon></div>
          {:else}
            Save
          {/if}
        </span>
        
      </sl-button>
    </div>
 </div>


   
 <style>
  .board-editor {
    display: flex;
    flex-basis: 270px;
    font-style: normal;
    font-weight: 600;
    flex-direction: column;
    justify-content: flex-start;
  }
  .textarea {
    width: 100%;
    padding: 5px;
    margin-right: 5px;
    font-weight: normal;
  }

  .setting {
    background-color: white;
    margin-bottom: 15px;
    box-shadow: 0px 2px 3px rgba(35, 32, 74, 0.15);
    font-size: 12px;
    line-height: 16px;
    color: #23204A;
    border-radius: 5px;
    display:flex;
    flex-direction:column;
    padding: 10px;
    transition: all .25s ease;
    height: 0;
    height: auto;
  }

  .controls {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
    padding-left: 7px;
    padding-top: 10px;
  }

  .board-control {
    margin-right: 10px;
  }

  .title-text {
    display: flex;
    flex-direction: row;
    align-items: center;
    font-weight: normal;
    font-weight: bold;
    font-size: 18px;
    margin-bottom: 10px;
    color: rgba(86, 94, 109, 1.0);
  }
</style>
