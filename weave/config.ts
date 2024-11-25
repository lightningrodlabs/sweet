import { defineConfig } from '@theweave/cli';

export default defineConfig({
  groups: [
    {
      name: 'Lightning Rod Labs',
      networkSeed: '098rc1m-09384u-crm-29384u-cmkj',
      icon: {
        type: 'filesystem',
        path: './weave/lrl-icon.png',
      },
      creatingAgent: {
        agentIdx: 1,
        agentProfile: {
          nickname: 'Bob',
          avatar: {
            type: 'filesystem',
            path: './weave/zippy.jpg',
          },
        },
      },
      joiningAgents: [
        {
          agentIdx: 2,
          agentProfile: {
            nickname: 'Alita',
            avatar: {
              type: 'filesystem',
              path: './weave/zerbina.jpg',
            },
          },
        },
        // {
        //   agentIdx: 3,
        //   agentProfile: {
        //     nickname: 'Leo',
        //     avatar: {
        //       type: 'filesystem',
        //       path: './weave/zerbina.jpg',
        //     },
        //   },
        // },
      ],
      applets: [
        {
          name: 'Sweet',
          instanceName: 'Sweet',
          registeringAgent: 1,
          joiningAgents: [2],
        },
        // {
        //   name: 'gamez',
        //   instanceName: 'gamez',
        //   registeringAgent: 1,
        //   joiningAgents: [2],
        // },
        // {
        //   name: 'talking-stickies',
        //   instanceName: 'talking-stickies',
        //   registeringAgent: 1,
        //   joiningAgents: [2],
        // },
      ],
    },
  ],
  applets: [
    {
      name: 'Sweet',
      subtitle: 'Sweet',
      description: 'Real-time collaborative tables based on syn.',
      icon: {
        type: 'filesystem',
        path: './weave/calcy.svg',
      },
      source: {
        type: 'localhost',
        happPath: './workdir/calcy.happ',
        uiPort: 8888,
      },
    },
    // {
    //     name: 'gamez',
    //     subtitle: 'play!',
    //     description: 'Real-time games based on syn',
    //     icon: {
    //       type: "https",
    //       url: "https://raw.githubusercontent.com/holochain-apps/gamez/main/weave/gamez_icon.svg"
    //     },
    //     source: {
    //       type: "https",
    //       url: "https://github.com/holochain-apps/gamez/releases/download/v0.4.2/gamez.webhapp"
    //     },
    //   },
    //   {
    //   name: 'talking-stickies',
    //   subtitle: 'talking stickies',
    //   description: 'Real-time stickies based on syn',
    //   icon: {
    //     type: 'https',
    //     url: 'https://raw.githubusercontent.com/holochain-apps/talking-stickies/main/weave/talking-stickies_icon.png',
    //   },
    //   source: {
    //     type: 'https',
    //     url: 'https://github.com/holochain-apps/talking-stickies/releases/download/v0.9.1/talking-stickies.webhapp',
    //   },
    // },
  ],
});