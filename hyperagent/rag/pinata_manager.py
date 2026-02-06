"""Pinata/IPFS manager for template storage using REST API"""

import json
import logging
import os
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)


class PinataManager:
    """
    Pinata Manager for IPFS Storage

    Concept: Decentralized storage for contract templates
    Logic: Upload templates to IPFS via Pinata REST API, retrieve by hash
    Benefits: Immutable storage, decentralized access
    API: https://docs.pinata.cloud/

    Note: Pinata does not have a Python SDK, so we use REST API directly
    """

    def __init__(self, pinata_jwt: str, pinata_gateway: Optional[str] = None):
        """
        Initialize Pinata Manager

        Args:
            pinata_jwt: Pinata JWT token from https://app.pinata.cloud/developers/api-keys
            pinata_gateway: Optional custom gateway URL (defaults to public gateway)
        """
        self.jwt = pinata_jwt
        self.gateway = pinata_gateway or "https://gateway.pinata.cloud"
        self.api_base = "https://api.pinata.cloud"
        self.headers = {"Authorization": f"Bearer {pinata_jwt}", "Content-Type": "application/json"}

    async def upload_file(
        self, file_path: str, name: Optional[str] = None, max_retries: int = 3
    ) -> Dict[str, Any]:
        """
        Upload file to Pinata/IPFS

        Args:
            file_path: Path to file to upload
            name: Optional custom name for the file

        Returns:
            Dict with IPFS hash (CID) and metadata

        API Endpoint: POST https://api.pinata.cloud/pinning/pinFileToIPFS
        """
        url = f"{self.api_base}/pinning/pinFileToIPFS"

        # Prepare file
        with open(file_path, "rb") as f:
            files = {"file": (name or os.path.basename(file_path), f)}

            # Metadata (optional)
            metadata = {
                "name": name or os.path.basename(file_path),
                "keyvalues": {"type": "contract_template", "source": "hyperagent"},
            }

            # Pinata API expects metadata as JSON string
            data = {"pinataMetadata": json.dumps(metadata)}

            # Upload headers (without Content-Type for multipart)
            upload_headers = {"Authorization": f"Bearer {self.jwt}"}

            # Retry logic with exponential backoff
            last_exception = None
            for attempt in range(max_retries):
                try:
                    response = requests.post(
                        url, files=files, data=data, headers=upload_headers, timeout=30
                    )

                    # Handle rate limiting
                    if response.status_code == 429:
                        retry_after = int(response.headers.get("Retry-After", 60))
                        if attempt < max_retries - 1:
                            logger.warning(f"Rate limited. Retrying after {retry_after} seconds...")
                            time.sleep(retry_after)
                            continue

                    response.raise_for_status()
                    return response.json()
                except requests.exceptions.RequestException as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        wait_time = 2**attempt  # Exponential backoff
                        logger.warning(
                            f"Upload failed (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {wait_time}s..."
                        )
                        time.sleep(wait_time)
                    else:
                        logger.error(f"Upload failed after {max_retries} attempts: {e}")
                        raise

    async def upload_json(self, data: Dict[str, Any], name: str) -> Dict[str, Any]:
        """
        Upload JSON data to Pinata/IPFS

        Args:
            data: Dictionary to upload as JSON
            name: Name for the JSON file

        Returns:
            Dict with IPFS hash (CID)

        API Endpoint: POST https://api.pinata.cloud/pinning/pinJSONToIPFS
        """
        url = f"{self.api_base}/pinning/pinJSONToIPFS"

        payload = {
            "pinataContent": data,
            "pinataMetadata": {
                "name": name,
                "keyvalues": {"type": "contract_template", "source": "hyperagent"},
            },
        }

        response = requests.post(url, json=payload, headers=self.headers)
        response.raise_for_status()
        return response.json()

    async def upload_template(self, name: str, content: str) -> str:
        """
        Upload contract template to Pinata/IPFS

        Args:
            name: Template name (e.g., "ERC20.sol")
            content: Template code content

        Returns:
            IPFS hash (CID)
        """
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".sol", delete=False) as tmp_file:
            tmp_file.write(content)
            tmp_path = tmp_file.name

        try:
            result = await self.upload_file(tmp_path, name)
            return result["IpfsHash"]  # CID
        finally:
            # Clean up temp file
            os.unlink(tmp_path)

    async def upload_template_with_metadata(
        self, name: str, content: str, metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Upload template with rich metadata

        Args:
            name: Template name (e.g., "ERC20.sol")
            content: Template code content
            metadata: Optional metadata dictionary

        Returns:
            Dict with IPFS hash, URL, size, and timestamp
        """
        import time

        # Create temporary file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".sol", delete=False) as tmp_file:
            tmp_file.write(content)
            tmp_path = tmp_file.name

        try:
            # Prepare metadata
            pinata_metadata = {
                "name": name,
                "keyvalues": {
                    "type": "contract_template",
                    "source": "hyperagent",
                    **(metadata or {}),
                },
            }

            # Upload file
            with open(tmp_path, "rb") as f:
                files = {"file": (name, f)}
                data = {"pinataMetadata": json.dumps(pinata_metadata)}

                upload_headers = {"Authorization": f"Bearer {self.jwt}"}
                url = f"{self.api_base}/pinning/pinFileToIPFS"

                response = requests.post(url, files=files, data=data, headers=upload_headers)
                response.raise_for_status()
                result = response.json()

            ipfs_hash = result.get("IpfsHash")
            pin_size = result.get("PinSize", len(content.encode("utf-8")))

            return {
                "ipfs_hash": ipfs_hash,
                "pinata_url": f"{self.gateway}/ipfs/{ipfs_hash}",
                "size": pin_size,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
        finally:
            os.unlink(tmp_path)

    async def verify_template_integrity(self, ipfs_hash: str, expected_content: str) -> bool:
        """
        Verify IPFS hash matches content

        Logic:
        1. Retrieve content from IPFS
        2. Compare with expected content
        3. Return True if match

        Args:
            ipfs_hash: IPFS hash (CID) to verify
            expected_content: Expected template content

        Returns:
            True if content matches, False otherwise
        """
        try:
            retrieved_content = await self.retrieve_template(ipfs_hash)
            return retrieved_content.strip() == expected_content.strip()
        except Exception as e:
            logger.error(f"Integrity verification failed: {e}")
            return False

    async def retrieve_template(self, ipfs_hash: str) -> str:
        """
        Retrieve template from IPFS via Pinata Gateway

        Args:
            ipfs_hash: IPFS hash (CID)

        Returns:
            Template code as string
        """
        try:
            url = f"{self.gateway}/ipfs/{ipfs_hash}"
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            return response.text
        except Exception as e:
            logger.error(f"Failed to retrieve template from IPFS: {e}")
            raise

    async def retrieve_file(self, ipfs_hash: str) -> bytes:
        """
        Retrieve file from IPFS via Pinata Gateway

        Args:
            ipfs_hash: IPFS hash (CID) of the file

        Returns:
            File content as bytes

        Gateway: https://gateway.pinata.cloud/ipfs/{hash}
        """
        url = f"{self.gateway}/ipfs/{ipfs_hash}"
        response = requests.get(url)
        response.raise_for_status()
        return response.content

    async def pin_by_hash(self, ipfs_hash: str, name: Optional[str] = None) -> Dict[str, Any]:
        """
        Pin existing IPFS content to Pinata

        Args:
            ipfs_hash: IPFS hash (CID) to pin
            name: Optional name for the pinned content

        Returns:
            Pin result
        """
        url = f"{self.api_base}/pinning/pinByHash"

        payload = {"hashToPin": ipfs_hash}

        if name:
            payload["pinataMetadata"] = {"name": name}

        response = requests.post(url, json=payload, headers=self.headers)
        response.raise_for_status()
        return response.json()

    async def unpin(self, ipfs_hash: str) -> bool:
        """
        Unpin content from Pinata

        Args:
            ipfs_hash: IPFS hash (CID) to unpin

        Returns:
            True if successful
        """
        url = f"{self.api_base}/pinning/unpin/{ipfs_hash}"
        response = requests.delete(url, headers=self.headers)
        return response.status_code == 200

    async def list_pins(self, limit: int = 10) -> Dict[str, Any]:
        """
        List pinned files

        Args:
            limit: Maximum number of results

        Returns:
            List of pinned files
        """
        url = f"{self.api_base}/data/pinList"
        params = {"pageLimit": limit, "status": "pinned"}
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        return response.json()
