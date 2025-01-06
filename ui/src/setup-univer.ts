import '@univerjs/design/lib/index.css'
import '@univerjs/ui/lib/index.css'
import '@univerjs/docs-hyper-link-ui/lib/index.css'
import '@univerjs/drawing-ui/lib/index.css'
import '@univerjs/docs-drawing-ui/lib/index.css'

import type { DocumentDataModel, IDocumentData } from '@univerjs/core'
import { DocumentFlavor, Tools, LocaleType, LogLevel, Univer, UniverInstanceType } from '@univerjs/core'
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

const locales = {
    [LocaleType.EN_US]: Tools.deepMerge(
      UniverSheetsEnUS,
      UniverDocsUIEnUS,
      UniverSheetsUIEnUS,
      UniverUiEnUS,
      UniverDesignEnUS,
      DocsHyperLinkUIEnUS,
      DrawingUIEnUS,
      DocsDrawingUIEnUS,
    ),
}
  
export async function setupUniverDocs() {
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

  // drawing plugins
  univer.registerPlugin(UniverDrawingPlugin)
  univer.registerPlugin(UniverDrawingUIPlugin)
  univer.registerPlugin(UniverDocsDrawingPlugin)
  univer.registerPlugin(UniverDocsDrawingUIPlugin)

  setTimeout(() => {
    univer.createUnit<IDocumentData, DocumentDataModel>(UniverInstanceType.UNIVER_DOC, {
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

  return univerAPI
}
