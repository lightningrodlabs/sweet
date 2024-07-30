<script lang="ts">
  import Controller from './Controller.svelte'
  import ControllerBoard from './ControllerBoard.svelte'
  import ControllerBlockActiveBoards from './ControllerBlockActiveBoards.svelte'
  import { AppWebsocket, AdminWebsocket } from '@holochain/client';
  import '@shoelace-style/shoelace/dist/themes/light.css';
  import 'highlight.js/styles/github.css';
  import { WeaveClient, isWeContext, initializeHotReload, type WAL} from '@lightningrodlabs/we-applet';
  import { ProfilesClient, ProfilesStore } from '@holochain-open-dev/profiles';
  import "@holochain-open-dev/profiles/dist/elements/profiles-context.js";
  import "@holochain-open-dev/profiles/dist/elements/profile-prompt.js";
  import "@holochain-open-dev/profiles/dist/elements/create-profile.js";
  import LogoIcon from "./icons/LogoIcon.svelte";
  import { appletServices } from './we';
  import ControllerCreate from './ControllerCreate.svelte'

  const appId = import.meta.env.VITE_APP_ID ? import.meta.env.VITE_APP_ID : 'calcy'
  const roleName = 'calcy'
  const appPort = import.meta.env.VITE_APP_PORT ? import.meta.env.VITE_APP_PORT : 8888
  const adminPort = import.meta.env.VITE_ADMIN_PORT
  const url = `ws://localhost:${appPort}`;

  let client: AppWebsocket
  let weClient: WeaveClient
  let profilesStore : ProfilesStore|undefined = undefined
  let createView

  let connected = false

  enum RenderType {
    App,
    WAL,
    CreateSpreadsheet,
    BlockActiveBoards
  }

  let renderType = RenderType.App
  let wal: WAL

  initialize()

  async function initialize() : Promise<void> {
    let profilesClient
    if ((import.meta as any).env.DEV) {
      try {
        await initializeHotReload();
      } catch (e) {
        console.warn("Could not initialize applet hot-reloading. This is only expected to work in a We context in dev mode.")
      }
    }
    if (!isWeContext()) {
        console.log("adminPort is", adminPort)
        if (adminPort) {
          const url = `ws://localhost:${adminPort}`
          const adminWebsocket = await AdminWebsocket.connect({url: new URL(url)})
          const x = await adminWebsocket.listApps({})
          console.log("apps", x)
          const cellIds = await adminWebsocket.listCellIds()
          console.log("CELL IDS",cellIds)
          await adminWebsocket.authorizeSigningCredentials(cellIds[0])
        }
        console.log("appPort and Id is", appPort, appId)
        client = await AppWebsocket.connect(appId, {url: new URL(url)})
        profilesClient = new ProfilesClient(client, appId);
    }
    else {
      weClient = await WeaveClient.connect(appletServices);

      switch (weClient.renderInfo.type) {
        case "applet-view":
          switch (weClient.renderInfo.view.type) {
            case "main":
              // here comes your rendering logic for the main view
              break;
            case "block":
              switch(weClient.renderInfo.view.block) {
                case "active_boards":
                  renderType = RenderType.BlockActiveBoards
                  break;
                default:
                  throw new Error("Unknown applet-view block type:"+weClient.renderInfo.view.block);
              }
              break;
            case "creatable":
            switch (weClient.renderInfo.view.name) {
                case "spreadsheet":
                  renderType = RenderType.CreateSpreadsheet
                  createView = weClient.renderInfo.view
              }              
              break;
            case "asset":
              switch (weClient.renderInfo.view.recordInfo.roleName) {
                case "calcy":
                  switch (weClient.renderInfo.view.recordInfo.integrityZomeName) {
                    case "syn_integrity":
                      switch (weClient.renderInfo.view.recordInfo.entryType) {
                        case "document":
                          renderType = RenderType.WAL
                          wal = weClient.renderInfo.view.wal
                          break;
                        case "spreadsheet":
                          renderType = RenderType.WAL
                          break;
                        default:
                          throw new Error("Unknown entry type:"+weClient.renderInfo.view.entryType);
                      }
                      break;
                    default:
                      throw new Error("Unknown integrity zome:"+weClient.renderInfo.view.integrityZomeName);
                  }
                  break;
                default:
                  throw new Error("Unknown role name:"+weClient.renderInfo.view.roleName);
              }
              break;
            default:
              throw new Error("Unsupported applet-view type");
          }
          break;
        case "cross-applet-view":
          switch (this.weClient.renderInfo.view.type) {
            case "main":
              // here comes your rendering logic for the cross-applet main view
              //break;
            case "block":
              //
              //break;
            default:
              throw new Error("Unknown cross-applet-view render type.")
          }
          break;
        default:
          throw new Error("Unknown render view type");

      }
      
      //@ts-ignore
      client = weClient.renderInfo.appletClient;
      //@ts-ignore
      profilesClient = weClient.renderInfo.profilesClient;
    }
    profilesStore = new ProfilesStore(profilesClient);
    connected = true
  }
  $: prof = profilesStore ? profilesStore.myProfile : undefined

</script>

<svelte:head>
</svelte:head>
{#if connected}

<profiles-context store={profilesStore}>
  {#if $prof.status=="pending"}
    <div class="loading"><div class="loader"></div></div>
  {:else if $prof.status=="complete" && $prof.value == undefined}
    <div class="create-profile">
      <div class="welcome-text"><div style="width:200px"><LogoIcon /></div></div>
      <create-profile
        on:profile-created={()=>{}}
      ></create-profile>
    </div>
  {:else if $prof.status=="error"}
   Error when loading profile: {$prof.error}
  {:else}
    {#if renderType== RenderType.CreateSpreadsheet}
      <ControllerCreate  view={createView} client={client} weClient={weClient} profilesStore={profilesStore} roleName={roleName}></ControllerCreate>
    {:else if renderType== RenderType.App}
      <Controller  client={client} weClient={weClient} profilesStore={profilesStore} roleName={roleName}></Controller>
    {:else if  renderType== RenderType.WAL && !wal.context}
      <ControllerBoard  board={wal.hrl[1]} client={client} weClient={weClient} profilesStore={profilesStore} roleName={roleName}></ControllerBoard>
    {:else if  renderType== RenderType.BlockActiveBoards}
      <ControllerBlockActiveBoards client={client} weClient={weClient} profilesStore={profilesStore} roleName={roleName}></ControllerBlockActiveBoards>
    {/if}
  {/if}

</profiles-context>
{:else}
<div class="loading"><div class="loader"></div></div>
{/if}

<style>
.welcome-text {
  margin: 40px;
  border-radius: 20px;
  background-color: #3498db ;
}
.create-profile {
  padding-top: 100px;
  margin-left: auto;
  margin-right: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}
create-profile {
  box-shadow: 0px 10px 10px rgba(0, 0, 0, .15);
}
:global(body) {
  min-height: 0;
  display: flex;
  flex-direction: column;
}
:global(.loading) {
  text-align: center;
  padding-top: 100px;
  display: flex;
  margin-left: auto;
  margin-right: auto;
  align-items: center;
}
:global(.loader) {
  border: 8px solid #f3f3f3;
  border-radius: 50%;
  border-top: 8px solid #3498db;
  width: 50px;
  height: 50px;
  -webkit-animation: spin 2s linear infinite; /* Safari */
  animation: spin 2s linear infinite;
  display: inline-block;
}
@-webkit-keyframes spin {
  0% { -webkit-transform: rotate(0deg); }
  100% { -webkit-transform: rotate(360deg); }
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>