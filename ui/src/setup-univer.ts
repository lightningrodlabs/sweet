import '@univerjs/design/lib/index.css'
import '@univerjs/ui/lib/index.css'
import '@univerjs/docs-hyper-link-ui/lib/index.css'
import '@univerjs/drawing-ui/lib/index.css'
import '@univerjs/docs-drawing-ui/lib/index.css'

import type { DocumentDataModel, IDocumentData } from '@univerjs/core'
import { DocumentFlavor, Tools, LocaleType, LogLevel, Univer, UniverInstanceType, merge } from '@univerjs/core'
import { defaultTheme } from '@univerjs/design'
import { UniverDocsPlugin } from '@univerjs/docs'
import { UniverDocsUIPlugin } from '@univerjs/docs-ui'
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula'
import { UniverRenderEnginePlugin, ptToPixel } from '@univerjs/engine-render'
import { UniverUIPlugin } from '@univerjs/ui'
import { UniverDocsHyperLinkPlugin } from '@univerjs/docs-hyper-link'
import { UniverDocsHyperLinkUIPlugin } from '@univerjs/docs-hyper-link-ui'
import { UniverDrawingPlugin } from '@univerjs/drawing'
import { UniverDrawingUIPlugin } from '@univerjs/drawing-ui'
import { UniverDocsDrawingPlugin } from '@univerjs/docs-drawing'
import { UniverDocsDrawingUIPlugin } from '@univerjs/docs-drawing-ui'
import { UniverThreadCommentUIPlugin } from '@univerjs/thread-comment-ui';
import { UniverThreadCommentPlugin } from '@univerjs/thread-comment';
import { UniverDocsThreadCommentUIPlugin } from '@univerjs/docs-thread-comment-ui';
// import { UniverDocsMentionUIPlugin } from '@univerjs/docs-mention-ui';

// sheets imports
import { UniverSheetsPlugin } from "@univerjs/sheets";
import { UniverSheetsUIPlugin } from "@univerjs/sheets-ui";
import { UniverSheetsFormulaPlugin } from "@univerjs/sheets-formula";
import { UniverSheetsFormulaUIPlugin } from "@univerjs/sheets-formula-ui";
// import { UniverSheetsNumfmtPlugin } from "@univerjs/sheets-numfmt";
// import { UniverSheetsNumfmtUIPlugin } from "@univerjs/sheets-numfmt-ui";

import DesignEnUS from '@univerjs/design/locale/en-US';
import UIEnUS from '@univerjs/ui/locale/en-US';
import DocsUIEnUS from '@univerjs/docs-ui/locale/en-US';
import SheetsEnUS from '@univerjs/sheets/locale/en-US';
import SheetsUIEnUS from '@univerjs/sheets-ui/locale/en-US';
import SheetsFormulaUIEnUS from '@univerjs/sheets-formula-ui/locale/en-US';
// import SheetsNumfmtUIEnUS from '@univerjs/sheets-numfmt-ui/locale/en-US';

import '@univerjs/engine-formula/facade';
import '@univerjs/ui/facade';
import '@univerjs/docs-ui/facade';
import '@univerjs/sheets/facade';
import '@univerjs/sheets-ui/facade';
import '@univerjs/sheets-formula/facade';
// import '@univerjs/sheets-numfmt/facade';
 
import "@univerjs/design/lib/index.css";
import "@univerjs/ui/lib/index.css";
import "@univerjs/docs-ui/lib/index.css";
import "@univerjs/sheets-ui/lib/index.css";
import "@univerjs/sheets-formula-ui/lib/index.css";
// import "@univerjs/sheets-numfmt-ui/lib/index.css"; 

// import { UniverSheetsPlugin } from "@univerjs/sheets";
// import { UniverSheetsFormulaPlugin } from "@univerjs/sheets-formula";
// import { UniverSheetsUIPlugin } from "@univerjs/sheets-ui";
import { UniverSheetsConditionalFormattingPlugin } from '@univerjs/sheets-conditional-formatting';
import { UniverSheetsFilterPlugin } from '@univerjs/sheets-filter';
// import { UniverSheetsFormulaUIPlugin } from '@univerjs/sheets-formula-ui';
import { UniverSheetsHyperLinkPlugin } from '@univerjs/sheets-hyper-link';
import { UniverSheetsConditionalFormattingUIPlugin } from '@univerjs/sheets-conditional-formatting-ui';
import { UniverSheetsThreadCommentPlugin } from '@univerjs/sheets-thread-comment';
// import { UniverDebuggerPlugin } from '@univerjs/debugger';
import { UniverSheetsHyperLinkUIPlugin } from '@univerjs/sheets-hyper-link-ui';
// import { IThreadCommentMentionDataService, UniverThreadCommentUIPlugin } from '@univerjs/thread-comment-ui';
// import { UniverSheetsThreadCommentBasePlugin } from '@univerjs/sheets-thread-comment-base';
import type { IUniverRPCMainThreadConfig } from '@univerjs/rpc';
import { UniverRPCMainThreadPlugin } from '@univerjs/rpc';
// import { UniverSheetsNumfmtPlugin } from '@univerjs/sheets-numfmt';
import { UniverSheetsDataValidationPlugin } from '@univerjs/sheets-data-validation';
import { UniverSheetsDrawingUIPlugin } from '@univerjs/sheets-drawing-ui';
import { UniverSheetsZenEditorPlugin } from '@univerjs/sheets-zen-editor';
import { UniverSheetsSortPlugin } from '@univerjs/sheets-sort';
import { UniverSheetsSortUIPlugin } from '@univerjs/sheets-sort-ui';

import { FUniver } from '@univerjs/facade'
import { convertPureStringToUDM } from './util'

import UniverDesignEnUS from '@univerjs/design/locale/en-US'
import UniverDocsUIEnUS from '@univerjs/docs-ui/locale/en-US'
import UniverSheetsEnUS from '@univerjs/sheets/locale/en-US'
import UniverSheetsUIEnUS from '@univerjs/sheets-ui/locale/en-US'
import UniverUiEnUS from '@univerjs/ui/locale/en-US'
import DocsHyperLinkUIEnUS from '@univerjs/docs-hyper-link-ui/locale/en-US'
import DrawingUIEnUS from '@univerjs/drawing-ui/locale/en-US'
import DocsDrawingUIEnUS from '@univerjs/docs-drawing-ui/locale/en-US'
import ThreadCommentUIEnUS from '@univerjs/thread-comment-ui/locale/en-US';

const locales = {
    [LocaleType.EN_US]: merge(
      {},
      DesignEnUS,
      UIEnUS,
      DocsUIEnUS,
      SheetsEnUS,
      SheetsUIEnUS,
      SheetsFormulaUIEnUS,
      // SheetsNumfmtUIEnUS,
      UniverSheetsEnUS,
      UniverDocsUIEnUS,
      UniverSheetsUIEnUS,
      UniverUiEnUS,
      UniverDesignEnUS,
      DocsHyperLinkUIEnUS,
      DrawingUIEnUS,
      DocsDrawingUIEnUS,
      ThreadCommentUIEnUS,
    ),
}

  
export async function setupUniverDocs(starterData) {
  const univer = new Univer({
    theme: defaultTheme,
    locale: LocaleType.EN_US,
    logLevel: LogLevel.VERBOSE,
    locales,
  })

  // core plugins
  univer.registerPlugin(UniverRenderEnginePlugin)
  univer.registerPlugin(UniverFormulaEnginePlugin)
  univer.registerPlugin(UniverUIPlugin, {
    container: 'univer',
    header: true,
    footer: false,
  })
  univer.registerPlugin(UniverDocsPlugin)
  univer.registerPlugin(UniverDocsUIPlugin, {
    container: 'univerdoc',
    layout: {
      docContainerConfig: {
        innerLeft: false,
      },
    },
  })

  // hyper link plugins
  univer.registerPlugin(UniverDocsHyperLinkPlugin)
  univer.registerPlugin(UniverDocsHyperLinkUIPlugin)

  // drawing plugins (allows image upload and placement)
  univer.registerPlugin(UniverDrawingPlugin)
  univer.registerPlugin(UniverDrawingUIPlugin)
  univer.registerPlugin(UniverDocsDrawingPlugin)
  univer.registerPlugin(UniverDocsDrawingUIPlugin)

  // comment plugins
  univer.registerPlugin(UniverThreadCommentPlugin);
  univer.registerPlugin(UniverDocsThreadCommentUIPlugin);
  univer.registerPlugin(UniverThreadCommentUIPlugin);
  // univer.registerPlugin(UniverDocsMentionUIPlugin);

  setTimeout(() => {
    console.log(starterData)
    univer.createUnit<IDocumentData, DocumentDataModel>(UniverInstanceType.UNIVER_DOC, starterData ? starterData : {
      body: convertPureStringToUDM(''),
      drawings: {},
      drawingsOrder: [],
      headers: {},
      footers: {},
      tableSource: {},
      documentStyle: {
        documentFlavor: DocumentFlavor.TRADITIONAL, // enable header and footer
        pageSize: {
          width: ptToPixel(595),
          height: ptToPixel(842),
        },
        marginTop: ptToPixel(50),
        marginBottom: ptToPixel(50),
        marginRight: ptToPixel(40),
        marginLeft: ptToPixel(40),
        renderConfig: {
          vertexAngle: 0,
          centerAngle: 0,
        },
        defaultHeaderId: '',
        defaultFooterId: '',
        evenPageHeaderId: '',
        evenPageFooterId: '',
        firstPageHeaderId: '',
        firstPageFooterId: '',
      },
    })
  }, 0)

  const univerAPI = FUniver.newAPI(univer)

  return [univerAPI, univer]
}

export async function setupUniverSheets() {
  const univer = new Univer({
    theme: defaultTheme,
    locale: LocaleType.EN_US,
    logLevel: LogLevel.VERBOSE,
    locales,
  })


  // core plugins
  univer.registerPlugin(UniverRenderEnginePlugin)
  univer.registerPlugin(UniverFormulaEnginePlugin)
  univer.registerPlugin(UniverUIPlugin, {
    container: 'univer',
    header: true,
    toolbar: true,
    footer: false,
  })


  // sheets plugins
  univer.registerPlugin(UniverSheetsFormulaUIPlugin);
  univer.registerPlugin(UniverSheetsConditionalFormattingPlugin);
  univer.registerPlugin(UniverSheetsFilterPlugin);
  univer.registerPlugin(UniverSheetsHyperLinkPlugin);
  // univer.registerPlugin(UniverThreadCommentUIPlugin);
  // univer.registerPlugin(UniverSheetsThreadCommentPlugin);

  univer.registerPlugin(UniverSheetsPlugin, {
      notExecuteFormula: false,
  });
  univer.registerPlugin(UniverSheetsUIPlugin);
  // univer.registerPlugin(UniverSheetsNumfmtPlugin);
  univer.registerPlugin(UniverSheetsZenEditorPlugin);
  // univer.registerPlugin(UniverFormulaEnginePlugin, {
  //     notExecuteFormula: false,
  // });
  univer.registerPlugin(UniverSheetsFormulaPlugin);
  // univer.registerPlugin(UniverRPCMainThreadPlugin, {
  //     workerURL: './worker.js',
  // } as IUniverRPCMainThreadConfig);
  univer.registerPlugin(UniverSheetsHyperLinkUIPlugin);
  univer.registerPlugin(UniverSheetsDataValidationPlugin);
  univer.registerPlugin(UniverSheetsSortPlugin);
  univer.registerPlugin(UniverSheetsSortUIPlugin);
  univer.registerPlugin(UniverSheetsConditionalFormattingUIPlugin);
  univer.registerPlugin(UniverSheetsDrawingUIPlugin);



  // univer.registerPlugin(UniverSheetsPlugin)
  // univer.registerPlugin(UniverSheetsUIPlugin, {
  //   container: 'univerdoc',
  //   layout: {
  //     docContainerConfig: {
  //       innerLeft: false,
  //     },
  //   },
  // })

  setTimeout(() => {
    univer.createUnit(UniverInstanceType.UNIVER_SHEET, {})
  }, 0)

  const univerAPI = FUniver.newAPI(univer)

  return [univerAPI, univer]
}