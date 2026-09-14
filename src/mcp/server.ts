#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool
} from '@modelcontextprotocol/sdk/types.js';
import { CONFIG } from '../config.js';
import { createBasePublicClient, TRANSFER_EVENT_ABI } from '../middleware/payment402.js';
import { defaultReplayStore } from '../store/replayStore.js';
import { webExtractorService } from '../services/extractor.js';
import { parseEventLogs, type Address } from 'viem';

const server = new Server(
  {
    name: 'http-402-llm-extractor',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

const TOOLS: Tool[] = [
  {
    name: 'get_payment_info',
    description: 'Get instructions and pricing for using the clean web extractor tool (HTTP 402 micropayment on Base L2).',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'extract_clean_markdown',
    description: 'Extract noise-free, LLM-optimized Markdown from any web URL. Requires a 0.05 USDC payment transaction on Base L2.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The target web page URL to clean and extract.'
        },
        paymentTxHash: {
          type: 'string',
          description: 'The EVM transaction hash of the 0.05 USDC transfer to the agent on Base L2.'
        }
      },
      required: ['url']
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'get_payment_info') {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              protocol: 'HTTP 402',
              service: 'LLM Context Extractor',
              network: 'Base Mainnet',
              chainId: CONFIG.BASE_CHAIN_ID,
              token: 'USDC',
              tokenAddress: CONFIG.USDC_CONTRACT_ADDRESS,
              recipient: CONFIG.AGENT_PUBLIC_ADDRESS,
              priceUsdc: CONFIG.SERVICE_PRICE_USDC,
              instructions: `Send ${CONFIG.SERVICE_PRICE_USDC} USDC to ${CONFIG.AGENT_PUBLIC_ADDRESS} on Base L2, then call extract_clean_markdown with the transaction hash.`
            },
            null,
            2
          )
        }
      ]
    };
  }

  if (name === 'extract_clean_markdown') {
    const url = args?.url as string;
    const paymentTxHash = (args?.paymentTxHash as string)?.trim();

    if (!url) {
      return {
        isError: true,
        content: [{ type: 'text', text: 'Error: The "url" parameter is required.' }]
      };
    }

    // Si falta el hash de pago, devolver instrucciones 402 en MCP
    if (!paymentTxHash) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 402,
                error: 'Payment Required',
                network: 'Base',
                chainId: CONFIG.BASE_CHAIN_ID,
                token: CONFIG.USDC_CONTRACT_ADDRESS,
                recipient: CONFIG.AGENT_PUBLIC_ADDRESS,
                priceUsdc: CONFIG.SERVICE_PRICE_USDC,
                message: `Please send ${CONFIG.SERVICE_PRICE_USDC} USDC to ${CONFIG.AGENT_PUBLIC_ADDRESS} on Base L2, then provide the tx hash in paymentTxHash.`
              },
              null,
              2
            )
          }
        ]
      };
    }

    // Validar hash format
    const hashRegex = /^0x[a-fA-F0-9]{64}$/;
    if (!hashRegex.test(paymentTxHash)) {
      return {
        isError: true,
        content: [{ type: 'text', text: 'Error: Invalid paymentTxHash format. Expected 66-character 0x hex string.' }]
      };
    }

    const normalizedHash = paymentTxHash.toLowerCase() as `0x${string}`;

    // Chequeo Anti-Replay
    if (defaultReplayStore.has(normalizedHash)) {
      return {
        isError: true,
        content: [{ type: 'text', text: 'Error: Transaction hash has already been used. Replay attacks are prohibited.' }]
      };
    }

    // Verificar en Base L2
    try {
      const client = createBasePublicClient();
      const receipt = await client.getTransactionReceipt({ hash: normalizedHash });

      if (!receipt || receipt.status !== 'success') {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Error: Transaction reverted or not found on Base L2.' }]
        };
      }

      const transferLogs = parseEventLogs({
        abi: [TRANSFER_EVENT_ABI],
        eventName: 'Transfer',
        logs: receipt.logs
      });

      const validTransfers = transferLogs.filter(
        (log) =>
          log.address.toLowerCase() === CONFIG.USDC_CONTRACT_ADDRESS.toLowerCase() &&
          log.args.to.toLowerCase() === CONFIG.AGENT_PUBLIC_ADDRESS.toLowerCase()
      );

      const totalUnits = validTransfers.reduce((acc, log) => acc + log.args.value, 0n);
      if (totalUnits < CONFIG.PRICE_IN_UNITS) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error: Insufficient payment. Required: ${CONFIG.SERVICE_PRICE_USDC} USDC.` }]
        };
      }

      // Registrar hash para evitar reuso
      defaultReplayStore.record({
        txHash: normalizedHash,
        sender: validTransfers[0]?.args?.from,
        recipient: CONFIG.AGENT_PUBLIC_ADDRESS,
        amountUnits: totalUnits.toString(),
        amountUsdc: Number(totalUnits) / 10 ** CONFIG.USDC_DECIMALS,
        timestamp: Date.now(),
        endpoint: 'mcp://extract_clean_markdown',
        blockNumber: receipt.blockNumber?.toString()
      });

      // Ejecutar extracción
      const extracted = await webExtractorService.extract(url);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(extracted, null, 2)
          }
        ]
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Verification or extraction error: ${err.message}` }]
      };
    }
  }

  return {
    isError: true,
    content: [{ type: 'text', text: `Unknown tool: ${name}` }]
  };
});

export async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🤖 HTTP 402 MCP Server running on stdio transport.');
}

if (process.env.NODE_ENV !== 'test' && process.argv[1]?.includes('server.ts')) {
  startMcpServer().catch((err) => {
    console.error('Fatal MCP Server error:', err);
    process.exit(1);
  });
}
