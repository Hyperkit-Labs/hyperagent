"""Unit tests for spending controls manager"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.billing.spending_controls import SpendingControlsManager
from hyperagent.models.spending_control import SpendingControl


class TestSpendingControlsManager:
    """Test spending controls manager logic"""
    
    @pytest.fixture
    def manager(self):
        return SpendingControlsManager()
    
    @pytest.fixture
    def mock_db(self):
        db = AsyncMock(spec=AsyncSession)
        return db
    
    @pytest.fixture
    def mock_control(self):
        control = SpendingControl(
            wallet_address="0x1234",
            daily_limit=10.0,
            monthly_limit=100.0,
            daily_spent=5.0,
            monthly_spent=50.0,
            is_active=True
        )
        return control
    
    @pytest.mark.asyncio
    async def test_check_spending_limit_allowed(self, manager, mock_db, mock_control):
        """Test that spending is allowed when within limits"""
        with patch.object(manager, '_get_or_create_controls', return_value=mock_control):
            allowed, error = await manager.check_spending_limit(
                user_wallet="0x1234",
                amount_usdc=2.0,
                merchant="hyperagent",
                db=mock_db
            )
            
            assert allowed is True
            assert error is None
    
    @pytest.mark.asyncio
    async def test_check_spending_limit_daily_exceeded(self, manager, mock_db, mock_control):
        """Test that spending is blocked when daily limit exceeded"""
        mock_control.daily_spent = 9.0
        
        with patch.object(manager, '_get_or_create_controls', return_value=mock_control):
            allowed, error = await manager.check_spending_limit(
                user_wallet="0x1234",
                amount_usdc=2.0,
                merchant="hyperagent",
                db=mock_db
            )
            
            assert allowed is False
            assert "Daily limit exceeded" in error
    
    @pytest.mark.asyncio
    async def test_check_spending_limit_monthly_exceeded(self, manager, mock_db, mock_control):
        """Test that spending is blocked when monthly limit exceeded"""
        mock_control.monthly_spent = 99.0
        
        with patch.object(manager, '_get_or_create_controls', return_value=mock_control):
            allowed, error = await manager.check_spending_limit(
                user_wallet="0x1234",
                amount_usdc=2.0,
                merchant="hyperagent",
                db=mock_db
            )
            
            assert allowed is False
            assert "Monthly limit exceeded" in error
    
    @pytest.mark.asyncio
    async def test_check_spending_limit_merchant_whitelist(self, manager, mock_db, mock_control):
        """Test merchant whitelist enforcement"""
        mock_control.whitelist_merchants = ["hyperagent", "approved-merchant"]
        
        with patch.object(manager, '_get_or_create_controls', return_value=mock_control):
            allowed, error = await manager.check_spending_limit(
                user_wallet="0x1234",
                amount_usdc=2.0,
                merchant="unapproved-merchant",
                db=mock_db
            )
            
            assert allowed is False
            assert "not in whitelist" in error
    
    @pytest.mark.asyncio
    async def test_check_spending_limit_inactive(self, manager, mock_db, mock_control):
        """Test that inactive controls allow spending"""
        mock_control.is_active = False
        
        with patch.object(manager, '_get_or_create_controls', return_value=mock_control):
            allowed, error = await manager.check_spending_limit(
                user_wallet="0x1234",
                amount_usdc=2.0,
                merchant="hyperagent",
                db=mock_db
            )
            
            assert allowed is True
            assert error is None
    
    @pytest.mark.asyncio
    async def test_record_spending(self, manager, mock_db, mock_control):
        """Test recording spending increments counters"""
        initial_daily = mock_control.daily_spent
        initial_monthly = mock_control.monthly_spent
        
        with patch.object(manager, '_get_or_create_controls', return_value=mock_control):
            await manager.record_spending(
                user_wallet="0x1234",
                amount_usdc=2.0,
                db=mock_db
            )
            
            assert mock_control.daily_spent == initial_daily + 2.0
            assert mock_control.monthly_spent == initial_monthly + 2.0
            mock_db.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_update_limits(self, manager, mock_db, mock_control):
        """Test updating spending limits"""
        with patch.object(manager, '_get_or_create_controls', return_value=mock_control):
            updated = await manager.update_limits(
                user_wallet="0x1234",
                daily_limit=20.0,
                monthly_limit=200.0,
                db=mock_db
            )
            
            assert updated.daily_limit == 20.0
            assert updated.monthly_limit == 200.0
            mock_db.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_update_whitelist(self, manager, mock_db, mock_control):
        """Test updating merchant whitelist"""
        with patch.object(manager, '_get_or_create_controls', return_value=mock_control):
            updated = await manager.update_whitelist(
                user_wallet="0x1234",
                merchants=["merchant1", "merchant2"],
                db=mock_db
            )
            
            assert updated.whitelist_merchants == ["merchant1", "merchant2"]
            mock_db.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_toggle_active(self, manager, mock_db, mock_control):
        """Test toggling spending controls active state"""
        with patch.object(manager, '_get_or_create_controls', return_value=mock_control):
            updated = await manager.toggle_active(
                user_wallet="0x1234",
                is_active=False,
                db=mock_db
            )
            
            assert updated.is_active is False
            mock_db.commit.assert_called_once()


class TestSpendingControlModel:
    """Test SpendingControl model methods"""
    
    def test_needs_reset_daily(self):
        """Test that needs_reset detects expired daily reset time"""
        control = SpendingControl(
            wallet_address="0x1234",
            daily_limit=10.0,
            monthly_limit=100.0,
            daily_reset_at=datetime.utcnow() - timedelta(hours=1)
        )
        
        assert control.needs_reset() is True
    
    def test_needs_reset_monthly(self):
        """Test that needs_reset detects expired monthly reset time"""
        control = SpendingControl(
            wallet_address="0x1234",
            daily_limit=10.0,
            monthly_limit=100.0,
            monthly_reset_at=datetime.utcnow() - timedelta(days=35)
        )
        
        assert control.needs_reset() is True
    
    def test_reset_if_needed(self):
        """Test that reset_if_needed resets counters"""
        control = SpendingControl(
            wallet_address="0x1234",
            daily_limit=10.0,
            monthly_limit=100.0,
            daily_spent=5.0,
            monthly_spent=50.0,
            daily_reset_at=datetime.utcnow() - timedelta(hours=1),
            monthly_reset_at=datetime.utcnow() - timedelta(days=35)
        )
        
        control.reset_if_needed()
        
        assert control.daily_spent == 0.0
        assert control.monthly_spent == 0.0
    
    def test_can_spend_allowed(self):
        """Test can_spend allows spending within limits"""
        control = SpendingControl(
            wallet_address="0x1234",
            daily_limit=10.0,
            monthly_limit=100.0,
            daily_spent=5.0,
            monthly_spent=50.0,
            is_active=True
        )
        
        allowed, error = control.can_spend(2.0)
        
        assert allowed is True
        assert error is None
    
    def test_can_spend_daily_exceeded(self):
        """Test can_spend blocks when daily limit exceeded"""
        control = SpendingControl(
            wallet_address="0x1234",
            daily_limit=10.0,
            monthly_limit=100.0,
            daily_spent=9.0,
            monthly_spent=50.0,
            is_active=True
        )
        
        allowed, error = control.can_spend(2.0)
        
        assert allowed is False
        assert "Daily limit exceeded" in error
    
    def test_record_spending(self):
        """Test record_spending increments counters"""
        control = SpendingControl(
            wallet_address="0x1234",
            daily_limit=10.0,
            monthly_limit=100.0,
            daily_spent=5.0,
            monthly_spent=50.0
        )
        
        control.record_spending(2.0)
        
        assert control.daily_spent == 7.0
        assert control.monthly_spent == 52.0

