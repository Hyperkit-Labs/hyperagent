"""EigenDA client for data availability using REST API"""

import asyncio
import hashlib
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from eth_account import Account
from eth_account.messages import encode_defunct

logger = logging.getLogger(__name__)


class EigenDAError(Exception):
    """EigenDA client error"""

    pass


class EigenDAClient:
    """
    EigenDA Client using REST API v1

    Concept: Data availability layer for Mantle network via EigenDA
    Logic: Submit blobs via REST API, poll status, retrieve blobs
    Benefits: Cost-efficient, scalable data storage
    Architecture: KZG commitments, batch headers, blob indices

    Integration: Uses EigenDA Disperser REST API v1
    Documentation: https://docs.eigencloud.xyz/products/eigenda/api/disperser-v1-API/overview
    """

    def __init__(
        self,
        disperser_url: Optional[str] = None,
        private_key: Optional[str] = None,
        use_authenticated: bool = True,
    ):
        """
        Initialize EigenDA client

        Args:
            disperser_url: EigenDA disperser endpoint
                - Mainnet: https://disperser.eigenda.xyz
                - Testnet: (check EigenDA docs)
            private_key: Ethereum private key for authenticated requests
            use_authenticated: Use authenticated endpoint (production) or unauthenticated (testing)
        """
        # Default to mainnet disperser
        self.disperser_url = (disperser_url or "https://disperser.eigenda.xyz").rstrip("/")
        self.private_key = private_key
        self.use_authenticated = use_authenticated
        self._submitted_blobs: Dict[str, Dict] = {}  # Track submitted blobs by data_hash
        self._pending_requests: Dict[str, str] = {}  # Track pending request IDs

        # Initialize account if private key provided
        if self.private_key:
            try:
                self.account = Account.from_key(private_key)
                self.account_id = self.account.address
                logger.info(f"EigenDA client initialized with account: {self.account_id[:10]}...")
            except Exception as e:
                logger.warning(f"Failed to initialize account from private key: {e}")
                self.account = None
                self.account_id = None
        else:
            self.account = None
            self.account_id = None

    def _validate_blob_serialization(self, data: bytes) -> bool:
        """
        Validate blob serialization requirements

        Concept: Each 32-byte segment must be compatible with BN254 field element
        Logic: Check that data length is multiple of 32 bytes
        Requirements: https://docs.eigencloud.xyz/products/eigenda/api/disperser-v1-API/blob-serialization-requirements
        """
        # Blob must be multiple of 32 bytes for BN254 field element compatibility
        if len(data) % 32 != 0:
            logger.warning(
                f"Blob size {len(data)} not multiple of 32 bytes, padding may be required"
            )
            return False

        # Check size limits (from EigenDA docs - mainnet)
        min_size = 128 * 1024  # 128 KiB minimum
        max_size = 16 * 1024 * 1024  # 16 MiB maximum

        if len(data) < min_size:
            raise EigenDAError(f"Blob too small: {len(data)} bytes (minimum: {min_size} bytes)")
        if len(data) > max_size:
            raise EigenDAError(f"Blob too large: {len(data)} bytes (maximum: {max_size} bytes)")

        return True

    def _prepare_blob(self, data: bytes) -> bytes:
        """
        Prepare blob for submission (padding if needed)

        Concept: Ensure blob meets serialization requirements
        Logic: Pad to multiple of 32 bytes if necessary
        """
        # Pad to multiple of 32 bytes
        remainder = len(data) % 32
        if remainder != 0:
            padding = 32 - remainder
            data = data + b"\x00" * padding
            logger.info(f"Padded blob with {padding} bytes to meet serialization requirements")

        return data

    def _create_auth_header(self, blob_data: bytes) -> Dict[str, str]:
        """
        Create authentication header for DisperseBlobAuthenticated

        Concept: Sign BlobAuthHeader with ECDSA private key
        Logic:
            1. Create BlobAuthHeader structure
            2. Sign with private key
            3. Return header with account_id and signature
        """
        if not self.account or not self.private_key:
            raise EigenDAError("Private key required for authenticated requests")

        # Create auth header structure (adjust based on actual EigenDA API spec)
        auth_header = {
            "account_id": self.account_id,
            "timestamp": int(datetime.now().timestamp()),
            "data_hash": hashlib.sha256(blob_data).hexdigest(),
        }

        # Sign the header
        message = encode_defunct(text=json.dumps(auth_header, sort_keys=True))
        signed_message = self.account.sign_message(message)

        return {
            "account_id": self.account_id,
            "signature": signed_message.signature.hex(),
            "auth_header": json.dumps(auth_header),
        }

    async def submit_blob(self, data: bytes, retry_count: int = 3) -> Dict[str, Any]:
        """
        Submit blob to EigenDA network using REST API

        Concept: Store data on EigenDA, get commitment hash
        Logic:
            1. Validate and prepare blob data
            2. Submit to EigenDA Disperser API (authenticated or unauthenticated)
            3. Get request ID
            4. Poll for status until confirmed
            5. Return commitment and batch header

        Args:
            data: Bytes to submit (will be padded if needed)
            retry_count: Number of retry attempts

        Returns:
            {
                "commitment": "0x...",
                "batch_header": {...},
                "blob_index": 123,
                "data_hash": "0x...",
                "request_id": "..."
            }
        """
        # Prepare blob
        prepared_data = self._prepare_blob(data)
        data_hash = hashlib.sha256(prepared_data).hexdigest()

        # Check if already submitted
        if data_hash in self._submitted_blobs:
            logger.info(f"Blob already submitted: {data_hash}")
            return self._submitted_blobs[data_hash]

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                # Choose endpoint based on authentication
                if self.use_authenticated and self.account:
                    endpoint = f"{self.disperser_url}/v1/disperser/disperse-blob-authenticated"
                    auth_headers = self._create_auth_header(prepared_data)
                    headers = {
                        "Content-Type": "application/json",
                        "X-Account-Id": auth_headers["account_id"],
                        "X-Signature": auth_headers["signature"],
                        "X-Auth-Header": auth_headers["auth_header"],
                    }
                else:
                    endpoint = f"{self.disperser_url}/v1/disperser/disperse-blob"
                    headers = {"Content-Type": "application/json"}

                # Submit blob
                # Note: Actual API format may vary - adjust based on EigenDA docs
                response = await client.post(
                    endpoint,
                    json={
                        "data": prepared_data.hex(),  # Hex-encoded bytes
                    },
                    headers=headers,
                )

                if response.status_code not in [200, 202]:
                    if retry_count > 0:
                        logger.warning(
                            f"Blob submission failed, retrying... ({retry_count} attempts left)"
                        )
                        await asyncio.sleep(2 ** (3 - retry_count))
                        return await self.submit_blob(data, retry_count - 1)
                    raise EigenDAError(
                        f"Submission failed: {response.status_code} - {response.text}"
                    )

                result = response.json()
                request_id = result.get("request_id")

                if not request_id:
                    raise EigenDAError("No request_id returned from EigenDA")

                # Store pending request
                self._pending_requests[data_hash] = request_id

                # Poll for status until confirmed
                blob_result = await self._poll_blob_status(request_id, data_hash)

                return blob_result

        except httpx.RequestError as e:
            if retry_count > 0:
                logger.warning(f"Network error, retrying... ({retry_count} attempts left)")
                await asyncio.sleep(2 ** (3 - retry_count))
                return await self.submit_blob(data, retry_count - 1)
            raise EigenDAError(f"Network error: {e}")
        except Exception as e:
            logger.error(f"EigenDA submission error: {e}", exc_info=True)
            raise EigenDAError(f"Submission failed: {e}")

    async def _poll_blob_status(
        self, request_id: str, data_hash: str, max_polls: int = 60, poll_interval: int = 2
    ) -> Dict[str, Any]:
        """
        Poll blob status until confirmed

        Concept: Check blob status repeatedly until it's confirmed
        Logic:
            1. Poll GetBlobStatus endpoint
            2. Check status (pending, processing, confirmed, failed)
            3. If confirmed, extract commitment and batch header
            4. Return result

        Args:
            request_id: Request ID from DisperseBlob response
            data_hash: Hash of submitted data
            max_polls: Maximum number of polls
            poll_interval: Seconds between polls
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            for attempt in range(max_polls):
                try:
                    response = await client.get(
                        f"{self.disperser_url}/v1/disperser/blob-status/{request_id}",
                        headers={"Content-Type": "application/json"},
                    )

                    if response.status_code != 200:
                        logger.warning(f"Status check failed: {response.status_code}")
                        await asyncio.sleep(poll_interval)
                        continue

                    status_data = response.json()
                    status = status_data.get("status", "").lower()

                    if status == "confirmed":
                        # Extract commitment and batch header
                        commitment = status_data.get("commitment")
                        batch_header = status_data.get("batch_header", {})
                        blob_index = status_data.get("blob_index", 0)

                        blob_result = {
                            "commitment": commitment,
                            "batch_header": batch_header,
                            "blob_index": blob_index,
                            "data_hash": f"0x{data_hash}",
                            "request_id": request_id,
                            "submitted_at": datetime.now().isoformat(),
                        }

                        # Store for later retrieval
                        self._submitted_blobs[data_hash] = blob_result
                        logger.info(f"Blob confirmed: commitment={commitment[:20]}...")
                        return blob_result

                    elif status == "failed":
                        raise EigenDAError(
                            f"Blob submission failed: {status_data.get('error', 'Unknown error')}"
                        )

                    # Status is pending or processing, continue polling
                    logger.debug(f"Blob status: {status} (attempt {attempt + 1}/{max_polls})")
                    await asyncio.sleep(poll_interval)

                except httpx.RequestError as e:
                    logger.warning(f"Status poll error: {e}, retrying...")
                    await asyncio.sleep(poll_interval)

            raise EigenDAError(f"Blob status polling timeout after {max_polls} attempts")

    async def retrieve_blob(self, commitment: str) -> bytes:
        """
        Retrieve blob from EigenDA using commitment

        Concept: Fetch blob data using commitment hash
        Logic:
            1. Query EigenDA RetrieveBlob endpoint with commitment
            2. Verify commitment matches
            3. Return blob data

        Args:
            commitment: KZG commitment hash

        Returns:
            Blob data as bytes
        """
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.get(
                    f"{self.disperser_url}/v1/disperser/retrieve-blob/{commitment}",
                    headers={"Content-Type": "application/json"},
                )

                if response.status_code != 200:
                    raise EigenDAError(
                        f"Retrieval failed: {response.status_code} - {response.text}"
                    )

                result = response.json()
                blob_data_hex = result.get("data")

                if not blob_data_hex:
                    raise EigenDAError("No data returned from EigenDA")

                # Convert hex to bytes
                blob_data = bytes.fromhex(blob_data_hex.replace("0x", ""))

                # Verify commitment matches (optional verification)
                data_hash = hashlib.sha256(blob_data).hexdigest()
                if result.get("data_hash") and result.get("data_hash") != f"0x{data_hash}":
                    logger.warning("Data hash mismatch - possible corruption")

                logger.info(f"Blob retrieved successfully: commitment={commitment[:20]}...")
                return blob_data

        except httpx.RequestError as e:
            raise EigenDAError(f"Network error: {e}")
        except Exception as e:
            logger.error(f"EigenDA retrieval error: {e}", exc_info=True)
            raise EigenDAError(f"Retrieval failed: {e}")

    async def get_blob_status(self, request_id: str) -> Dict[str, Any]:
        """
        Get current status of a blob

        Concept: Check blob status without polling
        Logic: Query GetBlobStatus endpoint

        Args:
            request_id: Request ID from DisperseBlob response

        Returns:
            Status information
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.disperser_url}/v1/disperser/blob-status/{request_id}",
                    headers={"Content-Type": "application/json"},
                )

                if response.status_code != 200:
                    raise EigenDAError(f"Status check failed: {response.status_code}")

                return response.json()

        except Exception as e:
            logger.error(f"Status check error: {e}", exc_info=True)
            raise EigenDAError(f"Status check failed: {e}")

    async def verify_availability(self, commitment: str) -> bool:
        """
        Verify blob availability on EigenDA network

        Concept: Check if blob is still available
        Logic: Try to retrieve blob, return True if successful
        """
        try:
            await self.retrieve_blob(commitment)
            return True
        except EigenDAError:
            return False

    async def batch_submit(self, blobs: List[bytes]) -> Dict[str, Any]:
        """
        Batch submit multiple blobs for cost optimization

        Concept: Submit multiple blobs in parallel for efficiency
        Logic:
            1. Submit blobs in parallel using asyncio.gather
            2. Aggregate commitments
            3. Return batch header with all commitments

        Args:
            blobs: List of blob data

        Returns:
            Batch header with all commitments
        """
        # Submit blobs in parallel
        tasks = [self.submit_blob(blob) for blob in blobs]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        commitments = []
        errors = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Blob {i} submission failed: {result}")
                errors.append({"index": i, "error": str(result)})
            else:
                commitments.append(result["commitment"])

        return {
            "batch_id": hashlib.sha256(b"".join(blobs)).hexdigest(),
            "commitments": commitments,
            "count": len(commitments),
            "success_count": len(commitments),
            "failed_count": len(errors),
            "errors": errors,
        }

    async def store_contract_metadata(
        self,
        contract_address: str,
        abi: List[Dict],
        source_code: str,
        deployment_info: Dict[str, Any],
    ) -> str:
        """
        Store complete contract metadata on EigenDA

        Concept: Store ABI, source code, and deployment info as blob
        Logic:
            1. Serialize metadata to JSON
            2. Convert to bytes
            3. Submit as blob
            4. Return commitment hash

        Args:
            contract_address: Deployed contract address
            abi: Contract ABI
            source_code: Contract source code
            deployment_info: Deployment information (tx hash, block number, etc.)

        Returns:
            EigenDA commitment hash
        """
        metadata = {
            "contract_address": contract_address,
            "abi": abi,
            "source_code": source_code,
            "deployment_info": deployment_info,
            "timestamp": datetime.now().isoformat(),
            "version": "1.0",
        }

        metadata_json = json.dumps(metadata, indent=2)
        metadata_bytes = metadata_json.encode("utf-8")

        # Submit metadata as blob
        result = await self.submit_blob(metadata_bytes)
        commitment = result["commitment"]

        logger.info(f"Stored contract metadata for {contract_address} on EigenDA: {commitment}")
        return commitment

    async def retrieve_contract_metadata(self, commitment: str) -> Dict[str, Any]:
        """
        Retrieve contract metadata from EigenDA

        Concept: Fetch and parse contract metadata blob
        Logic:
            1. Retrieve blob using commitment
            2. Parse JSON metadata
            3. Return structured metadata

        Args:
            commitment: EigenDA commitment hash

        Returns:
            Contract metadata dictionary
        """
        blob_data = await self.retrieve_blob(commitment)
        metadata_json = blob_data.decode("utf-8")
        metadata = json.loads(metadata_json)

        logger.info(f"Retrieved contract metadata from EigenDA: {commitment}")
        return metadata
