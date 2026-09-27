"""
Base L2 HTTP 402 Markdown Extractor - Python Client SDK
Zero-KYC Autonomous Machine-to-Machine Web-to-Markdown API for AI Agents & LLMs.
"""

from __future__ import annotations
import os
import sys
import json
import time
from typing import Any, Dict, Optional
import requests

try:
    from web3 import Web3
    from eth_account import Account
except ImportError:
    Web3 = None
    Account = None

DEFAULT_API_URL = "https://base-http402-extractor-api.alluring-cheque.workers.dev"
DEFAULT_RPC_URL = "https://mainnet.base.org"
DEFAULT_RECIPIENT = "0x2231b680679FC790B5E676b0d566EF2EE4612414"
DEFAULT_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
BASE_CHAIN_ID = 8453

ERC20_TRANSFER_ABI = [
    {
        "constant": False,
        "inputs": [
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    }
]


class BaseExtractorClient:
    """
    Client for extracting LLM-ready clean Markdown from web pages with autonomous
    HTTP 402 micropayments on Base L2.
    """

    def __init__(
        self,
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        private_key: Optional[str] = None,
        rpc_url: Optional[str] = None,
    ):
        self.api_url = (api_url or os.getenv("PUBLIC_URL") or DEFAULT_API_URL).rstrip("/")
        self.api_key = api_key or os.getenv("EXTRACTOR_API_KEY")
        self.private_key = private_key or os.getenv("BASE_PRIVATE_KEY")
        self.rpc_url = rpc_url or os.getenv("BASE_RPC_URL") or DEFAULT_RPC_URL

    def extract_with_api_key(self, url: str, api_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract clean markdown directly using an API key or pre-purchased tank voucher.
        """
        key = api_key or self.api_key
        if not key:
            raise ValueError("extract_with_api_key requires an api_key.")

        headers = {
            "Content-Type": "application/json",
            "X-API-Key": key,
            "Authorization": f"Bearer {key}",
            "User-Agent": "BaseExtractor-Python-SDK/1.0"
        }

        response = requests.post(
            f"{self.api_url}/api/v1/extract",
            headers=headers,
            json={"url": url},
            timeout=30
        )

        try:
            data = response.json()
        except Exception:
            data = {}

        if response.status_code == 200 and data.get("success"):
            return data["data"]

        error_msg = data.get("message") or data.get("error") or response.text
        raise RuntimeError(f"Extraction failed [HTTP {response.status_code}]: {error_msg}")

    def extract_with_wallet(self, url: str, private_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract clean markdown with autonomous on-chain micropayment on Base L2.
        If the server returns HTTP 402, automatically transfers 0.05 USDC to the agent wallet,
        waits for confirmation on Base L2, and retries with X-Payment-Tx-Hash.
        """
        raw_key = private_key or self.private_key
        if not raw_key:
            raise ValueError("extract_with_wallet requires a private_key for Base L2.")

        if Web3 is None or Account is None:
            raise ImportError("Web3 and eth-account packages are required for wallet execution. Install via: pip install web3")

        # 1. First attempt (may pass under freemium tier or yield 402)
        headers = {
            "Content-Type": "application/json",
            "X-Free-Tier": "true",
            "User-Agent": "BaseExtractor-Python-SDK/1.0"
        }

        response = requests.post(
            f"{self.api_url}/api/v1/extract",
            headers=headers,
            json={"url": url},
            timeout=30
        )

        try:
            data = response.json()
        except Exception:
            data = {}

        if response.status_code == 200 and data.get("success"):
            return data["data"]

        # 2. Handle HTTP 402 Payment Required
        if response.status_code == 402:
            recipient = data.get("recipient") or DEFAULT_RECIPIENT
            token_address = data.get("token") or DEFAULT_USDC
            amount_units = int(data.get("amountUnits") or 50000)  # 0.05 USDC default

            w3 = Web3(Web3.HTTPProvider(self.rpc_url))
            if not w3.is_connected():
                raise ConnectionError(f"Could not connect to Base RPC at {self.rpc_url}")

            formatted_key = raw_key if raw_key.startswith("0x") else f"0x{raw_key}"
            sender_account = Account.from_key(formatted_key)
            sender_address = sender_account.address

            contract = w3.eth.contract(
                address=Web3.to_checksum_address(token_address),
                abi=ERC20_TRANSFER_ABI
            )

            nonce = w3.eth.get_transaction_count(sender_address)
            gas_price = w3.eth.gas_price

            tx = contract.functions.transfer(
                Web3.to_checksum_address(recipient),
                amount_units
            ).build_transaction({
                "chainId": BASE_CHAIN_ID,
                "from": sender_address,
                "nonce": nonce,
                "gasPrice": gas_price,
            })

            # Estimate gas or fallback
            try:
                estimated_gas = w3.eth.estimate_gas(tx)
                tx["gas"] = int(estimated_gas * 1.2)
            except Exception:
                tx["gas"] = 100000

            signed_tx = w3.eth.account.sign_transaction(tx, private_key=formatted_key)
            tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            tx_hash_hex = w3.to_hex(tx_hash)

            # Wait for block confirmation on Base L2
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
            if receipt.get("status") != 1:
                raise RuntimeError(f"Base L2 USDC transfer failed on-chain. TxHash: {tx_hash_hex}")

            # 3. Retry request with payment proof
            retry_headers = {
                "Content-Type": "application/json",
                "X-Payment-Tx-Hash": tx_hash_hex,
                "User-Agent": "BaseExtractor-Python-SDK/1.0"
            }

            retry_res = requests.post(
                f"{self.api_url}/api/v1/extract",
                headers=retry_headers,
                json={"url": url},
                timeout=30
            )

            try:
                retry_data = retry_res.json()
            except Exception:
                retry_data = {}

            if retry_res.status_code == 200 and retry_data.get("success"):
                return retry_data["data"]

            error_msg = retry_data.get("message") or retry_data.get("error") or retry_res.text
            raise RuntimeError(f"Retry with payment failed [HTTP {retry_res.status_code}]: {error_msg}")

        error_msg = data.get("message") or data.get("error") or response.text
        raise RuntimeError(f"Extraction failed [HTTP {response.status_code}]: {error_msg}")

    # Aliases matching camelCase naming for cross-language consistency
    extractWithApiKey = extract_with_api_key
    extractWithWallet = extract_with_wallet

    def extract(self, url: str) -> Dict[str, Any]:
        """
        Extract clean markdown using API key if available, otherwise wallet if available,
        or default to freemium evaluation quota.
        """
        if self.api_key:
            return self.extract_with_api_key(url)
        if self.private_key:
            return self.extract_with_wallet(url)

        headers = {
            "Content-Type": "application/json",
            "X-Free-Tier": "true",
            "User-Agent": "BaseExtractor-Python-SDK/1.0"
        }
        res = requests.post(
            f"{self.api_url}/api/v1/extract",
            headers=headers,
            json={"url": url},
            timeout=30
        )
        data = res.json() if res.status_code == 200 else {}
        if res.status_code == 200 and data.get("success"):
            return data["data"]

        raise RuntimeError(f"Extraction failed [HTTP {res.status_code}]: {data.get('message', 'Quota exceeded or payment required')}")


if __name__ == "__main__":
    test_url = sys.argv[1] if len(sys.argv) > 1 else "https://en.wikipedia.org/wiki/Autonomous_agent"
    print(f"Testing BaseExtractorClient with URL: {test_url}")
    client = BaseExtractorClient()
    try:
        result = client.extract(test_url)
        print(f"Success! Title: {result.get('title')}")
        print(f"Estimated Tokens: {result.get('estimatedTokens')}")
        print(f"Markdown preview (first 250 chars):\n{result.get('markdown', '')[:250]}...")
    except Exception as e:
        print(f"Extraction error: {e}")
