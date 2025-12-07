#!/usr/bin/env python3
"""
Rollback Script

Concept: Rollback deployment to previous version
Logic: Restore database, revert code, restart services
Security: Validate rollback safety before execution
"""
import os
import sys
import asyncio
import subprocess
import argparse
from pathlib import Path
from datetime import datetime
import json

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


class RollbackManager:
    """
    Rollback Manager
    
    Concept: Safe rollback to previous deployment
    Logic: Version tracking → Backup verification → Rollback execution
    """
    
    def __init__(self):
        self.backup_dir = Path(os.getenv("BACKUP_DIR", project_root / "backups"))
        self.deployment_history_file = self.backup_dir / "deployment_history.json"
    
    async def rollback(self, target_version: str = None, steps: int = 1) -> bool:
        """
        Rollback to previous version
        
        Args:
            target_version: Specific version to rollback to
            steps: Number of versions to rollback (default: 1)
        
        Returns:
            bool: True if rollback successful
        """
        print("[*] Starting rollback process...")
        
        # Load deployment history
        history = self._load_history()
        
        if not history:
            print("[-] No deployment history found")
            return False
        
        # Determine target version
        if target_version:
            target = next((d for d in history if d["version"] == target_version), None)
            if not target:
                print(f"[-] Version {target_version} not found in history")
                return False
        else:
            # Rollback N steps
            if len(history) < steps + 1:
                print(f"[-] Cannot rollback {steps} steps, only {len(history)} deployments")
                return False
            target = history[-steps - 1]
        
        print(f"[*] Rolling back to version: {target['version']}")
        print(f"[*] Deployment time: {target['timestamp']}")
        
        # Pre-rollback checks
        if not await self._pre_rollback_checks():
            print("[-] Pre-rollback checks failed")
            return False
        
        try:
            # Step 1: Restore database backup
            if target.get("backup_file"):
                print("[*] Restoring database backup...")
                if not await self._restore_database(target["backup_file"]):
                    print("[-] Database restore failed")
                    return False
            
            # Step 2: Revert code version
            print("[*] Reverting code version...")
            if not await self._revert_code(target["version"]):
                print("[-] Code revert failed")
                return False
            
            # Step 3: Run migrations (if needed)
            print("[*] Running migrations...")
            if not await self._run_migrations():
                print("[-] Migrations failed")
                return False
            
            # Step 4: Restart services
            print("[*] Restarting services...")
            if not await self._restart_services():
                print("[-] Service restart failed")
                return False
            
            # Step 5: Verify rollback
            print("[*] Verifying rollback...")
            if not await self._verify_rollback():
                print("[-] Rollback verification failed")
                return False
            
            print("[+] Rollback completed successfully")
            return True
            
        except Exception as e:
            print(f"[-] Rollback failed: {e}")
            return False
    
    def _load_history(self) -> list:
        """Load deployment history"""
        if not self.deployment_history_file.exists():
            return []
        
        with open(self.deployment_history_file) as f:
            return json.load(f)
    
    async def _pre_rollback_checks(self) -> bool:
        """Pre-rollback safety checks"""
        print("[*] Running pre-rollback checks...")
        
        # Check if rollback is safe
        try:
            # Check for active workflows
            from hyperagent.db.session import get_db
            from hyperagent.models.workflow import Workflow
            from sqlalchemy import select
            from sqlalchemy.ext.asyncio import AsyncSession
            
            async for db in get_db():
                result = await db.execute(
                    select(Workflow).where(
                        Workflow.status.in_(["running", "pending"])
                    )
                )
                active_workflows = result.scalars().all()
                
                if active_workflows:
                    print(f"[!] Warning: {len(active_workflows)} active workflows found")
                    print("[!] Consider waiting for workflows to complete before rollback")
                    response = input("Continue anyway? (yes/no): ")
                    if response.lower() != "yes":
                        return False
                break
            
            # Check database connectivity
            from hyperagent.core.config import settings
            import asyncpg
            
            conn = await asyncpg.connect(settings.database_url)
            await conn.close()
            print("[+] Database connectivity verified")
            
            # Check service health
            if not await self._check_service_health():
                print("[!] Warning: Service health check failed")
                response = input("Continue with rollback anyway? (yes/no): ")
                if response.lower() != "yes":
                    return False
            
            print("[+] Pre-rollback checks passed")
            return True
            
        except Exception as e:
            print(f"[-] Pre-rollback check error: {e}")
            print("[!] Continuing with rollback (use --force to skip checks)")
            return False
    
    async def _check_service_health(self) -> bool:
        """Check if service is healthy before rollback"""
        import aiohttp
        
        health_url = os.getenv("HEALTH_CHECK_URL", "http://localhost:8000/api/v1/health")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(health_url, timeout=5) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("status") == "healthy"
                    return False
        except Exception:
            # Service might not be running, which is okay for rollback
            return True
    
    async def _restore_database(self, backup_file: str) -> bool:
        """Restore database from backup"""
        from scripts.backup_database import DatabaseBackup
        
        backup_manager = DatabaseBackup()
        backup_path = Path(backup_file)
        
        if not backup_path.exists():
            print(f"[-] Backup file not found: {backup_file}")
            return False
        
        return await backup_manager.restore_backup(backup_path)
    
    async def _revert_code(self, version: str) -> bool:
        """Revert code to specific version"""
        try:
            # Git-based rollback
            result = subprocess.run(
                ["git", "checkout", version],
                cwd=project_root,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                print(f"[+] Code reverted to {version}")
                return True
            else:
                print(f"[-] Git checkout failed: {result.stderr}")
                return False
        except Exception as e:
            print(f"[-] Code revert error: {e}")
            return False
    
    async def _run_migrations(self) -> bool:
        """Run database migrations"""
        try:
            result = subprocess.run(
                ["alembic", "upgrade", "head"],
                cwd=project_root,
                capture_output=True,
                text=True
            )
            return result.returncode == 0
        except Exception as e:
            print(f"[-] Migration error: {e}")
            return False
    
    async def _restart_services(self) -> bool:
        """Restart application services"""
        try:
            # Docker Compose restart
            result = subprocess.run(
                ["docker-compose", "restart", "hyperagent"],
                cwd=project_root,
                capture_output=True
            )
            return result.returncode == 0
        except Exception as e:
            print(f"[-] Service restart error: {e}")
            return False
    
    async def _verify_rollback(self) -> bool:
        """Verify rollback was successful"""
        import aiohttp
        
        health_url = os.getenv("HEALTH_CHECK_URL", "http://localhost:8000/api/v1/health")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(health_url, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("status") == "healthy"
        except Exception as e:
            print(f"[-] Health check error: {e}")
            return False


async def main():
    """Main rollback entry point"""
    parser = argparse.ArgumentParser(description="Rollback HyperAgent deployment")
    parser.add_argument(
        "--version",
        help="Specific version to rollback to"
    )
    parser.add_argument(
        "--steps",
        type=int,
        default=1,
        help="Number of versions to rollback (default: 1)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force rollback without confirmation"
    )
    
    args = parser.parse_args()
    
    if not args.force:
        confirm = input("Are you sure you want to rollback? (yes/no): ")
        if confirm.lower() != "yes":
            print("[*] Rollback cancelled")
            sys.exit(0)
    
    manager = RollbackManager()
    success = await manager.rollback(args.version, args.steps)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())

