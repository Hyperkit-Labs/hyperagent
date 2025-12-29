"""Integration tests for EigenDA validation"""

import pytest
from hyperagent.blockchain.eigenda_client import EigenDAClient, EigenDAError


class TestEigenDAValidation:
    """Test EigenDA blob validation and submission"""
    
    @pytest.fixture
    def eigenda_client(self):
        return EigenDAClient(
            disperser_url="https://disperser.eigenda.xyz",
            use_authenticated=False
        )
    
    def test_validate_blob_size_minimum(self, eigenda_client):
        """Test that blobs below minimum size are padded"""
        small_data = b"x" * 1000
        
        validated = eigenda_client._validate_blob_size(small_data)
        
        assert len(validated) >= EigenDAClient.MIN_BLOB_SIZE
        assert len(validated) % EigenDAClient.ALIGNMENT_BYTES == 0
    
    def test_validate_blob_size_alignment(self, eigenda_client):
        """Test that blobs are padded to 32-byte alignment"""
        data = b"x" * (128 * 1024 + 17)
        
        validated = eigenda_client._validate_blob_size(data)
        
        assert len(validated) % EigenDAClient.ALIGNMENT_BYTES == 0
    
    def test_validate_blob_size_maximum(self, eigenda_client):
        """Test that blobs exceeding maximum size are rejected"""
        large_data = b"x" * (17 * 1024 * 1024)
        
        with pytest.raises(EigenDAError, match="exceeds maximum"):
            eigenda_client._validate_blob_size(large_data)
    
    def test_validate_blob_size_exact_minimum(self, eigenda_client):
        """Test blob at exact minimum size"""
        data = b"x" * (128 * 1024)
        
        validated = eigenda_client._validate_blob_size(data)
        
        assert len(validated) == 128 * 1024
    
    def test_validate_blob_size_exact_multiple_of_32(self, eigenda_client):
        """Test blob that is already a multiple of 32"""
        data = b"x" * (128 * 1024 + 64)
        
        validated = eigenda_client._validate_blob_size(data)
        
        assert len(validated) == 128 * 1024 + 64
    
    def test_validate_blob_size_padding_calculation(self, eigenda_client):
        """Test correct padding calculation"""
        data = b"x" * (128 * 1024 + 15)
        
        validated = eigenda_client._validate_blob_size(data)
        
        expected_padded = 128 * 1024 + 32
        assert len(validated) == expected_padded

